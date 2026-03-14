const BADGE_OFF_COLOR = '#888';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true });
  chrome.action.setBadgeText({ text: '' });
  chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
});

function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: BADGE_OFF_COLOR });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get('enabled', (data) => {
      sendResponse({ enabled: data.enabled });
    });
    return true;
  }

  if (message.type === 'TOGGLE') {
    chrome.storage.local.get('enabled', (data) => {
      const newState = !data.enabled;
      chrome.storage.local.set({ enabled: newState }, () => {
        updateBadge(newState);
        sendResponse({ enabled: newState });
      });
    });
    return true;
  }
});
