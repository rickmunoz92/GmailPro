import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingService, digest } from '../website/lib/billing.mjs';
import handler from '../website/netlify/functions/billing.mjs';
import StripeClient from 'stripe';

const epoch = Date.UTC(2026, 9, 29, 18);
function fixture() {
  let clock = epoch;
  const config = { siteURL: 'https://example.netlify.app', account: 'acct_demo', product: 'prod_gmail',
    monthlyPrice: 'price_month', annualPrice: 'price_year', licenseSecret: 'x'.repeat(64), livemode: false,
    launchEnabled: true, portalConfiguration: 'bpc_gmail' };
  const sub = { id: 'sub_demo', livemode: false, status: 'active', customer: 'cus_demo', latest_invoice: 'in_current',
    metadata: { application: 'gmail-pro' }, cancel_at_period_end: false,
    items: { data: [{ quantity: 1, current_period_end: epoch / 1000 + 86400 * 30,
      price: { id: config.monthlyPrice, product: config.product } }] } };
  const token = 'a'.repeat(64);
  const session = { id: 'cs_test_demo', mode: 'subscription', livemode: false, metadata: { application: 'gmail-pro' },
    client_reference_id: digest(token), status: 'complete', payment_status: 'paid', subscription: sub.id };
  const invoices = { in_current: { id: 'in_current', status: 'paid', parent: { subscription_details: { subscription: sub.id } } },
    in_old: { id: 'in_old', status: 'paid', parent: { subscription_details: { subscription: sub.id } } } };
  const charges = { ch_current: { id: 'ch_current', refunded: true, payment_intent: 'pi_current' },
    ch_old: { id: 'ch_old', refunded: true, payment_intent: 'pi_old' } };
  const updates = [], carts = [], portals = [], mappings = [], expirations = [];
  const stripe = {
    prices: { retrieve: async id => ({ id, active: true, livemode: false, currency: 'usd',
      unit_amount: id === config.monthlyPrice ? 99 : 1000, recurring: { interval: id === config.monthlyPrice ? 'month' : 'year', interval_count: 1 }, product: config.product }) },
    subscriptions: { retrieve: async () => structuredClone(sub), update: async (id, data) => {
      updates.push({ id, data }); Object.assign(sub.metadata, data.metadata); return structuredClone(sub);
    } },
    checkout: { sessions: { retrieve: async () => structuredClone(session), create: async (data, options) => {
      carts.push({ data, options }); return { id: session.id, url: 'https://checkout.stripe.com/c/pay/demo', expires_at: epoch / 1000 + 86400 };
    }, expire: async id => { expirations.push(id); session.status = 'expired'; return structuredClone(session); } } },
    invoices: { retrieve: async id => structuredClone(invoices[id]) }, charges: { retrieve: async id => structuredClone(charges[id]) },
    invoicePayments: { list: async parameters => { mappings.push(parameters); return { has_more: false,
      data: [{ invoice: parameters.payment.payment_intent === 'pi_current' ? 'in_current' : 'in_old' }] }; } },
    billingPortal: { sessions: { create: async data => { portals.push(data); return { url: 'https://billing.stripe.com/p/session/demo' }; } } }
  };
  const service = createBillingService({ stripe, config, now: () => clock });
  const event = (type, id) => ({ type, livemode: false, data: { object: { id, charge: id } } });
  async function license() {
    await service.webhook(event('checkout.session.completed', session.id));
    return (await service.complete({ sessionId: session.id, purchaseToken: token })).licenseKey;
  }
  return { service, config, stripe, sub, session, invoices, charges, updates, carts, portals, mappings, expirations, token, event, license,
    advance(ms) { clock += ms; } };
}

