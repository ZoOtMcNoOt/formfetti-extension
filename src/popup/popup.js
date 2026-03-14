function triggerTestConfetti(settings) {
  const existingCanvas = document.getElementById('formfetti-canvas');
  if (existingCanvas) {
    document.dispatchEvent(new CustomEvent('formfetti-celebrate', { detail: settings }));
  } else {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/confetti-runner.js');
    script.dataset.confettiUrl = chrome.runtime.getURL('lib/confetti.browser.min.js');
    if (settings) {
      script.dataset.intensity = settings.intensity || 'medium';
      script.dataset.colorTheme = settings.colorTheme || 'classic';
      script.dataset.shape = settings.shape || 'classic';
      script.dataset.gravity = settings.gravity || '1';
      script.dataset.size = settings.size || 'medium';
      script.dataset.toastMessage = settings.toastMessage || '';
    }
    document.documentElement.appendChild(script);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle-checkbox');
  const statusText = document.getElementById('status-text');
  const testBtn = document.getElementById('test-btn');
  const toastMessageInput = document.getElementById('toast-message');
  const gravitySelect = document.getElementById('gravity');
  const sizeSelect = document.getElementById('size');
  const knob = document.querySelector('.knob');

  // ─── Helpers ──────────────────────────────────────────────────────────

  function setupDisclosure(toggleEl, panelEl) {
    toggleEl.addEventListener('click', () => {
      const isOpen = panelEl.classList.toggle('open');
      toggleEl.setAttribute('aria-expanded', String(isOpen));
    });
    toggleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleEl.click();
      }
    });
  }

  function getSettingsFromDOM() {
    const settings = {};
    document.querySelectorAll('.option-group').forEach(group => {
      const selected = group.querySelector('.option-card.selected');
      if (selected) settings[group.dataset.setting] = selected.dataset.value;
    });
    settings.gravity = gravitySelect.value;
    settings.size = sizeSelect.value;
    settings.toastMessage = toastMessageInput.value;
    return settings;
  }

  function saveSettings() {
    chrome.storage.local.set({ settings: getSettingsFromDOM() });
  }

  // ─── Toggle spring animation ──────────────────────────────────────────

  const SPRING = { type: 'spring', stiffness: 400, damping: 15 };
  const hasMotion = typeof window.MotionAnimate === 'function';
  console.log(hasMotion
    ? '[Formfetti] Motion loaded — spring animation active'
    : '[Formfetti] Motion not found — using CSS fallback');

  function animateKnob(checked, instant = false) {
    const target = checked ? 30 : 0;
    if (instant) {
      knob.style.transition = 'none';
      knob.style.transform = `translateX(${target}px)`;
      requestAnimationFrame(() => { knob.style.transition = ''; });
    } else if (hasMotion) {
      knob.style.transition = 'none';
      window.MotionAnimate(knob, { x: target }, SPRING).then(() => {
        knob.style.transform = `translateX(${target}px)`;
        knob.style.transition = '';
      });
    }
  }

  function updateUI(enabled, instant = false) {
    toggle.checked = enabled;
    statusText.textContent = enabled ? 'Celebrating submissions!' : 'Taking a break';
    testBtn.disabled = !enabled;
    animateKnob(enabled, instant);
  }

  // ─── Option card selection ────────────────────────────────────────────

  document.querySelectorAll('.option-group').forEach(group => {
    group.addEventListener('click', (e) => {
      const card = e.target.closest('.option-card');
      if (!card) return;
      group.querySelectorAll('.option-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      card.classList.add('selected');
      card.setAttribute('aria-checked', 'true');
      saveSettings();
    });
  });

  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  // ─── Disclosure panels ────────────────────────────────────────────────

  setupDisclosure(
    document.getElementById('settings-toggle'),
    document.getElementById('settings-panel')
  );
  setupDisclosure(
    document.getElementById('more-options-toggle'),
    document.getElementById('more-options-panel')
  );

  // ─── Save on dropdown/input change ────────────────────────────────────

  gravitySelect.addEventListener('change', saveSettings);
  sizeSelect.addEventListener('change', saveSettings);
  toastMessageInput.addEventListener('input', saveSettings);

  // ─── Load state and settings ──────────────────────────────────────────

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    updateUI(response.enabled, true);
  });

  chrome.storage.local.get('settings', (result) => {
    const s = result.settings || {};
    const defaults = { intensity: 'medium', colorTheme: 'classic', shape: 'classic' };
    document.querySelectorAll('.option-group').forEach(group => {
      const setting = group.dataset.setting;
      const value = s[setting] || defaults[setting];
      group.querySelectorAll('.option-card').forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
      });
      const target = group.querySelector(`[data-value="${value}"]`);
      if (target) {
        target.classList.add('selected');
        target.setAttribute('aria-checked', 'true');
      }
    });
    gravitySelect.value = s.gravity || '1';
    sizeSelect.value = s.size || 'medium';
    toastMessageInput.value = s.toastMessage || '';
  });

  toggle.addEventListener('change', () => {
    chrome.runtime.sendMessage({ type: 'TOGGLE' }, (response) => {
      updateUI(response.enabled);
    });
  });

  // ─── Test button ──────────────────────────────────────────────────────

  testBtn.addEventListener('click', () => {
    testBtn.classList.remove('test-btn--pressed');
    void testBtn.offsetWidth;
    testBtn.classList.add('test-btn--pressed');
    testBtn.addEventListener('animationend', () => {
      testBtn.classList.remove('test-btn--pressed');
    }, { once: true });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: triggerTestConfetti,
        args: [getSettingsFromDOM()],
      });
    });
  });
});
