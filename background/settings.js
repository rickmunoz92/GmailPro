"use strict";

if (typeof importScripts === "function") {
  importScripts("../shared/billing-config.js", "../shared/legal-config.js", "consent.js", "billing.js");
}

// First use shows the disclosure in an extension page, without reading Gmail.
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
});

// Only our top-level Gmail content script may request the existing settings UI.
// This bridge accepts no destination URL, settings changes, or message content.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'gmail-pro-open-settings' || sender.id !== chrome.runtime.id ||
      sender.frameId !== 0 || !sender.tab || !sender.url?.startsWith('https://mail.google.com/')) return;
  (async () => {
    try {
      await chrome.action.openPopup({ windowId: sender.tab.windowId });
    } catch {
      // Some Chrome windows cannot host an action popup. Reuse the same page.
      await chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
    }
  })().then(() => respond({ ok: true }), () => respond({ ok: false }));
  return true;
});
