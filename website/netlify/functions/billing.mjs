import StripeClient from 'stripe';
import { BillingError, createBillingService } from '../../lib/billing.mjs';

const env = key => globalThis.Netlify?.env?.get(key) ?? process.env[key];
function configuration() {
  const result = {
    siteURL: env('GMAIL_PRO_SITE_URL'), account: env('GMAIL_PRO_STRIPE_ACCOUNT'),
    product: env('GMAIL_PRO_STRIPE_PRODUCT'), monthlyPrice: env('GMAIL_PRO_MONTHLY_PRICE'),
    annualPrice: env('GMAIL_PRO_ANNUAL_PRICE'), licenseSecret: env('GMAIL_PRO_LICENSE_SECRET'),
    livemode: env('GMAIL_PRO_LIVEMODE') === 'true', launchEnabled: env('GMAIL_PRO_LAUNCH_ENABLED') === 'true',
    portalConfiguration: env('GMAIL_PRO_PORTAL_CONFIGURATION'),
    reviewKeyHash: env('GMAIL_PRO_REVIEW_KEY_HASH'), reviewExpiresAt: env('GMAIL_PRO_REVIEW_EXPIRES_AT')
  };
  if (!result.siteURL || !/^https:\/\/[^/]+$/.test(result.siteURL) || !result.account || !result.product ||
    !result.monthlyPrice || !result.annualPrice || (result.licenseSecret?.length ?? 0) < 43 ||
    !env('STRIPE_RESTRICTED_KEY') || !env('STRIPE_WEBHOOK_SECRET')) {
    throw new BillingError('Subscriptions are being prepared. Please check back soon.', 503);
  }
  return result;
}
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
export default async function handler(request) {
  try {
    const path = new URL(request.url).pathname.split('/').at(-1);
    if (path === 'public-config' && request.method === 'GET') {
      let ready = false;
      try { ready = configuration().launchEnabled; } catch { /* do not expose configuration */ }
      return Response.json({ salesEnabled: ready, monthly: 99, annual: 1000, currency: 'usd' }, { headers });
    }
    if (request.method !== 'POST') throw new BillingError('Method not allowed.', 405);
    const settings = configuration();
    const stripe = new StripeClient(env('STRIPE_RESTRICTED_KEY'), { apiVersion: '2026-09-30.endive',
      timeout: 8000, maxNetworkRetries: 1 });
    const service = createBillingService({ stripe, config: settings });
    if (path === 'webhook') {
      const signature = request.headers.get('stripe-signature');
      if (!signature) throw new BillingError('Missing webhook signature.', 400);
      if (Number(request.headers.get('content-length')) > 1048576) throw new BillingError('Request too large.', 413);
      const body = await request.text();
      if (Buffer.byteLength(body) > 1048576) throw new BillingError('Request too large.', 413);
      let event;
      try { event = stripe.webhooks.constructEvent(body, signature, env('STRIPE_WEBHOOK_SECRET')); }
      catch { throw new BillingError('Invalid webhook signature.', 400); }
      await service.webhook(event);
      return Response.json({ received: true }, { headers });
    }
    const origin = request.headers.get('origin');
    const extensionOrigins = (env('GMAIL_PRO_EXTENSION_IDS') || '').split(',').filter(id => /^[a-p]{32}$/.test(id))
      .map(id => 'chrome-extension://' + id);
    if (origin && origin !== settings.siteURL && !extensionOrigins.includes(origin)) throw new BillingError('Unrecognized origin.', 403);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new BillingError('JSON is required.', 415);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2048) throw new BillingError('Request too large.', 413);
    let input;
    try { input = JSON.parse(raw); } catch { throw new BillingError('Invalid request.'); }
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new BillingError('Invalid request.');
    let response;
    if (path === 'checkout') response = await service.checkout(input);
    else if (path === 'complete') response = await service.complete(input);
    else if (path === 'status' || path === 'portal') {
      const key = request.headers.get('authorization')?.replace(/^Bearer /, '');
      response = path === 'status' ? await service.status(key) : await service.portal(key);
    } else throw new BillingError('Not found.', 404);
    return Response.json(response, { headers });
  } catch (error) {
    // Never emit Stripe payloads, license keys, billing details or request bodies.
    const known = error instanceof BillingError;
    if (!known) console.error('gmail-pro-billing-request-failed');
    return Response.json({ error: known ? error.message : 'Billing is temporarily unavailable. Please try again.' },
      { status: known ? error.status : 503, headers });
  }
}
export const config = { path: '/api/billing/*', rateLimit: {
  action: 'rate_limit', aggregateBy: ['ip', 'domain'], windowLimit: 120, windowSize: 60
} };
