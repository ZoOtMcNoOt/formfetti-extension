(() => {
  // ─── Patterns ─────────────────────────────────────────────────────────

  const SEARCH_TERMS    = /\b(search|filter|go)\b/i;
  const MEANINGFUL_TERMS = /\b(submit|register|apply|complete|sign\s*up|check\s*out|order|create|save|send|publish)\b/i;

  const SKIP_URL_PATTERNS    = /(?:search|filter|autocomplete|suggest|login|signin|auth|validate|verify|check|save-draft|next-step|step\d)/i;
  const TRIGGER_URL_PATTERNS = /(?:submit|register|checkout|order|apply|signup|sign-up|create|contact|subscribe|payment|donate|enroll|confirm|complete|finalize)/i;

  // ─── Scoring constants ────────────────────────────────────────────────
  // Each rule nudges the score up (celebrate) or down (skip).
  // A form is "worthy" when the total score reaches WORTHY_THRESHOLD.

  const WORTHY_THRESHOLD = 2;

  const SCORE = {
    // Early rejection (returned directly, not added to running total)
    NOTHING_FILLED:    -10,  // zero fields filled — definitely not a real submission
    MOSTLY_EMPTY:       -5,  // 3+ fields but <40% filled — user just hit enter on a blank form

    // Structure signals
    MANY_INPUTS:         3,  // 3+ visible inputs — substantial form
    FEW_INPUTS:         -2,  // <2 visible inputs — probably a search box or toggle
    HAS_TEXTAREA:        2,  // textarea = longer-form content (contact, feedback)
    HAS_FILE_UPLOAD:     3,  // file input = application/upload (always worth celebrating)

    // Password fields
    PASSWORD_PAIR:       2,  // 2+ password fields = account creation (celebrate)
    SINGLE_PASSWORD:    -1,  // 1 password field = login (skip)

    // Anti-patterns
    SEARCH_ROLE:        -4,  // ancestor has role="search"
    SEARCH_ACTION:      -4,  // form action URL contains "search"
    SEARCH_INPUT:       -3,  // has input[type="search"]
    SEARCH_BUTTON:      -3,  // submit button says "search", "filter", "go"

    // Positive button text
    MEANINGFUL_BUTTON:   3,  // submit button says "register", "apply", "submit", etc.
  };

  const MIN_FILL_RATIO = 0.4;  // below this, a multi-field form is considered unfilled

  // ─── Helpers ──────────────────────────────────────────────────────────

  function getVisibleInputs(form) {
    return Array.from(form.querySelectorAll('input')).filter(input => {
      return input.type !== 'hidden' && input.offsetParent !== null;
    });
  }

  function getSubmitButtonText(form) {
    const buttons = form.querySelectorAll('button[type="submit"], input[type="submit"], button:not([type])');
    const texts = [];
    for (const btn of buttons) {
      const text = btn.value || btn.textContent || '';
      if (text.trim()) texts.push(text.trim());
    }
    return texts;
  }

  function hasSearchRole(form) {
    let el = form;
    while (el) {
      if (el.getAttribute && el.getAttribute('role') === 'search') return true;
      el = el.parentElement;
    }
    return false;
  }

  function isFieldFilled(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked;
    if (el.type === 'file') return el.files && el.files.length > 0;
    return el.value.trim().length > 0;
  }

  function getFormFillRatio(form) {
    const fields = [
      ...getVisibleInputs(form).filter(i => i.type !== 'submit' && i.type !== 'button'),
      ...Array.from(form.querySelectorAll('textarea')).filter(t => t.offsetParent !== null),
      ...Array.from(form.querySelectorAll('select')).filter(s => s.offsetParent !== null),
    ];
    if (fields.length === 0) return { filled: 0, total: 0, ratio: 0 };
    const filled = fields.filter(isFieldFilled).length;
    return { filled, total: fields.length, ratio: filled / fields.length };
  }

  // ─── Scoring ──────────────────────────────────────────────────────────

  function isFormWorthCelebrating(form) {
    let score = 0;
    const visibleInputs = getVisibleInputs(form);
    const passwordInputs = visibleInputs.filter(i => i.type === 'password');

    // Early rejection: unfilled forms
    const { filled, total, ratio } = getFormFillRatio(form);
    if (filled === 0) return { worthy: false, score: SCORE.NOTHING_FILLED };
    if (total >= 3 && ratio < MIN_FILL_RATIO) return { worthy: false, score: SCORE.MOSTLY_EMPTY };

    // Structure
    if (visibleInputs.length >= 3) score += SCORE.MANY_INPUTS;
    if (visibleInputs.length < 2)  score += SCORE.FEW_INPUTS;

    if (form.querySelector('textarea'))          score += SCORE.HAS_TEXTAREA;
    if (form.querySelector('input[type="file"]')) score += SCORE.HAS_FILE_UPLOAD;

    // Passwords
    if (passwordInputs.length >= 2)      score += SCORE.PASSWORD_PAIR;
    else if (passwordInputs.length === 1) score += SCORE.SINGLE_PASSWORD;

    // Anti-patterns
    if (hasSearchRole(form)) score += SCORE.SEARCH_ROLE;

    const action = form.getAttribute('action') || '';
    if (/search/i.test(action)) score += SCORE.SEARCH_ACTION;

    if (form.querySelector('input[type="search"]')) score += SCORE.SEARCH_INPUT;

    // Button text
    for (const text of getSubmitButtonText(form)) {
      if (SEARCH_TERMS.test(text))    score += SCORE.SEARCH_BUTTON;
      if (MEANINGFUL_TERMS.test(text)) score += SCORE.MEANINGFUL_BUTTON;
    }

    return { worthy: score >= WORTHY_THRESHOLD, score };
  }

  function isAjaxWorthCelebrating(url) {
    const lower = url.toLowerCase();
    if (SKIP_URL_PATTERNS.test(lower)) return false;
    if (TRIGGER_URL_PATTERNS.test(lower)) return true;
    return false;
  }

  window.__formfetti = { isFormWorthCelebrating, isAjaxWorthCelebrating };
})();
