(() => {
  // ─── Constants ────────────────────────────────────────────────────────

  const CELEBRATION_COOLDOWN_MS     = 3000;  // min time between celebrations
  const PAGE_RENDER_DELAY_MS        = 500;   // wait for page paint before assessing
  const SCAN_TEXT_LIMIT             = 5000;  // only scan top N chars for success signals
  const SUCCESS_CHECK_MAX_LENGTH    = 2000;  // ignore huge text nodes in mutation observer
  const MUTATION_OBSERVER_TIMEOUT_MS = 8000; // stop watching for success text after this
  const MIN_FORM_FIELDS             = 2;     // forms with fewer fields are "insubstantial"

  const SUCCESS_PATTERN = /\b(thank\s*you|success(?:ful(?:ly)?)?|submitted|confirmed|congratulations|order\s*placed|received|application\s*sent|we'?ll\s*(?:get\s*back|be\s*in\s*touch)|payment\s*(?:complete|received|accepted))\b/i;
  const INTERMEDIATE_PATTERN = /\b(review|confirm\s*your|verify|check\s*your|continue|next\s*step|step\s*\d)\b/i;

  // ─── State ────────────────────────────────────────────────────────────

  let enabled = true;
  let settings = { intensity: 'medium', colorTheme: 'classic', toastMessage: '', shape: 'classic', gravity: '1', size: 'medium' };
  let lastCelebration = 0;
  let confettiLoaded = false;
  let successObserver = null;
  let successTimeout = null;

  // ─── Storage sync ─────────────────────────────────────────────────────

  chrome.storage.local.get(['enabled', 'settings'], (result) => {
    enabled = result.enabled !== undefined ? result.enabled : true;
    if (result.settings) settings = result.settings;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.enabled) enabled = changes.enabled.newValue;
      if (changes.settings) settings = changes.settings.newValue;
    }
  });

  // ─── Page-load celebration (for multi-page form flows) ────────────────

  chrome.storage.session.get('pendingCelebration', (result) => {
    if (!result.pendingCelebration) return;
    chrome.storage.session.remove('pendingCelebration');
    setTimeout(() => assessPageForCompletion(), PAGE_RENDER_DELAY_MS);
  });

  function assessPageForCompletion() {
    const bodyText = document.body ? document.body.innerText : '';
    const truncated = bodyText.slice(0, SCAN_TEXT_LIMIT);

    if (SUCCESS_PATTERN.test(truncated)) {
      triggerCelebration();
      return;
    }

    // If the landing page has another substantial form, this is likely a
    // confirmation/review step. Re-arm the flag so the NEXT submit checks again.
    const forms = document.querySelectorAll('form');
    const hasSubstantialForm = Array.from(forms).some(f => {
      const inputs = f.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
      return inputs.length >= MIN_FORM_FIELDS;
    });

    if (hasSubstantialForm) {
      chrome.storage.session.set({ pendingCelebration: true });
      return;
    }

    // Ambiguous page — watch for success text appearing dynamically
    watchForSuccessText();
  }

  // ─── Celebration trigger ──────────────────────────────────────────────

  function triggerCelebration() {
    const now = Date.now();
    if (now - lastCelebration < CELEBRATION_COOLDOWN_MS) return;
    lastCelebration = now;

    if (!confettiLoaded) {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('src/confetti-runner.js');
      script.dataset.confettiUrl = chrome.runtime.getURL('lib/confetti.browser.min.js');
      script.dataset.intensity = settings.intensity;
      script.dataset.colorTheme = settings.colorTheme;
      script.dataset.toastMessage = settings.toastMessage || '';
      script.dataset.shape = settings.shape;
      script.dataset.gravity = settings.gravity;
      script.dataset.size = settings.size;
      script.addEventListener('load', () => { confettiLoaded = true; }, { once: true });
      document.documentElement.appendChild(script);
    } else {
      document.dispatchEvent(new CustomEvent('formfetti-celebrate', { detail: settings }));
    }
  }

  // ─── DOM mutation watcher (for SPAs) ──────────────────────────────────

  function checkTextForSuccess(text) {
    if (!text || text.length > SUCCESS_CHECK_MAX_LENGTH) return false;
    return SUCCESS_PATTERN.test(text) && !INTERMEDIATE_PATTERN.test(text);
  }

  function stopWatching() {
    if (successObserver) { successObserver.disconnect(); successObserver = null; }
    if (successTimeout)  { clearTimeout(successTimeout); successTimeout = null; }
  }

  function watchForSuccessText() {
    stopWatching();

    successObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          const text = (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE)
            ? node.textContent
            : null;
          if (checkTextForSuccess(text)) {
            stopWatching();
            triggerCelebration();
            return;
          }
        }
        if (mutation.type === 'characterData' && checkTextForSuccess(mutation.target.textContent)) {
          stopWatching();
          triggerCelebration();
          return;
        }
      }
    });

    successObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    successTimeout = setTimeout(stopWatching, MUTATION_OBSERVER_TIMEOUT_MS);
  }

  // ─── Form submit handler ──────────────────────────────────────────────

  document.addEventListener('submit', (e) => {
    if (!enabled) return;
    const form = e.target;

    // Score SYNCHRONOUSLY — the form may be removed by page handlers before setTimeout runs
    const result = window.__formfetti.isFormWorthCelebrating(form);
    if (!result.worthy && result.score < 0) return;

    setTimeout(() => {
      if (e.defaultPrevented) {
        // SPA form — watch DOM for success signals
        watchForSuccessText();
      } else if (result.worthy) {
        // Real navigation — flag for the landing page to assess
        chrome.storage.session.set({ pendingCelebration: true });
      }
    }, 0);
  }, true);

  // ─── AJAX handler ─────────────────────────────────────────────────────

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'FORMFETTI_AJAX_SUBMIT') return;
    if (!enabled) return;

    if (!window.__formfetti.isAjaxWorthCelebrating(event.data.url)) return;

    watchForSuccessText();
  });
})();
