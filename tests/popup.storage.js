/* Synthetic storage only. Loaded by serve-tests.py, never by the extension. */
(() => {
  "use strict";
  if (location.hostname !== "127.0.0.1") throw new Error("Local fixture only");
  const listeners = new Set();
  const state = { values: {}, writes: 0, failRead: true, failWrite: false, listeners };
  const runtimeListeners = new Set();
  state.agreement = { accepted: false };
  state.failConsentWrite = false;
  state.emit = patch => {
    const changes = Object.fromEntries(Object.entries(patch).map(([key, newValue]) =>
      [key, { oldValue: state.values[key], newValue }]));
    Object.assign(state.values, patch);
    for (const listener of listeners) listener(changes, "sync");
  };
  window.chrome ??= {};
  if (window.chrome.storage) throw new Error("Refusing to replace real Chrome storage");
  window.chrome.storage = {
    sync: {
      async get(keys) {
        if (state.failRead) throw new Error("Synthetic read failure");
        return Object.fromEntries(keys.filter(key => key in state.values).map(key => [key, state.values[key]]));
      },
      async set(patch) {
        if (state.failWrite) throw new Error("Synthetic write failure");
        state.writes++;
        state.emit(patch);
      }
    },
    onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }
  };
  window.chrome.runtime = {
    onMessage: { addListener: fn => runtimeListeners.add(fn), removeListener: fn => runtimeListeners.delete(fn) },
    async sendMessage(message) {
      if (message.type === 'gmail-pro-billing' && message.action === 'details') return { ok: true, status: { active: false }, licenseKey: '', pending: false, salesEnabled: false };
      if (message.type !== 'gmail-pro-consent') throw new Error('Unexpected synthetic message');
      if (message.action === 'accept') {
        if (state.failConsentWrite) return { ok: false, error: 'Synthetic agreement save failure' };
        state.agreement = { accepted: true, acceptedAt: Date.now() };
      } else if (message.action === 'withdraw') state.agreement = { accepted: false };
      return { ok: true, status: { ...state.agreement, termsVersion: GmailProLegal.termsVersion, privacyVersion: GmailProLegal.privacyVersion } };
    }
  };
  window.GmailProPopupTest = state;
})();
