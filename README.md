# Formfetti 🎉

A Chrome extension that celebrates form submissions with confetti. Fill out a form, hit submit, and get rewarded with a burst of color and a toast message.

## What It Does

Formfetti watches for form submissions across every page you visit. When you submit something worth celebrating — a registration, a contact form, an application — it fires confetti and shows a "You did the thing!" toast. It intentionally skips submissions that aren't accomplishments: searches, logins, filters, and empty forms.

## Install

1. Download the latest `formfetti-v*.zip` from [Releases](https://github.com/ZoOtMcNoOt/formfetti-extension/releases)
2. Unzip it
3. Go to `chrome://extensions`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** and select the unzipped folder

## Settings

Click the extension icon to open the popup. From there you can:

- **Toggle on/off** — pause celebrations without uninstalling
- **Test Confetti** — preview your current settings on the active tab
- **Shape** — classic squares, stars, hearts, or emoji
- **Color Theme** — classic, rainbow, gold, ocean, or mono
- **Intensity** — subtle (single burst), party (three bursts), or chaos (four bursts from all directions)
- **Gravity** — floaty, normal, or heavy particle fall speed
- **Size** — small, medium, or large particles
- **Toast Message** — custom text shown at the bottom of the page (defaults to "You did the thing!")

Settings persist across browser sessions via `chrome.storage.local`.

## How It Works

The extension runs across four execution contexts, each with a specific job.

### 1. Form Scoring (`heuristics.js` — MAIN world)

When a form is submitted, the heuristic scorer decides if it's worth celebrating. It assigns a numeric score based on:

| Signal | Score | Reasoning |
|--------|-------|-----------|
| 3+ visible inputs | +3 | Substantial form |
| Has textarea | +2 | Long-form content (contact, feedback) |
| Has file input | +3 | Uploads are always an accomplishment |
| 2+ password fields | +2 | Account creation |
| 1 password field | -1 | Probably a login |
| `role="search"` ancestor | -4 | Search box |
| Action URL contains "search" | -4 | Search form |
| `input[type="search"]` | -3 | Search input |
| Button says "search"/"filter"/"go" | -3 | Search/filter action |
| Button says "submit"/"register"/etc. | +3 | Meaningful submission |
| < 2 visible inputs | -2 | Too simple |
| Zero fields filled | -10 | Empty form |
| 3+ fields but < 40% filled | -5 | Barely touched |

A form needs a score of **2 or higher** to celebrate.

For AJAX requests, URL pattern matching is used instead — URLs containing words like `submit`, `checkout`, `register`, `payment` trigger celebration, while `search`, `filter`, `login`, `autocomplete` are skipped.

### 2. AJAX Interception (`detector-main.js` — MAIN world)

Many modern sites use single-page app patterns where forms submit via `fetch()` or `XMLHttpRequest` instead of navigating. This script patches both APIs in the main world to detect POST/PUT/PATCH requests. When a request succeeds (2xx status), it posts a message to the isolated world for processing.

Requests are debounced (500ms) to avoid duplicate celebrations from retry logic or framework double-fires.

### 3. Celebration Orchestration (`content.js` — ISOLATED world)

The content script ties everything together:

- **Traditional forms**: On `submit` event, scores the form synchronously (before navigation destroys the DOM). If worthy and the form causes a page navigation, it sets a `pendingCelebration` flag in session storage. The next page load checks for success signals ("thank you", "submitted", "order placed") before firing confetti.
- **SPA forms**: If `e.defaultPrevented` is true (no navigation), it starts a MutationObserver watching for success text to appear in the DOM. The observer runs for up to 8 seconds.
- **AJAX requests**: Same MutationObserver approach — waits for the page to confirm success before celebrating.
- **Multi-step forms**: If the landing page has another substantial form (2+ fields), it re-arms the pending flag instead of celebrating, so only the final step triggers confetti.

### 4. Confetti Animation (`confetti-runner.js` — MAIN world, on demand)

Injected into the page only when a celebration triggers. Loads the [canvas-confetti](https://github.com/catdad/canvas-confetti) library and fires bursts based on the intensity preset:

- **Subtle**: Single burst from bottom center (40 particles)
- **Party**: Three staggered bursts — center, left, right (140 particles total)
- **Chaos**: Four bursts from center, left, right, and top (320 particles total)

Respects `prefers-reduced-motion` — if enabled, only the toast message appears.

### 5. Background Service Worker (`background.js`)

Manages the enabled/disabled state and toolbar badge. Responds to `GET_STATE` and `TOGGLE` messages from the popup.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Page (MAIN world)                                          │
│                                                             │
│  detector-main.js ──► patches fetch() & XMLHttpRequest      │
│         │              posts message on successful POST     │
│         ▼                                                   │
│  heuristics.js ────► scores forms, checks AJAX URLs         │
│                       exposed via window.__formfetti        │
│                                                             │
│  confetti-runner.js ► (injected on demand)                  │
│                       canvas-confetti + toast animation     │
└─────────────┬───────────────────────────────────────────────┘
              │ postMessage / CustomEvent
┌─────────────▼───────────────────────────────────────────────┐
│  Page (ISOLATED world)                                      │
│                                                             │
│  content.js ──────► listens for submit events               │
│                     listens for AJAX messages                │
│                     watches DOM for success text             │
│                     manages pendingCelebration flag          │
│                     injects confetti-runner.js when needed   │
└─────────────┬───────────────────────────────────────────────┘
              │ chrome.runtime.sendMessage
┌─────────────▼───────────────────────────────────────────────┐
│  Background (Service Worker)                                │
│                                                             │
│  background.js ───► stores enabled state                    │
│                     updates toolbar badge                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Popup                                                      │
│                                                             │
│  popup.html/css/js ► settings UI                            │
│                      toggle on/off                          │
│                      test confetti on active tab            │
└─────────────────────────────────────────────────────────────┘
```

## Permissions

- **storage** — persist settings and enabled state
- **activeTab** — inject test confetti into the current tab from the popup
- **scripting** — execute the test confetti function on the active tab

Content scripts run on all URLs (`<all_urls>`) to detect form submissions everywhere.

## Development

The test page at `test/index.html` covers all detection scenarios: real form submissions, AJAX/SPA submissions, search forms, login forms, empty forms, multi-step checkout, and reduced motion. Load the extension unpacked, then open the test page to verify behavior.
