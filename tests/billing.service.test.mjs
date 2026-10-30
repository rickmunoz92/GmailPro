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
  const updates = [], carts = [], portals = [], mappings = [];
  const stripe = {
    prices: { retrieve: async id => ({ id, active: true, livemode: false, currency: 'usd',
      unit_amount: id === config.monthlyPrice ? 99 : 1000, recurring: { interval: id === config.monthlyPrice ? 'month' : 'year', interval_count: 1 }, product: config.product }) },
    subscriptions: { retrieve: async () => structuredClone(sub), update: async (id, data) => {
      updates.push({ id, data }); Object.assign(sub.metadata, data.metadata); return structuredClone(sub);
    } },
    checkout: { sessions: { retrieve: async () => structuredClone(session), create: async (data, options) => {
      carts.push({ data, options }); return { id: session.id, url: 'https://checkout.stripe.com/c/pay/demo', expires_at: epoch / 1000 + 86400 };
    } } },
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
  return { service, config, stripe, sub, session, invoices, charges, updates, carts, portals, mappings, token, event, license,
    advance(ms) { clock += ms; } };
}

test('Checkout validates server prices and retries with exactly identical parameters', async () => {
  const f = fixture();
  await f.service.checkout({ plan: 'month', purchaseToken: f.token }); f.advance(4000);
  await f.service.checkout({ plan: 'month', purchaseToken: f.token });
  assert.deepEqual(f.carts[0], f.carts[1]);
  assert.equal(f.carts[0].data.line_items[0].price, 'price_month');
  assert.equal(f.carts[0].data.mode, 'subscription');
  assert.equal(f.carts[0].data.subscription_data.trial_period_days, 7);
  assert.equal(f.carts[0].data.payment_method_collection, 'always');
  assert.equal(f.carts[0].data.subscription_data.trial_settings.end_behavior.missing_payment_method, 'cancel');
  assert.match(f.carts[0].data.integration_identifier, /^gmailpro_[a-z]{8}$/);
  assert.equal('payment_method_types' in f.carts[0].data, false);
  assert.equal('automatic_tax' in f.carts[0].data, false);
  await assert.rejects(f.service.checkout({ plan: 'free', purchaseToken: f.token }));
  f.stripe.prices.retrieve = async () => ({ active: true, livemode: false, currency: 'usd', unit_amount: 1 });
  await assert.rejects(f.service.checkout({ plan: 'year', purchaseToken: f.token }), /pricing needs attention/);
  f.config.launchEnabled = false;
  await assert.rejects(f.service.checkout({ plan: 'month', purchaseToken: f.token }), /being prepared/);
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

test('a seven-day free trial requires webhook fulfillment and expires without a successful renewal', async () => {
  const f = fixture(); f.sub.status = 'trialing'; f.sub.trial_end = epoch / 1000 + 7 * 86400;
  f.session.payment_status = 'no_payment_required';
  await assert.rejects(f.service.complete({ sessionId: f.session.id, purchaseToken: f.token }), /still processing/);
  const key = await f.license(), state = await f.service.status(key);
  assert.equal(state.active, true); assert.equal(state.status, 'trialing');
  assert.equal(state.trialEndsAt, epoch + 7 * 86400000);
  f.advance(7 * 86400000); assert.equal((await f.service.status(key)).active, false);
  f.sub.status = 'active'; await f.service.webhook(f.event('invoice.paid', 'in_current'));
  assert.equal((await f.service.status(key)).active, true);
  f.sub.status = 'past_due'; await f.service.webhook(f.event('invoice.payment_failed', 'in_current'));
  assert.equal((await f.service.status(key)).active, false);
});

test('out-of-order lifecycle events read canonical state, not old event snapshots', async () => {
  const f = fixture(), key = await f.license();
  f.sub.status = 'canceled';
  const stale = f.event('customer.subscription.updated', f.sub.id); stale.data.object.status = 'active';
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
  assert.equal((await invoke('status', { 'content-type': 'text/plain' })).status, 415);
  delete globalThis.Netlify;
  const result = await handler(new Request('https://example.netlify.app/api/billing/public-config'));
  assert.equal((await result.json()).salesEnabled, false);
});
