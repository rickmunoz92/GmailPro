(() => {
  'use strict';
  const legal = globalThis.GmailProLegal, key = 'gmailPro.consent.v1';
  const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  let queue = Promise.resolve();
  const popup = sender => sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup/popup.html');
  const gmail = sender => sender.id === chrome.runtime.id && sender.frameId === 0 && !!sender.tab &&
    typeof sender.url === 'string' && sender.url.startsWith('https://mail.google.com/');
  async function status() {
    await ready;
    const record = (await chrome.storage.local.get(key))[key];
    const accepted = record?.termsVersion === legal.termsVersion && record?.privacyVersion === legal.privacyVersion &&
      Number.isFinite(record.acceptedAt) && record.acceptedAt > 0 && record.acceptedAt <= Date.now() && record.adultConfirmed === true;
    return { accepted, ...(accepted ? { acceptedAt: record.acceptedAt } : {}),
      termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion };
  }
  globalThis.GmailProConsentWorker = Object.freeze({ status });
  async function notify() {
    const message = { type: 'gmail-pro-consent-changed' };
    // IDs need no browsing-history permission; only our installed content
    // scripts can receive the message. Match the existing billing notification.
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled([chrome.runtime.sendMessage(message),
      ...tabs.map(tab => chrome.tabs.sendMessage(tab.id, message))]);
  }
  async function handle(message, sender) {
    if (!popup(sender) && !(gmail(sender) && message.action === 'status')) return { ok: false, error: 'Unauthorized request.' };
    if (message.action === 'status') return { ok: true, status: await status() };
    if (message.action === 'accept') {
      if (message.termsVersion !== legal.termsVersion || message.privacyVersion !== legal.privacyVersion ||
          message.adultConfirmed !== true || message.agreed !== true) throw new Error('Review the current terms first.');
      await ready;
      await chrome.storage.local.set({ [key]: { termsVersion: legal.termsVersion, privacyVersion: legal.privacyVersion,
        acceptedAt: Date.now(), adultConfirmed: true } });
    } else if (message.action === 'withdraw') { await ready; await chrome.storage.local.remove(key); }
    else throw new Error('Unknown consent action.');
    const next = await status();
    // Delivery failure must not turn a successful durable save into an error.
    await notify().catch(() => {});
    return { ok: true, status: next };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'gmail-pro-consent') return;
    const pending = queue.then(() => handle(message, sender));
    queue = pending.catch(() => {});
    pending.then(respond, () => respond({ ok: false, error: 'Could not save or read your agreement. Please try again.' }));
    return true;
  });
})();
