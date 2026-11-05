import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import legal from '../../shared/legal-config.js';

export const WEBHOOK_EVENTS = Object.freeze([
  'checkout.session.completed', 'checkout.session.async_payment_succeeded',
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'invoice.paid', 'invoice.payment_failed',
  'charge.refunded', 'charge.dispute.created', 'radar.early_fraud_warning.created'
]);
const idOf = value => typeof value === 'string' ? value : value?.id;
export const digest = value => createHash('sha256').update(value).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class BillingError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Stripe is the subscription database. Licenses are signed references, and every
// verification reads canonical Stripe state. No mailbox/account data is collected.
export function createBillingService({ stripe, config, now = () => Date.now() }) {
  const prices = new Set([config.monthlyPrice, config.annualPrice]);
  const sign = subscription => createHmac('sha256', config.licenseSecret)
    .update(`gmail-pro-v1:${config.livemode}:${subscription}`).digest('base64url');
  const keyFor = subscription => `GP1.${subscription}.${sign(subscription)}`;
  const subscriptionForKey = key => {
    if (typeof key !== 'string' || key.length > 200) throw new BillingError('Enter a valid Gmail Pro license key.', 401);
    const parts = key.split('.');
    if (parts.length !== 3 || parts[0] !== 'GP1' || !/^sub_[a-zA-Z0-9]+$/.test(parts[1]) ||
      !equal(parts[2], sign(parts[1]))) throw new BillingError('This license key is invalid.', 401);
    return parts[1];
  };
  const owns = sub => sub?.metadata?.application === 'gmail-pro' && sub.livemode === config.livemode &&
    sub.items?.data?.length === 1 && sub.items.data[0].quantity === 1 &&
    prices.has(sub.items.data[0].price?.id) && idOf(sub.items.data[0].price?.product) === config.product;
  const retrieve = async id => {
    let sub;
    try { sub = await stripe.subscriptions.retrieve(id); }
    catch (error) {
      if (error.code === 'resource_missing') throw new BillingError('This subscription was not found.', 401);
      throw error;
    }
    if (!owns(sub)) throw new BillingError('This subscription is not a Gmail Pro subscription.', 403);
    return sub;
  };
  function reviewStatus(key) {
    const expiresAt = Number(config.reviewExpiresAt);
    if (!config.reviewKeyHash || !expiresAt || now() >= expiresAt || typeof key !== 'string' || key.length > 200 ||
      !equal(digest(key), config.reviewKeyHash)) return null;
    return { active: true, status: 'review', review: true, checkedAt: now(),
      validUntil: Math.min(expiresAt, now() + 24 * 60 * 60 * 1000), renewsAt: expiresAt, cancelAtPeriodEnd: true };
  }
  function statusOf(sub) {
    const checkedAt = now();
    const trialEndsAt = sub.status === 'trialing' ? sub.trial_end * 1000 : null;
    const periodEnd = sub.status === 'trialing' ? trialEndsAt : sub.items.data[0].current_period_end * 1000;
    // Stripe's portal can schedule an explicit cancel_at (including trial-end
    // cancellation) while cancel_at_period_end stays false.
    const cancellationEnd = Number.isFinite(sub.cancel_at) && sub.cancel_at > 0 ? sub.cancel_at * 1000 : null;
    const accessEnd = cancellationEnd === null ? periodEnd : Math.min(periodEnd, cancellationEnd);
    const refunded = sub.metadata.gmailpro_refunded_invoice &&
      sub.metadata.gmailpro_refunded_invoice === idOf(sub.latest_invoice);
    const suspended = sub.metadata.gmailpro_risk_hold === 'true';
    const active = ['active', 'trialing'].includes(sub.status) && sub.metadata.gmailpro_fulfilled === 'true' &&
      !refunded && !suspended && Number.isFinite(accessEnd) && accessEnd > checkedAt;
    return { active, status: suspended ? 'review_required' : refunded ? 'refunded' : sub.status,
      checkedAt, validUntil: active ? Math.min(accessEnd, checkedAt + 24 * 60 * 60 * 1000) : checkedAt,
      renewsAt: Number.isFinite(accessEnd) ? accessEnd : null,
      trialEndsAt: Number.isFinite(trialEndsAt) ? Math.min(trialEndsAt, accessEnd) : null,
      cancelAtPeriodEnd: !!sub.cancel_at_period_end || cancellationEnd !== null };
  }
  async function status(key) {
    const review = reviewStatus(key);
    return review || statusOf(await retrieve(subscriptionForKey(key)));
  }
  async function checkout({ plan, purchaseToken }) {
    if (!config.launchEnabled) throw new BillingError('Subscriptions are being prepared. Please check back soon.', 503);
    if (!['month', 'year'].includes(plan) || !/^[a-f0-9]{64}$/.test(purchaseToken || '')) {
      throw new BillingError('Choose a valid subscription.');
    }
    const price = await stripe.prices.retrieve(plan === 'month' ? config.monthlyPrice : config.annualPrice);
    if (price.livemode !== config.livemode || !price.active || price.currency !== 'usd' ||
      price.unit_amount !== (plan === 'month' ? 99 : 1000) || price.recurring?.interval !== plan ||
      price.recurring.interval_count !== 1 || idOf(price.product) !== config.product) {
      throw new BillingError('Subscription pricing needs attention. Please contact support.', 503);
    }
    let session;
    try { session = await stripe.checkout.sessions.create({
      mode: 'subscription', line_items: [{ price: price.id, quantity: 1 }],
      client_reference_id: digest(purchaseToken),
      metadata: { application: 'gmail-pro', terms_version: legal.termsVersion, privacy_version: legal.privacyVersion },
      consent_collection: { terms_of_service: 'required' },
      subscription_data: { metadata: { application: 'gmail-pro', terms_version: legal.termsVersion,
        privacy_version: legal.privacyVersion }, billing_mode: { type: 'flexible' },
        trial_period_days: 7, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } },
      payment_method_collection: 'always',
      success_url: `${config.siteURL}/checkout-complete`, cancel_url: `${config.siteURL}/#pricing`,
      // Retries within this offer use identical parameters. Keep the token's
      // original key across deployments too: rotating it could duplicate a paid
      // Checkout whose response was lost. Stripe's expiry avoids a moving date.
      integration_identifier: 'gmailpro_' + digest(purchaseToken).slice(-8).replace(/[0-9]/g, digit => 'abcdefghij'[Number(digit)]),
      custom_text: {
        terms_of_service_acceptance: { message: `I am an adult purchasing for myself or permitting use by my child age 13+. I agree to the [Terms of Service](${legal.termsURL}) and acknowledge the [Privacy Policy](${legal.privacyURL}).` },
        submit: { message: `7 days free, then ${plan === 'month' ? 'US$0.99/month' : 'US$10/year'} plus any applicable tax, automatically renewed until canceled. Cancel before the trial ends to avoid the first charge. Manage or cancel at ${config.siteURL}/subscription-help. Seller: Rick Munoz, independent of Google.` }
      }
    }, { idempotencyKey: 'gmailpro-checkout-' + digest(purchaseToken) }); }
    catch (error) {
      if (error.type === 'StripeIdempotencyError' || error.rawType === 'idempotency_error') {
        throw new BillingError('This saved checkout needs recovery after a service update. Contact support with your Checkout email before starting another subscription.', 409);
      }
      throw error;
    }
    return { url: session.url, sessionId: session.id, expiresAt: session.expires_at * 1000 };
  }
  async function ownedCheckout({ sessionId, purchaseToken }) {
    if (!/^cs_(?:live|test)_[a-zA-Z0-9]+$/.test(sessionId || '') || !/^[a-f0-9]{64}$/.test(purchaseToken || '')) {
      throw new BillingError('No matching purchase was found.', 401);
    }
    let session;
    try { session = await stripe.checkout.sessions.retrieve(sessionId); }
    catch (error) {
      if (error.code === 'resource_missing') throw new BillingError('No matching purchase was found.', 401);
      throw error;
    }
    if (session.livemode !== config.livemode || session.mode !== 'subscription' ||
      session.metadata?.application !== 'gmail-pro' || !equal(session.client_reference_id, digest(purchaseToken))) {
      throw new BillingError('No matching purchase was found.', 401);
    }
    return session;
  }
  async function complete(input) {
    const session = await ownedCheckout(input);
    if (session.status === 'expired') throw new BillingError('Checkout expired. Start a new subscription.', 410);
    if (session.status !== 'complete' || !['paid', 'no_payment_required'].includes(session.payment_status) || !session.subscription) {
      throw new BillingError('Payment is not complete yet. Finish Checkout, then try again.', 409);
    }
    if (session.metadata?.terms_version && session.consent?.terms_of_service !== 'accepted') {
      throw new BillingError('Checkout agreement was not recorded. Please contact support.', 409);
    }
    const sub = await retrieve(idOf(session.subscription));
    // A trial Checkout keeps no_payment_required after the trial ends. Verify
    // ownership/fulfillment here; current canonical status controls access below.
    const state = statusOf(sub);
    // A signed webhook must fulfill the purchase. Redirects never grant access.
    if (sub.metadata.gmailpro_fulfilled !== 'true') {
      throw new BillingError('Payment received. Activation is still processing; try again shortly.', 409);
    }
    return { licenseKey: keyFor(sub.id), status: state };
  }
  async function cancelCheckout(input) {
    let session = await ownedCheckout(input);
    if (session.status === 'open') {
      try { session = await stripe.checkout.sessions.expire(session.id); }
      catch (error) {
        // Completion may win a concurrent request. Never cancel a subscription.
        session = await ownedCheckout(input);
        if (!['complete','expired'].includes(session.status)) throw error;
      }
    }
    if (session.status === 'complete') throw new BillingError('Checkout is complete. Finish activation instead.',409);
    if (session.status !== 'expired') throw new BillingError('Checkout could not be canceled. Please try again.',409);
    return { canceled: true };
  }
  async function portal(key) {
    if (reviewStatus(key)) throw new BillingError('Review access has no paid subscription.');
    const sub = await retrieve(subscriptionForKey(key));
    const session = await stripe.billingPortal.sessions.create({ customer: idOf(sub.customer),
      ...(config.portalConfiguration ? { configuration: config.portalConfiguration } : {}),
      return_url: `${config.siteURL}/subscription-help` });
    return { url: session.url };
  }
  const subscriptionOfInvoice = invoice => idOf(invoice?.parent?.subscription_details?.subscription || invoice?.subscription);
  async function subscriptionOfCharge(chargeId) {
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.invoice) return { id: subscriptionOfInvoice(await stripe.invoices.retrieve(idOf(charge.invoice))), charge, invoice: idOf(charge.invoice) };
    const intent = idOf(charge.payment_intent);
    if (!intent) return { charge };
    const payments = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intent }, limit: 10 });
    const invoiceIds = [...new Set(payments.data.map(item => idOf(item.invoice)).filter(Boolean))];
    // A normal subscription payment has one invoice. Ambiguity must be reviewed.
    if (payments.has_more || invoiceIds.length > 1) throw new Error('Ambiguous invoice payment mapping.');
    if (!invoiceIds.length) return { charge };
    const invoice = await stripe.invoices.retrieve(invoiceIds[0]);
    return { id: subscriptionOfInvoice(invoice), charge, invoice: invoice.id };
  }
  async function webhook(event) {
    if (!WEBHOOK_EVENTS.includes(event.type)) return;
    if (event.livemode !== config.livemode || (event.account && event.account !== config.account)) {
      throw new BillingError('Unexpected Stripe account or environment.', 400);
    }
    const object = event.data.object;
    let id, fulfilled = false, risk, refundedInvoice;
    if (event.type.startsWith('checkout.session.')) {
      // Re-read because an old event can arrive after the payment's state changed.
      const session = await stripe.checkout.sessions.retrieve(object.id);
      if (session.metadata?.application !== 'gmail-pro' || session.mode !== 'subscription') return;
      if (session.metadata.terms_version && session.consent?.terms_of_service !== 'accepted') {
        throw new BillingError('Checkout agreement was not recorded.', 409);
      }
      id = idOf(session.subscription);
      fulfilled = session.status === 'complete' && ['paid', 'no_payment_required'].includes(session.payment_status);
    } else if (event.type.startsWith('customer.subscription.')) id = object.id;
    else if (event.type.startsWith('invoice.')) {
      const invoice = await stripe.invoices.retrieve(object.id);
      id = subscriptionOfInvoice(invoice);
      fulfilled = event.type === 'invoice.paid' && invoice.status === 'paid';
    } else {
      const chargeId = event.type === 'charge.refunded' ? object.id : idOf(object.charge);
      if (!chargeId) throw new Error('Risk event has no charge.');
      const resolved = await subscriptionOfCharge(chargeId);
      id = resolved.id;
      risk = event.type !== 'charge.refunded';
      if (event.type === 'charge.refunded' && resolved.charge.refunded) refundedInvoice = resolved.invoice;
    }
    if (!id) return;
    const sub = await stripe.subscriptions.retrieve(id);
    if (!owns(sub)) return; // Never modify another product on the same Stripe account.
    const patch = {};
    if (sub.metadata.gmailpro_status !== sub.status) patch.gmailpro_status = sub.status;
    if (fulfilled && ['active', 'trialing'].includes(sub.status) && sub.metadata.gmailpro_fulfilled !== 'true') patch.gmailpro_fulfilled = 'true';
    if (risk && sub.metadata.gmailpro_risk_hold !== 'true') patch.gmailpro_risk_hold = 'true';
    if (refundedInvoice && refundedInvoice === idOf(sub.latest_invoice) &&
      sub.metadata.gmailpro_refunded_invoice !== refundedInvoice) patch.gmailpro_refunded_invoice = refundedInvoice;
    if (Object.keys(patch).length) await stripe.subscriptions.update(id, { metadata: patch });
    // No event-order comparison or read-modify-write counter: canonical status is
    // read during verification, and risk flags only add restrictions. Duplicates
    // are harmless; transient Stripe errors propagate so Stripe retries delivery.
  }
  return Object.freeze({ checkout, complete, cancelCheckout, status, portal, webhook });
}
