(() => {
  'use strict';
  const config = globalThis.GmailProBillingConfig;
  const storageKey = 'gmailPro.billing.v1';
  const refreshAge = 6 * 60 * 60 * 1000;
  let queue = Promise.resolve();
  const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  const load = async () => { await ready; return (await chrome.storage.local.get(storageKey))[storageKey] || {}; };
  const save = async state => { await ready; await chrome.storage.local.set({ [storageKey]: state }); };
  function popup(sender) {
    return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup/popup.html');
  }
  function gmail(sender) {
    return sender.id === chrome.runtime.id && sender.frameId === 0 && !!sender.tab &&
      typeof sender.url === 'string' && sender.url.startsWith('https://mail.google.com/');
  }
  async function request(path, body = {}, key) {
    const response = await fetch(config.apiOrigin + '/api/billing/' + path, {
      method: path === 'public-config' ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) },
      ...(path === 'public-config' ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(typeof result.error === 'string' ? result.error.slice(0, 200) : 'Billing is unavailable.');
      error.status = response.status; throw error;
    }
    return result;
  }
  function validStatus(status) {
    const now = Date.now();
    return status && typeof status.active === 'boolean' && typeof status.status === 'string' &&
      Number.isFinite(status.checkedAt) && status.checkedAt <= now + 60000 && status.checkedAt >= now - 60000 &&
      Number.isFinite(status.validUntil) && status.validUntil <= now + 24 * 60 * 60 * 1000 + 60000;
  }
  const inactive = () => ({ active: false, status: 'inactive', checkedAt: Date.now(), validUntil: Date.now() });
  async function notify() {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(tab => chrome.tabs.sendMessage(tab.id, { type: 'gmail-pro-entitlement-changed' })));
  }
  async function status(force = false) {
    if (config?.required === false) return { active: true, development: true };
    const state = await load(), now = Date.now();
    if (!state.licenseKey) return inactive();
    const lease = state.lease;
    if (!force && lease && lease.validUntil > now && now - lease.checkedAt < refreshAge) return lease;
    if (!force && state.retryAfter > now) return lease?.validUntil > now ? { ...lease, offline: true } : { ...inactive(), unavailable: true };
    try {
      const next = await request('status', {}, state.licenseKey);
      if (!validStatus(next)) throw new Error('Invalid subscription response.');
      await save({ ...state, lease: next, retryAfter: 0 });
      return next;
    } catch (error) {
      const recoverable = !error.status || error.status >= 500 || error.status === 429;
      if (!recoverable) { await save({ ...state, lease: inactive(), retryAfter: 0 }); return inactive(); }
      await save({ ...state, retryAfter: now + 5 * 60 * 1000 });
      return lease?.validUntil > now ? { ...lease, offline: true } : { ...inactive(), unavailable: true };
    }
  }
  async function openStripe(url) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !['checkout.stripe.com', 'billing.stripe.com'].includes(parsed.hostname) ||
      parsed.username || parsed.password || parsed.port) throw new Error('Unrecognized payment destination.');
    await chrome.tabs.create({ url: parsed.href });
  }
  function token() {
    return [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
  }
  async function handle(message, sender) {
    if (!popup(sender) && !(gmail(sender) && message.action === 'status')) return { ok: false, error: 'Unauthorized request.' };
    if (message.action === 'status') return { ok: true, status: await status() };
    if (message.action === 'refresh') { const next = await status(true); await notify(); return { ok: true, status: next }; }
    let state = await load();
    if (message.action === 'details') {
      let salesEnabled = false;
      try { salesEnabled = (await request('public-config')).salesEnabled === true; } catch { /* show setup state */ }
      return { ok: true, status: await status(), licenseKey: state.licenseKey || '', pending: !!state.pending,
        pendingPlan: state.pending?.plan || null, salesEnabled };
    }
    if (message.action === 'checkout') {
      if (!['month', 'year'].includes(message.plan)) throw new Error('Choose a subscription.');
      if (state.licenseKey) {
        const verified = await status(true);
        if (!['canceled', 'incomplete_expired'].includes(verified.status)) throw new Error('Use Manage subscription for your existing plan.');
        state = await load();
      }
      if (state.pending?.sessionId) {
        if (state.pending.expiresAt > Date.now()) {
          await openStripe(state.pending.url); return { ok: true };
        }
        // An old Checkout may have been paid even if activation never finished.
        // Only a server-confirmed expired session can start a fresh purchase.
        try {
          const completed = await request('complete', state.pending);
          if (typeof completed.licenseKey !== 'string' || !validStatus(completed.status)) throw new Error('Invalid activation response.');
          await save({ licenseKey: completed.licenseKey, lease: completed.status, retryAfter: 0 });
          await notify(); return { ok: true };
        } catch (error) {
          if (error.status !== 410) throw error;
          state = { ...state, pending: null };
        }
      }
      // Persist the purchase secret before the request: a worker interruption can
      // safely repeat the same idempotent Checkout creation without a second cart.
      const pending = { purchaseToken: state.pending?.purchaseToken || token(), plan: state.pending?.plan || message.plan };
      await save({ ...state, pending });
      const result = await request('checkout', { plan: pending.plan, purchaseToken: pending.purchaseToken });
      if (!/^cs_(?:test|live)_[a-zA-Z0-9]+$/.test(result.sessionId || '') || !Number.isFinite(result.expiresAt)) {
        throw new Error('Invalid checkout response.');
      }
      await save({ ...state, pending: { ...pending, ...result } });
      await openStripe(result.url); return { ok: true };
    }
    if (message.action === 'complete') {
      if (!state.pending?.sessionId) throw new Error('Start a subscription first.');
      const result = await request('complete', state.pending);
      if (typeof result.licenseKey !== 'string' || result.licenseKey.length > 200 || !validStatus(result.status)) {
        throw new Error('Invalid activation response.');
      }
      await save({ licenseKey: result.licenseKey, lease: result.status, retryAfter: 0 });
      await notify(); return { ok: true };
    }
    if (message.action === 'activate') {
      const key = typeof message.licenseKey === 'string' ? message.licenseKey.trim() : '';
      if (!key || key.length > 200) throw new Error('Enter your license key.');
      const next = await request('status', {}, key);
      if (!validStatus(next)) throw new Error('Invalid subscription response.');
      // Keep the current license intact if the replacement is invalid/unpaid.
      if (!next.active) throw new Error('This subscription is not active. Contact support or manage your existing plan.');
      await save({ licenseKey: key, lease: next, retryAfter: 0 });
      await notify(); return { ok: true };
    }
    if (message.action === 'portal') {
      if (!state.licenseKey) throw new Error('Activate your license first.');
      const result = await request('portal', {}, state.licenseKey);
      await openStripe(result.url); return { ok: true };
    }
    if (message.action === 'forget') { await save({}); await notify(); return { ok: true }; }
    throw new Error('Unknown billing action.');
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'gmail-pro-billing') return;
    const operation = () => handle(message, sender);
    const pending = queue.then(operation, operation);
    queue = pending.catch(() => {});
    pending.then(respond, error => respond({ ok: false, error: error?.message?.slice(0, 200) || 'Billing is unavailable.' }));
    return true;
  });
})();
