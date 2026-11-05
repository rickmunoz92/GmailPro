import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createWebBilling, stripeURL } from '../website/public/web-billing.mjs';

const licenseKey = 'GP1.sub_demo.' + 'x'.repeat(43);
function fixture() {
  let clock = Date.now(), failStorage = false, failCreate = false, phase = 'open';
  const values = new Map(), calls = [];
  const storage = { getItem: key => values.get(key) || null,
    setItem(key, value) { if (failStorage) throw new Error('Quota'); values.set(key, value); },
    removeItem: key => values.delete(key) };
  const fetcher = async (url, options) => {
    const input = options.body && JSON.parse(options.body);
    calls.push({ url, input, options });
    if (url.endsWith('/checkout')) {
      if (failCreate) throw new Error('Timeout after server received request');
      return Response.json({ sessionId: 'cs_test_demo', expiresAt: clock + 86400000, url: 'https://checkout.stripe.com/c/pay/demo' });
    }
    if (url.endsWith('/complete')) {
      if (phase === 'expired') return Response.json({ error: 'Checkout expired.' }, { status: 410 });
      if (phase === 'open' || phase === 'processing') return Response.json({ error: phase === 'open' ? 'Not complete.' : 'Activation processing.' }, { status: 409 });
      return Response.json({ licenseKey, status: { active: phase === 'active' } });
    }
    if (url.endsWith('/cancel-checkout')) {
      return phase === 'active' ? Response.json({ error: 'Finish activation.' }, { status: 409 }) : Response.json({ canceled: true });
    }
    if (url.endsWith('/portal')) return Response.json({ url: 'https://billing.stripe.com/p/session/demo' });
    return Response.json({ salesEnabled: true });
  };
  const billing = createWebBilling({ storage, fetcher, crypto: webcrypto, now: () => clock });
  return { billing, storage, values, calls,
    phase(value) { phase = value; }, failStorage(value) { failStorage = value; }, failCreate(value) { failCreate = value; },
    advance(ms) { clock += ms; } };
}

test('website starts only after durable tab storage and retries uncertain creation with the same token', async () => {
  const f = fixture(); f.failStorage(true);
  await assert.rejects(f.billing.start('month'), /could not save/);
  assert.equal(f.calls.length, 0);
  f.failStorage(false); f.failCreate(true);
  await assert.rejects(f.billing.start('month'), /Try again in this same tab/);
  assert.equal(f.billing.saved().plan, 'month');
  const first = f.calls[0].input;
  f.failCreate(false);
  assert.equal((await f.billing.start('month')).url, 'https://checkout.stripe.com/c/pay/demo');
  assert.deepEqual(f.calls[1].input, first);
  assert.match(first.purchaseToken, /^[a-f0-9]{64}$/);
  assert.equal(f.calls[1].options.credentials, 'omit');
  assert.equal(f.calls[1].options.redirect, 'error');
});

test('pending carts are resumed, serialized and canceled before a plan change', async () => {
  const f = fixture();
  const first = f.billing.start('month');
  await assert.rejects(f.billing.start('month'), /already in progress/);
  await first;
  await f.billing.start('month');
  assert.equal(f.calls.filter(call => call.url.endsWith('/checkout')).length, 1);
  await assert.rejects(f.billing.start('year'), /before changing plans/);
  await f.billing.cancel(); assert.equal(f.billing.saved(), null);
  await f.billing.start('year');
  const carts = f.calls.filter(call => call.url.endsWith('/checkout'));
  assert.equal(carts.length, 2);
  assert.notEqual(carts[0].input.purchaseToken, carts[1].input.purchaseToken);
  assert.equal(carts[1].input.plan, 'year');
});

test('redirects do not activate; verified completion keeps the license and never starts another subscription', async () => {
  const f = fixture(); await f.billing.start('year');
  await assert.rejects(f.billing.complete(), error => error.status === 409);
  assert.equal(f.billing.license(), '');
  f.phase('processing'); await assert.rejects(f.billing.complete(), error => error.status === 409);
  f.phase('active');
  assert.equal((await f.billing.complete()).status.active, true);
  assert.equal(f.billing.license(), licenseKey);
  assert.equal((await f.billing.start('month')).activation.licenseKey, licenseKey);
  await assert.rejects(f.billing.cancel(), /Manage subscription/);
  assert.equal(f.calls.filter(call => call.url.endsWith('/checkout')).length, 1);
  assert.equal(await f.billing.portal(licenseKey), 'https://billing.stripe.com/p/session/demo');
  assert.equal(f.calls.at(-1).options.headers.Authorization, 'Bearer ' + licenseKey);
});

test('completion winning a cancellation race preserves the purchase for activation', async () => {
  const f = fixture(); await f.billing.start('month'); f.phase('active');
  await assert.rejects(f.billing.cancel(), error => error.status === 409);
  assert.ok(f.billing.saved());
  assert.equal((await f.billing.complete()).licenseKey, licenseKey);
});

test('only confirmed expired checkout can be replaced; old unknown results require recovery', async () => {
  const f = fixture(); await f.billing.start('month'); const token = f.calls[0].input.purchaseToken;
  f.advance(86400001); f.phase('processing');
  await assert.rejects(f.billing.start('month'), error => error.status === 409);
  assert.equal(f.calls.filter(call => call.url.endsWith('/checkout')).length, 1);
  f.phase('expired'); await f.billing.start('month');
  assert.notEqual(f.calls.at(-1).input.purchaseToken, token);
  const unknown = fixture(); unknown.failCreate(true);
  await assert.rejects(unknown.billing.start('month'));
  unknown.advance(23 * 3600000); unknown.failCreate(false);
  await assert.rejects(unknown.billing.start('month'), /needs recovery/);
  assert.equal(unknown.calls.length, 1);
});

test('invalid tab state, missing purchases and unsafe Stripe addresses fail closed', async () => {
  const f = fixture();
  await assert.rejects(f.billing.complete(), /No website checkout/);
  await assert.rejects(f.billing.portal('not-a-license'));
  for (const value of ['http://checkout.stripe.com/a','https://checkout.stripe.com.evil.example/a',
    'https://evil@checkout.stripe.com/a','https://checkout.stripe.com:444/a','javascript:alert(1)']) {
    assert.throws(() => stripeURL(value), /valid checkout address/);
  }
  await f.billing.start('month');
  f.values.set([...f.values.keys()][0], '{broken');
  await assert.rejects(f.billing.start('month'), /tab storage/);
  assert.equal(f.calls.filter(call => call.url.endsWith('/checkout')).length, 1);
  assert.equal(await f.billing.portal(licenseKey), 'https://billing.stripe.com/p/session/demo', 'manual management does not read corrupt purchase storage');
  f.storage.getItem = () => { throw new Error('Storage denied'); };
  assert.equal(await f.billing.portal(licenseKey), 'https://billing.stripe.com/p/session/demo', 'manual management does not require tab storage');
});
