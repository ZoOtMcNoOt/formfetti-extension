(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────

  const MAX_Z_INDEX = '2147483647';
  const CANVAS_HIDE_DELAY_MS = 3000;
  const TOAST_ANIMATION_MS = 2.5; // seconds (used in CSS animation shorthand)

  // ─── Theme & shape maps ───────────────────────────────────────────────

  const COLOR_THEMES = {
    classic: undefined,
    rainbow: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#8800ff'],
    gold:    ['#FFD700', '#FFA500', '#FFEC8B', '#DAA520', '#F0E68C'],
    ocean:   ['#006994', '#40E0D0', '#00CED1', '#48D1CC', '#AFEEEE'],
    mono:    ['#ffffff', '#cccccc', '#888888', '#444444'],
  };

  const SIZE_SCALARS = { small: 0.6, medium: 1, large: 1.5 };

  // Each intensity level defines a sequence of confetti bursts.
  // { delay, count, spread, origin, angle } — delay=0 fires immediately.
  const INTENSITY_PRESETS = {
    low: [
      { delay: 0, count: 40, spread: 70, origin: { x: 0.5, y: 0.9 } },
    ],
    medium: [
      { delay: 0,   count: 80, spread: 70, origin: { x: 0.5, y: 0.9 } },
      { delay: 200, count: 30, spread: 55, origin: { x: 0.1, y: 0.7 }, angle: 60 },
      { delay: 400, count: 30, spread: 55, origin: { x: 0.9, y: 0.7 }, angle: 120 },
    ],
    high: [
      { delay: 0,   count: 150, spread: 100, origin: { x: 0.5, y: 0.9 } },
      { delay: 200, count: 60,  spread: 55,  origin: { x: 0.1, y: 0.7 }, angle: 60 },
      { delay: 400, count: 60,  spread: 55,  origin: { x: 0.9, y: 0.7 }, angle: 120 },
      { delay: 400, count: 50,  spread: 80,  origin: { x: 0.5, y: 0.0 }, angle: 270 },
    ],
  };

  // ─── Setup ────────────────────────────────────────────────────────────

  const runnerScript = document.currentScript;
  const confettiUrl = runnerScript && runnerScript.dataset.confettiUrl;

  const confettiScript = document.createElement('script');
  confettiScript.src = confettiUrl;
  document.documentElement.appendChild(confettiScript);

  confettiScript.addEventListener('load', () => {
    // ─── Canvas ───────────────────────────────────────────────────────

    const canvas = document.createElement('canvas');
    canvas.id = 'formfetti-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100vw', height: '100vh',
      pointerEvents: 'none',
      zIndex: MAX_Z_INDEX,
    });
    document.body.appendChild(canvas);

    const fireConfetti = confetti.create(canvas, { resize: true });

    // Shapes must be created after confetti library loads
    const SHAPE_MAP = {
      classic: undefined,
      stars:   ['star'],
      hearts:  [confetti.shapeFromPath({ path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' })],
      emoji: [
        confetti.shapeFromText({ text: '🎉', scalar: 2 }),
        confetti.shapeFromText({ text: '🎊', scalar: 2 }),
        confetti.shapeFromText({ text: '🥳', scalar: 2 }),
      ],
    };

    // ─── Toast ────────────────────────────────────────────────────────

    const style = document.createElement('style');
    style.textContent = `
      @keyframes formfetti-toast-in-out {
        0%   { opacity: 0; transform: translateX(-50%) translateY(10px); }
        10%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        70%  { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
    `;
    document.head.appendChild(style);

    const toast = document.createElement('div');
    toast.id = 'formfetti-toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '40px', left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.8)', color: '#fff',
      borderRadius: '24px', padding: '10px 24px',
      font: 'bold 16px system-ui',
      zIndex: MAX_Z_INDEX,
      animation: `formfetti-toast-in-out ${TOAST_ANIMATION_MS}s ease forwards`,
      pointerEvents: 'none',
    });
    document.body.appendChild(toast);

    // ─── Celebrate ────────────────────────────────────────────────────

    function celebrate(settings = {}) {
      const {
        intensity = 'medium',
        colorTheme = 'classic',
        toastMessage = '',
        shape = 'classic',
        gravity: gravityStr = '1',
        size = 'medium',
      } = settings;

      const colors = COLOR_THEMES[colorTheme] || COLOR_THEMES.classic;
      const shapes = SHAPE_MAP[shape];
      const scalar = SIZE_SCALARS[size] || 1;
      const gravity = parseFloat(gravityStr) || 1;

      // Toast
      toast.textContent = toastMessage || 'You did the thing!';
      toast.style.display = 'block';
      toast.style.animation = 'none';
      void toast.offsetHeight; // force reflow
      toast.style.animation = `formfetti-toast-in-out ${TOAST_ANIMATION_MS}s ease forwards`;

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      // Shared options for every burst
      const shared = {
        disableForReducedMotion: true,
        scalar,
        gravity,
        ...(colors ? { colors } : {}),
        ...(shapes ? { shapes } : {}),
      };

      // Fire each burst in the intensity preset
      canvas.style.display = 'block';
      const bursts = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.medium;

      for (const burst of bursts) {
        const opts = {
          particleCount: burst.count,
          spread: burst.spread,
          origin: burst.origin,
          ...shared,
        };
        if (burst.angle !== undefined) opts.angle = burst.angle;

        if (burst.delay === 0) {
          fireConfetti(opts);
        } else {
          setTimeout(() => fireConfetti(opts), burst.delay);
        }
      }

      setTimeout(() => { canvas.style.display = 'none'; }, CANVAS_HIDE_DELAY_MS);
    }

    // ─── Event listeners ──────────────────────────────────────────────

    document.addEventListener('formfetti-celebrate', (e) => {
      celebrate(e.detail || {});
    });

    // Initial celebration — read settings from the script tag's data attributes
    const initialSettings = {};
    if (runnerScript) {
      for (const key of ['intensity', 'colorTheme', 'toastMessage', 'shape', 'gravity', 'size']) {
        if (runnerScript.dataset[key]) initialSettings[key] = runnerScript.dataset[key];
      }
    }
    celebrate(initialSettings);
  });
})();