test('Checkout validates server prices and retries with exactly identical parameters', async () => {
  const f = fixture();
  await f.service.checkout({ plan: 'month', purchaseToken: f.token }); f.advance(4000);
  await f.service.checkout({ plan: 'month', purchaseToken: f.token });
  assert.deepEqual(f.carts[0], f.carts[1]);
  assert.equal(f.carts[0].data.line_items[0].price, 'price_month');
  assert.equal(f.carts[0].data.mode, 'subscription');
  assert.equal(f.carts[0].data.subscription_data.trial_period_days, 30);
  assert.equal(f.carts[0].data.payment_method_collection, 'always');
  assert.equal(f.carts[0].data.subscription_data.trial_settings.end_behavior.missing_payment_method, 'cancel');
  assert.equal(f.carts[0].data.consent_collection.terms_of_service, 'required');
  assert.equal(f.carts[0].data.metadata.terms_version, '2026-11-07.1');
  assert.equal(f.carts[0].data.subscription_data.metadata.privacy_version, '2026-11-10.1');
  assert.match(f.carts[0].data.custom_text.terms_of_service_acceptance.message, /legal\/terms-2026-11-07-1/);
  assert.match(f.carts[0].data.custom_text.submit.message, /US\$0\.99\/month.*automatically renewed/);
  assert.match(f.carts[0].data.integration_identifier, /^gmailpro_[a-z]{8}$/);
  assert.equal('payment_method_types' in f.carts[0].data, false);
  assert.equal('automatic_tax' in f.carts[0].data, false);
  assert.match(f.carts[0].data.custom_text.submit.message, /^30 days free/);
  await f.service.checkout({ plan: 'year', purchaseToken: 'b'.repeat(64) });
  assert.equal(f.carts.at(-1).data.subscription_data.trial_period_days, 30);
  assert.equal(f.carts.at(-1).data.line_items[0].price, 'price_year');
  assert.match(f.carts.at(-1).data.custom_text.submit.message, /^30 days free, then US\$10\/year/);
  await assert.rejects(f.service.checkout({ plan: 'free', purchaseToken: f.token }));
  f.stripe.prices.retrieve = async () => ({ active: true, livemode: false, currency: 'usd', unit_amount: 1 });
  await assert.rejects(f.service.checkout({ plan: 'year', purchaseToken: f.token }), /pricing needs attention/);
  f.config.launchEnabled = false;
  await assert.rejects(f.service.checkout({ plan: 'month', purchaseToken: f.token }), /being prepared/);
});

test('automatic tax is opt-in, requires explicit product/price setup, and preserves both 30-day plans', async () => {
  const f = fixture(); f.config.automaticTaxEnabled = true;
  const retrieve = f.stripe.prices.retrieve;
  for (const plan of ['month', 'year']) {
    const price = await retrieve(plan === 'month' ? f.config.monthlyPrice : f.config.annualPrice);
    for (const patch of [{}, { tax_behavior: 'exclusive' }, { product: { id: f.config.product, tax_code: 'txcd_fixture' } }]) {
      f.stripe.prices.retrieve = async () => ({ ...price, ...patch });
      await assert.rejects(f.service.checkout({ plan, purchaseToken: f.token }), /tax setup needs attention/);
    }
    for (const behavior of ['exclusive', 'inclusive']) {
      f.stripe.prices.retrieve = async (_id, options) => {
        assert.deepEqual(options, { expand: ['product'] });
        return { ...price, tax_behavior: behavior, product: { id: f.config.product, tax_code: 'txcd_fixture' } };
      };
      await f.service.checkout({ plan, purchaseToken: f.token });
      const data = f.carts.at(-1).data;
      assert.deepEqual(data.automatic_tax, { enabled: true });
      assert.equal(data.subscription_data.trial_period_days, 30);
      assert.equal(data.payment_method_collection, 'always');
      assert.equal('default_tax_rates' in data.subscription_data, false);
    }
  }
});

