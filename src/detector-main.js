(function () {
  'use strict';

  const DEBOUNCE_MS = 500;
  const INTERCEPTED_METHODS = new Set(['POST', 'PUT', 'PATCH']);
  const recentRequests = new Map();

  function isDuplicate(method, url) {
    const key = `${method}:${url}`;
    const now = Date.now();
    const lastSeen = recentRequests.get(key);
    if (lastSeen && now - lastSeen < DEBOUNCE_MS) return true;
    recentRequests.set(key, now);
    return false;
  }

  function notifyIsolatedWorld(url, method) {
    window.postMessage({ type: 'FORMFETTI_AJAX_SUBMIT', url, method }, '*');
  }

  // ─── Patch fetch ──────────────────────────────────────────────────────

  try {
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      const result = originalFetch(input, init);
      try {
        const method = (init && init.method ? init.method : 'GET').toUpperCase();
        if (INTERCEPTED_METHODS.has(method)) {
          const url = typeof input === 'string' ? input
            : input instanceof Request ? input.url
            : String(input);
          result.then((response) => {
            if (response.ok && !isDuplicate(method, url)) {
              notifyIsolatedWorld(url, method);
            }
          }).catch(() => {}); // network error — not our concern
        }
      } catch (e) { /* never break the host page */ }
      return result;
    };
  } catch (e) { /* fetch patch failed — continue to XHR */ }

  // ─── Patch XMLHttpRequest ─────────────────────────────────────────────

  try {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method) {
      this._formfettiMethod = method;
      this._formfettiURL = arguments[1];
      return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      try {
        const method = (this._formfettiMethod || 'GET').toUpperCase();
        if (INTERCEPTED_METHODS.has(method)) {
          const xhr = this;
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const url = String(xhr._formfettiURL);
              if (!isDuplicate(method, url)) notifyIsolatedWorld(url, method);
            }
          });
        }
      } catch (e) { /* never break the host page */ }
      return originalXHRSend.apply(this, arguments);
    };
  } catch (e) { /* XHR patch failed */ }
})();
