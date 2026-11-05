const STORAGE_KEY = 'gmail-pro-web-purchase-v1';
const TOKEN = /^[a-f0-9]{64}$/;
const SESSION = /^cs_(?:live|test)_[A-Za-z0-9]+$/;
const LICENSE = /^GP1\.sub_[A-Za-z0-9]+\.[A-Za-z0-9_-]{43}$/;
export class WebBillingError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
export function stripeURL(value, portal = false) {
  let url;
  try { url = new URL(value); } catch { throw new WebBillingError('Stripe did not return a valid checkout address.'); }
  if (url.protocol !== 'https:' || url.hostname !== (portal ? 'billing.stripe.com' : 'checkout.stripe.com') ||
      url.username || url.password || url.port) throw new WebBillingError('Stripe did not return a valid checkout address.');
  return url.href;
}

// This tab owns its purchase token. Store it before contacting Stripe so a
// timeout can be retried without creating a second subscription checkout.
export function createWebBilling({ storage, fetcher = fetch, crypto = globalThis.crypto, now = Date.now }) {
  let busy = false;
  function read() {
    let record;
    try { const raw = storage.getItem(STORAGE_KEY); record = raw ? JSON.parse(raw) : null; }
    catch { throw new WebBillingError('Allow this site to use tab storage, then reload. No new checkout has been started.'); }
    if (record && (!['month', 'year'].includes(record.plan) || !TOKEN.test(record.purchaseToken) ||
        !Number.isFinite(record.createdAt) || (record.sessionId && !SESSION.test(record.sessionId)) ||
        (record.licenseKey && !LICENSE.test(record.licenseKey)))) {
      throw new WebBillingError('This tab’s saved checkout needs help. Contact support before starting another subscription.');
    }
    return record;
  }
  function write(record) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(record)); }
    catch { throw new WebBillingError('This tab could not save your checkout. Keep it open and allow tab storage before trying again.'); }
  }
  function clear() { storage.removeItem(STORAGE_KEY); }
  async function request(path, input, licenseKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher('/api/billing/' + path, {
        method: input ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...(licenseKey ? { Authorization: 'Bearer ' + licenseKey } : {}) },
        ...(input ? { body: JSON.stringify(input) } : {}), signal: controller.signal
      });
      let data;
      try { data = await response.json(); } catch { throw new WebBillingError('Billing is temporarily unavailable. Try again in this same tab.'); }
      if (!response.ok) throw new WebBillingError(typeof data?.error === 'string' ? data.error : 'Billing is temporarily unavailable.', response.status);
      return data;
    } catch (error) {
      if (error instanceof WebBillingError) throw error;
      throw new WebBillingError('Could not reach billing. Try again in this same tab; your checkout is saved.');
    } finally { clearTimeout(timer); }
  }
  async function exclusive(action) {
    if (busy) throw new WebBillingError('A billing request is already in progress.');
    busy = true;
    try { return await action(); } finally { busy = false; }
  }
  const inputFor = record => ({ sessionId: record.sessionId, purchaseToken: record.purchaseToken });
  async function ensureSession(record) {
    if (record.sessionId) return record;
    // Stripe may prune idempotency keys after 24 hours. Never retry an unknown
    // result beyond that window, where a second purchase could be created.
    if (now() - record.createdAt >= 23 * 3600000) throw new WebBillingError('This checkout needs recovery. Contact support before starting another subscription.');
    const result = await request('checkout', { plan: record.plan, purchaseToken: record.purchaseToken });
    if (!SESSION.test(result.sessionId) || !Number.isFinite(result.expiresAt)) throw new WebBillingError('Checkout could not be verified. Try again in this same tab.');
    const next = { ...record, sessionId: result.sessionId, url: stripeURL(result.url), expiresAt: result.expiresAt };
    write(next);
    return next;
  }
  async function finish(record) {
    const result = await request('complete', inputFor(record));
    if (!LICENSE.test(result?.licenseKey) || typeof result.status?.active !== 'boolean') throw new WebBillingError('Activation could not be verified. Try again shortly.');
    const next = { ...record, licenseKey: result.licenseKey };
    write(next);
    return result;
  }
  return Object.freeze({
    saved: () => { const record = read(); return record ? { plan: record.plan, hasLicense: !!record.licenseKey } : null; },
    license: () => read()?.licenseKey || '',
    publicConfig: () => request('public-config'),
    start: plan => exclusive(async () => {
      if (!['month','year'].includes(plan)) throw new WebBillingError('Choose monthly or annual billing.');
      let record = read();
      if (record?.licenseKey) return { activation: await finish(record) };
      if (record && record.plan !== plan) throw new WebBillingError('Continue or cancel the unfinished checkout below before changing plans.');
      if (record?.sessionId) {
        try { return { activation: await finish(record) }; }
        catch (error) {
          if (error.status === 410) { clear(); record = null; }
          else if (error.status !== 409 || now() >= record.expiresAt) throw error;
        }
      }
      if (!record) {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        record = { plan, purchaseToken: [...bytes].map(byte => byte.toString(16).padStart(2,'0')).join(''), createdAt: now() };
        write(record);
      }
      record = await ensureSession(record);
      return { url: stripeURL(record.url) };
    }),
    complete: () => exclusive(async () => {
      const record = read();
      if (!record) throw new WebBillingError('No website checkout is saved in this tab. If you subscribed in the extension, choose Finish activation there.');
      return finish(await ensureSession(record));
    }),
    cancel: () => exclusive(async () => {
      let record = read();
      if (!record) return;
      if (record.licenseKey) throw new WebBillingError('This purchase is complete. Use Manage subscription to cancel renewal.');
      record = await ensureSession(record);
      const result = await request('cancel-checkout', inputFor(record));
      if (result?.canceled !== true) throw new WebBillingError('Checkout was not canceled. Try again.');
      clear();
    }),
    portal: key => exclusive(async () => {
      const licenseKey = typeof key === 'string' ? key.trim() : '';
      if (!LICENSE.test(licenseKey)) throw new WebBillingError('Enter your Gmail Pro license key.');
      const result = await request('portal', {}, licenseKey);
      return stripeURL(result.url, true);
    })
  });
}