test('new Checkout cannot activate or fulfill without recorded terms acceptance; billing management remains available', async () => {
  const f = fixture();
  f.session.metadata.terms_version = '2026-11-07.1';
  await assert.rejects(f.service.webhook(f.event('checkout.session.completed', f.session.id)), /agreement was not recorded/);
  await assert.rejects(f.service.complete({ sessionId: f.session.id, purchaseToken: f.token }), /agreement was not recorded/);
  assert.equal(f.sub.metadata.gmailpro_fulfilled, undefined);
  f.session.consent = { terms_of_service: 'accepted' };
  const key = await f.license();
  assert.equal((await f.service.status(key)).active, true);
  f.session.consent = null;
  assert.match((await f.service.portal(key)).url, /^https:\/\/billing\.stripe\.com\//);
});

test('a pre-update Checkout parameter mismatch preserves its idempotency key and requires safe recovery', async () => {
  const f = fixture(), keys = [];
  f.stripe.checkout.sessions.create = async (_data, options) => {
    keys.push(options.idempotencyKey);
    throw Object.assign(new Error('Parameters differ'), { type: 'StripeIdempotencyError' });
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(f.service.checkout({ plan: 'month', purchaseToken: f.token }),
      error => error.status === 409 && /recovery.*Contact support/.test(error.message));
  }
  assert.deepEqual(keys, ['gmailpro-checkout-' + digest(f.token), 'gmailpro-checkout-' + digest(f.token)]);
});

test('success URL and pending payment cannot fulfill; a verified webhook can', async () => {
  const f = fixture(), input = { sessionId: f.session.id, purchaseToken: f.token };
  await assert.rejects(f.service.complete(input), /still processing/);
  await assert.rejects(f.service.complete({ ...input, purchaseToken: 'b'.repeat(64) }), /matching purchase/);
  f.session.payment_status = 'unpaid';
  await f.service.webhook(f.event('checkout.session.completed', f.session.id));
  assert.equal(f.sub.metadata.gmailpro_fulfilled, undefined);
  await assert.rejects(f.service.complete(input), /not complete/);
  f.session.payment_status = 'paid';
  const key = await f.license();
  assert.equal((await f.service.status(key)).active, true);
  const writes = f.updates.length;
  await f.service.webhook(f.event('checkout.session.async_payment_succeeded', f.session.id));
  assert.equal(f.updates.length, writes, 'duplicate fulfillment is idempotent');
  f.session.status = 'expired';
  await assert.rejects(f.service.complete(input), error => error.status === 410);
});

test('canceling an unfinished checkout requires ownership and never cancels a completed subscription', async () => {
  const f = fixture(), input = { sessionId: f.session.id, purchaseToken: f.token };
  f.session.status = 'open';
  await assert.rejects(f.service.cancelCheckout({ ...input, purchaseToken: 'b'.repeat(64) }), error => error.status === 401);
  assert.equal(f.expirations.length, 0);
  assert.deepEqual(await f.service.cancelCheckout(input), { canceled: true });
  assert.equal(f.expirations.length, 1);
  await f.service.cancelCheckout(input);
  assert.equal(f.expirations.length, 1, 'already expired is idempotent');
  f.session.status = 'complete';
  await assert.rejects(f.service.cancelCheckout(input), error => error.status === 409);
  assert.equal(f.expirations.length, 1);
  assert.equal(f.updates.length, 0);
  f.session.status = 'open';
  f.stripe.checkout.sessions.expire = async () => { f.session.status = 'complete'; throw new Error('Completion won'); };
  await assert.rejects(f.service.cancelCheckout(input), /Finish activation/);
  assert.equal(f.sub.status, 'active');
  f.session.status = 'open';
  f.stripe.checkout.sessions.expire = async () => { throw new Error('Network failed'); };
  await assert.rejects(f.service.cancelCheckout(input), /Network failed/);
  assert.equal(f.session.status, 'open');
});

test('a nonexistent checkout is an unauthorized purchase, while Stripe outages remain retryable', async () => {
  const f = fixture(), input = { sessionId: 'cs_test_missing', purchaseToken: f.token };
  f.stripe.checkout.sessions.retrieve = async () => { const error = new Error('No session'); error.code = 'resource_missing'; throw error; };
  await assert.rejects(f.service.complete(input), error => error.status === 401 && /matching purchase/.test(error.message));
  await assert.rejects(f.service.cancelCheckout(input), error => error.status === 401);
  f.stripe.checkout.sessions.retrieve = async () => { throw new Error('Stripe unavailable'); };
  await assert.rejects(f.service.complete(input), /Stripe unavailable/);
});

test('forged licenses, different environments and other products cannot authorize', async () => {
  const f = fixture(), key = await f.license();
  for (const invalid of ['', 'GP1.sub_foreign.bad', key + 'x', {}, 'x'.repeat(201)]) await assert.rejects(f.service.status(invalid));
  f.sub.livemode = true; await assert.rejects(f.service.status(key), /not a Gmail Pro/);
  f.sub.livemode = false; f.sub.items.data[0].price.product = 'prod_other';
  await assert.rejects(f.service.portal(key), /not a Gmail Pro/);
  await assert.rejects(f.service.webhook({ ...f.event('invoice.paid', 'in_current'), livemode: true }), /environment/);
});

test('period-end cancellation retains access; terminal, failed and expired states do not', async () => {
  const f = fixture(), key = await f.license();
  f.sub.cancel_at_period_end = true;
  const active = await f.service.status(key);
  assert.equal(active.active, true); assert.equal(active.cancelAtPeriodEnd, true);
  assert.equal(active.validUntil, epoch + 86400000);
  for (const status of ['canceled', 'past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
    f.sub.status = status; assert.equal((await f.service.status(key)).active, false, status);
  }
  f.sub.status = 'active'; f.sub.items.data[0].current_period_end = epoch / 1000;
  assert.equal((await f.service.status(key)).active, false);
});

test('a 30-day free trial requires webhook fulfillment and expires without a successful renewal', async () => {
  const f = fixture(); f.sub.status = 'trialing'; f.sub.trial_end = epoch / 1000 + 30 * 86400;
  f.session.payment_status = 'no_payment_required';
  await assert.rejects(f.service.complete({ sessionId: f.session.id, purchaseToken: f.token }), /still processing/);
  const key = await f.license(), state = await f.service.status(key);
  assert.equal(state.active, true); assert.equal(state.status, 'trialing');
  assert.equal(state.trialEndsAt, epoch + 30 * 86400000);
  f.advance(7 * 86400000); assert.equal((await f.service.status(key)).active, true);
  f.advance(23 * 86400000); assert.equal((await f.service.status(key)).active, false);
  f.sub.items.data[0].current_period_end = epoch / 1000 + 60 * 86400;
  f.sub.status = 'active'; await f.service.webhook(f.event('invoice.paid', 'in_current'));
  assert.equal((await f.service.status(key)).active, true);
  f.sub.status = 'past_due'; await f.service.webhook(f.event('invoice.payment_failed', 'in_current'));
  assert.equal((await f.service.status(key)).active, false);
});

test('portal cancel_at schedules show cancellation and bound trial and paid access', async () => {
  for (const state of ['active', 'trialing']) {
    const f = fixture(), key = await f.license();
    f.sub.status = state; f.sub.trial_end = epoch / 1000 + 30 * 86400;
    f.sub.cancel_at_period_end = false; f.sub.cancel_at = epoch / 1000 + 3600;
    const result = await f.service.status(key);
    assert.equal(result.active, true);
    assert.equal(result.cancelAtPeriodEnd, true);
    assert.equal(result.renewsAt, epoch + 3600000);
    assert.equal(result.validUntil, epoch + 3600000);
    if (state === 'trialing') assert.equal(result.trialEndsAt, epoch + 3600000);
    f.advance(3600000);
    assert.equal((await f.service.status(key)).active, false, 'never lease past a scheduled cancellation');
  }
});

test('a completed trial can be activated later without granting access to inactive subscriptions', async () => {
  for (const current of ['active', 'past_due', 'canceled']) {
    const f = fixture(); f.sub.status = 'trialing'; f.sub.trial_end = epoch / 1000 + 30 * 86400;
    f.session.payment_status = 'no_payment_required';
    await f.service.webhook(f.event('checkout.session.completed', f.session.id));
    f.advance(31 * 86400000); f.sub.status = current;
    if (current === 'active') f.sub.items.data[0].current_period_end = epoch / 1000 + 60 * 86400;
    await f.service.webhook(f.event(current === 'active' ? 'invoice.paid' : 'customer.subscription.updated',
      current === 'active' ? 'in_current' : f.sub.id));
    const input = { sessionId: f.session.id, purchaseToken: f.token };
    await assert.rejects(f.service.complete({ ...input, purchaseToken: 'b'.repeat(64) }), /matching purchase/);
    const result = await f.service.complete(input);
    assert.equal(result.status.active, current === 'active');
    assert.equal(result.status.status, current);
    await f.service.portal(result.licenseKey);
    assert.equal(f.portals[0].customer, f.sub.customer);
    delete f.sub.metadata.gmailpro_fulfilled;
    await assert.rejects(f.service.complete(input), /still processing/);
  }
});

test('out-of-order lifecycle events read canonical state, not old event snapshots', async () => {
  const f = fixture(), key = await f.license();
  f.sub.status = 'canceled';
  const stale = f.event('customer.subscription.updated', f.sub.id); stale.data.object.status = 'active';
  const update = f.stripe.subscriptions.update;
  f.stripe.subscriptions.update = async () => { throw new Error('Temporary Stripe write lock'); };
  await assert.rejects(f.service.webhook(stale), /Temporary Stripe write lock/, 'temporary failures propagate for delivery retry');
  assert.equal((await f.service.status(key)).active, false, 'canonical cancellation denies access even before metadata retry');
  f.stripe.subscriptions.update = update;
  await f.service.webhook(stale);
  assert.equal(f.sub.metadata.gmailpro_status, 'canceled');
  assert.equal((await f.service.status(key)).active, false);
  await f.service.webhook(f.event('invoice.payment_failed', 'in_current'));
  assert.equal((await f.service.status(key)).active, false);
});

test('old refund replay cannot undo the current invoice refund; a new paid period can restore access', async () => {
  const f = fixture(), key = await f.license();
  await f.service.webhook(f.event('charge.refunded', 'ch_current'));
  assert.equal((await f.service.status(key)).active, false);
  await f.service.webhook(f.event('charge.refunded', 'ch_old'));
  assert.equal(f.sub.metadata.gmailpro_refunded_invoice, 'in_current');
  assert.equal((await f.service.status(key)).active, false);
  f.sub.latest_invoice = 'in_renewal';
  f.invoices.in_renewal = { ...f.invoices.in_current, id: 'in_renewal' };
  await f.service.webhook(f.event('invoice.paid', 'in_renewal'));
  assert.equal((await f.service.status(key)).active, true);
  assert.deepEqual(f.mappings[0], { payment: { type: 'payment_intent', payment_intent: 'pi_current' }, limit: 10 });
});

test('disputes and fraud hold access, including after subsequent payment events', async () => {
  for (const type of ['charge.dispute.created', 'radar.early_fraud_warning.created']) {
    const f = fixture(), key = await f.license();
    await f.service.webhook(f.event(type, 'ch_current'));
    assert.equal((await f.service.status(key)).status, 'review_required');
    await f.service.webhook(f.event('invoice.paid', 'in_current'));
    assert.equal((await f.service.status(key)).active, false);
    await f.service.portal(key);
    assert.equal(f.portals[0].customer, f.sub.customer, 'management stays available while inactive');
  }
});

test('foreign subscriptions stay untouched and ambiguous risk mappings fail for retry', async () => {
  const f = fixture(); f.sub.metadata.application = 'another-app';
  await f.service.webhook(f.event('invoice.paid', 'in_current')); assert.equal(f.updates.length, 0);
  f.sub.metadata.application = 'gmail-pro';
  f.stripe.invoicePayments.list = async () => ({ has_more: true, data: [] });
  await assert.rejects(f.service.webhook(f.event('charge.refunded', 'ch_current')), /Ambiguous/);
});

test('review access is limited by a private hash and expiry and cannot open a billing portal', async () => {
  const f = fixture(), key = 'private-review-key';
  f.config.reviewKeyHash = digest(key); f.config.reviewExpiresAt = epoch + 86400000;
  assert.equal((await f.service.status(key)).review, true);
  await assert.rejects(f.service.portal(key), /no paid subscription/);
  f.advance(86400000); await assert.rejects(f.service.status(key));
});

test('HTTP handler rejects forged/old signatures and wrong origins without contacting Stripe', async () => {
  const values = { GMAIL_PRO_SITE_URL: 'https://example.netlify.app', GMAIL_PRO_STRIPE_ACCOUNT: 'acct_demo',
    GMAIL_PRO_STRIPE_PRODUCT: 'prod_gmail', GMAIL_PRO_MONTHLY_PRICE: 'price_month', GMAIL_PRO_ANNUAL_PRICE: 'price_year',
    GMAIL_PRO_LICENSE_SECRET: 'x'.repeat(64), STRIPE_RESTRICTED_KEY: 'rk_test_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_fixture' };
  globalThis.Netlify = { env: { get: key => values[key] } };
  const invoke = (path, headers = {}, body = '{}') => handler(new Request('https://example.netlify.app/api/billing/' + path,
    { method: 'POST', headers, body }));
  assert.equal((await invoke('webhook')).status, 400);
  assert.equal((await invoke('webhook', { 'stripe-signature': 't=1,v1=bad' })).status, 400);
  const payload = JSON.stringify({ type: 'unhandled.event', livemode: false, data: { object: {} } });
  const signature = StripeClient.webhooks.generateTestHeaderString({ payload, secret: values.STRIPE_WEBHOOK_SECRET });
  assert.equal((await invoke('webhook', { 'stripe-signature': signature }, payload)).status, 200);
  assert.equal((await invoke('status', { origin: 'https://evil.example', 'content-type': 'application/json' })).status, 403);
  assert.equal((await invoke('cancel-checkout', { origin: 'https://evil.example', 'content-type': 'application/json' })).status, 403);
  assert.equal((await invoke('cancel-checkout', { origin: values.GMAIL_PRO_SITE_URL, 'content-type': 'application/json' })).status, 401);
  assert.equal((await invoke('status', { 'content-type': 'text/plain' })).status, 415);
  delete globalThis.Netlify;
  const result = await handler(new Request('https://example.netlify.app/api/billing/public-config'));
  assert.equal((await result.json()).salesEnabled, false);
});

test('free HTTP deployment refuses Checkout even if the paid launch flag is accidentally enabled', async () => {
  globalThis.Netlify = { env: { get: key => key === 'GMAIL_PRO_LAUNCH_ENABLED' ? 'true' : undefined } };
  try {
    const config = await handler(new Request('https://example.netlify.app/api/billing/public-config'));
    const offer = await config.json();
    assert.equal(offer.free, true); assert.equal(offer.salesEnabled, false);
    const result = await handler(new Request('https://example.netlify.app/api/billing/checkout', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({plan:'month',purchaseToken:'a'.repeat(64)})
    }));
    assert.equal(result.status, 503); assert.match((await result.json()).error, /free for now/);
  } finally { delete globalThis.Netlify; }
});
