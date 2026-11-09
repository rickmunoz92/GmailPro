(() => {
  'use strict';
  const app = (globalThis.GmailPro ??= {}), legal = globalThis.GmailProLegal;
  if (app.consent) return;
  async function send(action, values = {}) {
    const result = await chrome.runtime.sendMessage({ type: 'gmail-pro-consent', action, ...values });
    if (!result?.ok) throw new Error(result?.error || 'Could not load your agreement. Open Gmail Pro and try again.');
    return result.status;
  }
  app.consent = Object.freeze({
    getStatus: () => send('status'),
    accept: () => send('accept', { termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion,
      adultConfirmed: true, agreed: true }),
    withdraw: () => send('withdraw'),
    subscribe(listener) {
      const changed = message => { if (message?.type === 'gmail-pro-consent-changed') listener(); };
      chrome.runtime.onMessage.addListener(changed);
      return () => { try { chrome.runtime.onMessage.removeListener(changed); } catch { /* expired context */ } };
    }
  });
})();
