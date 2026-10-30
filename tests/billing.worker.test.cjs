'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..'), storageKey = 'gmailPro.billing.v1';
const epoch = Date.UTC(2026, 9, 29, 18), key = 'GP1.sub_demo.private';
function fixture(initial = {}) {
  let listener, clock = epoch, access;
  const data = { [storageKey]: structuredClone(initial) }, requests = [], opened = [];
  const status = () => ({ active: true, status: 'active', checkedAt: clock, validUntil: clock + 86400000, renewsAt: clock + 86400000 });
  let respond = async route => route === 'public-config' ? { salesEnabled: true } : status();
  const chrome = { storage: { local: { setAccessLevel: async value => { access = value; },
    get: async () => structuredClone(data), set: async values => Object.assign(data, structuredClone(values)) } },
    runtime: { id: 'extension', getURL: route => 'chrome-extension://extension/' + route,
      onMessage: { addListener: fn => { listener = fn; } } },
    tabs: { query: async () => [], sendMessage: async () => {}, create: async value => opened.push(value) } };
  const context = vm.createContext({ chrome, crypto: webcrypto, Uint8Array, URL, AbortSignal,
    Date: class extends Date { static now() { return clock; } },
    fetch: async (url, options) => { const route = url.split('/').at(-1); const body = options.body ? JSON.parse(options.body) : null;
      requests.push({ route, options, body }); const result = await respond(route, body);
      return new Response(JSON.stringify(result.body ?? result), { status: result.httpStatus || 200 }); } });
  vm.runInContext(fs.readFileSync(path.join(root, 'background/billing.js'), 'utf8'), vm.createContext({ ...context,
    GmailProBillingConfig: { required: true, apiOrigin: 'https://billing.example' } }));
  const popup = { id: 'extension', url: chrome.runtime.getURL('popup/popup.html') };
  const gmail = { id: 'extension', frameId: 0, tab: { id: 1 }, url: 'https://mail.google.com/mail/u/0/' };
  const send = (action, values = {}, sender = popup) => new Promise(resolve => {
    assert.equal(listener({ type: 'gmail-pro-billing', action, ...values }, sender, resolve), true);
  });
  return { send, requests, opened, status, gmail, popup, data, get state() { return data[storageKey]; },
    get access() { return access; }, respond(fn) { respond = fn; }, advance(ms) { clock += ms; } };
}
test('unlicensed startup makes no network request; Gmail cannot read keys or invoke billing mutations', async () => {
  const f = fixture();
  assert.equal((await f.send('status', {}, f.gmail)).status.active, false);
  assert.equal(f.requests.length, 0); assert.equal(f.access.accessLevel, 'TRUSTED_CONTEXTS');
  for (const action of ['details', 'checkout', 'activate', 'portal', 'forget']) assert.equal((await f.send(action, {}, f.gmail)).ok, false);
  assert.equal((await f.send('status', {}, { ...f.gmail, url: 'https://mail.google.com.evil/' })).ok, false);
  assert.equal((await f.send('status', {}, { ...f.gmail, frameId: 1 })).ok, false);
});
test('restore verifies before replacing an existing key and status never returns a key to Gmail', async () => {
  const f = fixture({ licenseKey: key });
  const first = await f.send('status', {}, f.gmail);
  assert.equal(first.status.active, true); assert.equal('licenseKey' in first, false);
  f.respond(async () => ({ httpStatus: 401, body: { error: 'Invalid key.' } }));
  assert.equal((await f.send('activate', { licenseKey: 'bad' })).ok, false);
  assert.equal(f.state.licenseKey, key);
});
test('offline lease works only within the verified paid window', async () => {
  const f = fixture({ licenseKey: key });
  await f.send('status'); f.advance(7 * 3600000);
  f.respond(async () => { throw new Error('offline'); });
  const offline = (await f.send('status')).status;
  assert.equal(offline.active, true); assert.equal(offline.offline, true);
  f.advance(18 * 3600000);
  assert.equal((await f.send('status')).status.active, false);
});
test('forget is serialized after an in-flight verification and cannot be undone by its stale response', async () => {
  const f = fixture({ licenseKey: key }); let resolve;
  f.respond(() => new Promise(done => { resolve = done; }));
  const checking = f.send('status'); await new Promise(setImmediate);
  const forgetting = f.send('forget'); resolve(f.status());
  await checking; await forgetting;
  assert.deepEqual(f.state, {}); assert.equal((await f.send('status')).status.active, false);
});
test('a failed Checkout retry preserves the same secret and selected plan', async () => {
  const f = fixture(); let fail = true;
  f.respond(async route => {
    assert.equal(route, 'checkout');
    if (fail) { fail = false; throw new Error('timeout'); }
    return { sessionId: 'cs_test_demo', url: 'https://checkout.stripe.com/c/pay/demo', expiresAt: epoch + 86400000 };
  });
  assert.equal((await f.send('checkout', { plan: 'month' })).ok, false);
  assert.equal((await f.send('checkout', { plan: 'year' })).ok, true);
  assert.deepEqual(f.requests[0].body, f.requests[1].body);
  assert.equal(f.state.pending.plan, 'month'); assert.equal(f.opened.length, 1);
});
test('only an expired unpaid cart can rotate its token; old paid Checkout activates without another cart', async () => {
  const pending = { sessionId: 'cs_test_old', purchaseToken: 'a'.repeat(64), plan: 'month', expiresAt: epoch - 1,
    url: 'https://checkout.stripe.com/c/pay/old' };
  const f = fixture({ pending });
  f.respond(async route => route === 'complete' ? { httpStatus: 410, body: { error: 'Expired' } } :
    { sessionId: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/new', expiresAt: epoch + 86400000 });
  assert.equal((await f.send('checkout', { plan: 'year' })).ok, true);
  assert.notEqual(f.state.pending.purchaseToken, pending.purchaseToken); assert.equal(f.state.pending.plan, 'year');
  const paid = fixture({ pending });
  paid.respond(async route => { assert.equal(route, 'complete'); return { licenseKey: key, status: paid.status() }; });
  assert.equal((await paid.send('checkout', { plan: 'month' })).ok, true);
  assert.equal(paid.state.licenseKey, key); assert.equal(paid.opened.length, 0);
});
test('active subscriptions cannot duplicate Checkout; terminal ones can resubscribe', async () => {
  const f = fixture({ licenseKey: key });
  assert.equal((await f.send('checkout', { plan: 'month' })).ok, false);
  f.respond(async route => route === 'status' ? { ...f.status(), active: false, status: 'canceled' } :
    { sessionId: 'cs_test_new', url: 'https://checkout.stripe.com/c/pay/new', expiresAt: epoch + 86400000 });
  assert.equal((await f.send('checkout', { plan: 'year' })).ok, true);
  assert.equal(f.state.licenseKey, key, 'old history access remains until new activation');
});
