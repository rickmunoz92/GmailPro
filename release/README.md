# Gmail Pro 1.0 release

The public site is https://gmail-pro.netlify.app. The Chrome Web Store release
has not been published. Production sales remain closed until acceptance below
is complete. The unpacked owner/development checkout remains usable locally.

On November 4, the owner resumed launch preparation. Stripe reports live charges
and payouts enabled. The restricted server key is saved in Netlify Production;
its live Checkout-read permission was verified after deployment. Payment journeys
have been exercised in the dedicated account’s Stripe Test mode.
Website and extension checkout share the same seven-day trial and license service.
The Chrome Web Store draft is `aemijichdmmlihokhlianpllklnjnnfm`; its package,
description, icon, actual fictional-content light/dark screenshots, privacy fields,
and in-app-purchases distribution setting are saved. It was submitted for review on November 4, 2026, with automatic publication
disabled. Google must approve it before the staged package can be published.
Sales remain closed while store publication and payment acceptance are unfinished.

## Offer and services

- US$0.99/month or US$10/year, seven days free on either plan.
- Payment details required at Checkout; automatic renewal after the trial.
- Cancel before the trial ends to avoid the first charge. Later cancellation
  stops renewal at the end of the current period.
- Auto BCC defaults off. Do not enable it for screenshot capture or review.
- Dedicated Stripe account: `acct_1UP6cGPINTpCb9YV` (GMAILPRO).
- Product: `gmail_pro_subscription`.
- Monthly price: `price_1UW5k4PINTpCb9YVQ4OyNIPJ`.
- Annual price: `price_1UW5k5PINTpCb9YV5lzgJ40I`.
- Customer portal: `bpc_1UW624PINTpCb9YVbwbwtLwm`.
- Webhook: `we_1UW6CiPINTpCb9YVF27Ihwek` at `/api/billing/webhook`.
- Netlify site: `eeedc220-c1b7-499c-bfb6-5f47acb5537a`.
- Website support uses the hosted Netlify form. The owner approved
  `rmunoz.rams@gmail.com` as the public Chrome Web Store publisher contact on
  November 4; Google verified it. Publisher display name: Rick Munoz.

IDs are configuration, not credentials. Never put Stripe API keys, webhook
secrets, license signing secrets, customer keys or actual mail into this repo.

## Server configuration

Use the variables documented in `website/.env.example`. Keep actual values in
Netlify's production environment. The webhook and license signing secrets are
already stored there; preserve them. Rotating the license signing secret
invalidates all issued licenses.

Still required: Google approval, coordinated store publication/checkout opening, and a
Chrome smoke test of the eventual installed store distribution. The owner handles any remaining Stripe identity follow-up.
Create separate sandbox credentials/configuration for payment tests.
Do not use real cards or production purchases to simulate test payments.

The service needs price reads, Checkout session create/retrieve/expire, subscription
retrieve/update (application metadata), customer portal session create, and
charge/invoice/invoice-payment reads for refund and risk events. Start other
permissions at None and verify the exact resource labels in Stripe's key UI.
Store the key as the secret `STRIPE_RESTRICTED_KEY` directly in Netlify; do not
paste it into chat, source, shell history or the extension.

`GMAIL_PRO_LAUNCH_ENABLED=false` keeps new Checkout sessions closed. Status,
activation and the customer portal remain available once configuration is valid.
`GMAIL_PRO_EXTENSION_IDS` contains the draft store ID and the canonical local
installation ID `kkddeggjgdhlihdkingjkmahonjipcfd` in Production. Reviewer access
is limited by a private hash and expiry; the raw key stays in ignored local
release artifacts and the private review field only.

The server allows only the two configured prices and validates their actual
amount/currency/recurrence. A signed Stripe webhook fulfills each purchase;
the success-page redirect does not grant access. Licenses are signed references
to Stripe's canonical subscription, not a separate customer database.

## Review submission and paid-launch checks

- [ ] Stripe account activated for live charges and payouts; public business
  details, statement descriptor and operator information reviewed.
- [x] Restricted server key installed as a Netlify Production secret.
- [x] Live restricted key can read Checkout sessions through the deployed
  service; other configured permissions were prepared in Stripe’s key UI.
- [ ] Final live Checkout create/expire and portal smoke checks when sales open.
- [ ] Tax setup and intended selling regions reviewed by the owner; optional
  Stripe Tax has not been enabled automatically.
- [x] Stripe Test mode monthly and annual Checkout both show seven days free, then
  exactly the intended recurring price; payment details are required.
- [x] Website purchase/activation and the packaged extension billing worker
  verified against real Stripe Test mode through a local test transport.
  This is not a Chrome-installed store-build smoke test.
- [x] Returning from canceled/incomplete Checkout grants no access; the
  packaged worker opens Checkout and refuses those activations.
- [x] Signed webhook activates a completed trial; duplicate/reordered events
  do not create a second license or restore restricted access.
- [x] Real Test mode: trial expiry/cancellation, first $10 annual payment, failed
  renewal, payment recovery, full refund, scheduled cancellation and paid-period
  expiry verified with Stripe test clocks. Risk holds remain covered by local tests.
  One transient test-clock write lock propagated for retry; replay after the
  clock became ready preserved cancellation and produced no duplicate write.
- [x] Customer portal opens the correct test subscription and schedules
  cancellation without removing access before its end. Payment-method management
  is available in the portal.
- [ ] Actual payment-method update UI smoke test; not exercised in this run.
- [ ] Restoring a license, temporary service outage and returning online verified
  in an actual packaged store build, including the 24-hour/period-end bound.
- [x] Actual light/dark Gmail Pro screenshots captured with fictional content
  for the website; capture helper removed from the normal unpacked build.
- [x] Store screenshots uploaded; no real
  message, sender, recipient, label, avatar or account information appears.
- [x] Store description, permissions, privacy disclosures and support URL saved.
- [x] Private, expiring reviewer access supplied in the store's test instructions.
  Put only its hash/expiry in server configuration; do not commit the key.
- [x] Store extension ID added to the Production server allowlist.
- [x] Local validation: 44 settings/lifecycle checks, 31 billing checks,
  22 popup checks, 78 appearance checks, and blocked/corrupt-storage management
  browser checks pass. Website checked at desktop and 390px mobile width.
  These mocks and fixtures do not replace real Stripe payment acceptance.
- [ ] Owner handles any registration fee, new terms or identity/bank verification.
- [x] Submitted to Google with the publisher email verified and automatic
  publication off. The website accurately says it was submitted.
- [ ] After review approval, store link replaces the website's submission notice.
- [ ] Set launch enabled only after these gates pass, redeploy and verify the
  public-config endpoint and the installed extension's purchase flow.

## Legal and consent revision — November 4, 2026

The earlier submitted package is 1.0.0. The replacement 1.0.2 package adds
explicit adult/guardian and Terms/Privacy acceptance before any Gmail mail tool
runs, versioned local agreement records, a withdrawal control, and required
Stripe Checkout terms acceptance. The current Terms version is `2026-11-04.2` and Privacy is `2026-11-04.1`;
matching immutable copies ship under `website/public/legal/`.

The owner confirmed Rick Munoz, Colorado, USA as operator; users 13+ with an
adult accepting/authorizing minors; and keeping the name pending trademark
counsel review. This is not a trademark clearance or legal opinion.

The owner authorized deployment and replacement submission. The website/service
was deployed and 1.0.2 resubmitted to Google with automatic publication off; its
status is Pending review. Stripe policy/support URLs are saved, and an actual
hosted Test mode Checkout shows the unchecked terms agreement and current
policy links. Public sales remain off. See the receipts and remaining acceptance
in [legal readiness](legal-readiness.md).
Earlier checked items below record the prior release work, not proof that this
replacement has passed live acceptance.

## Build and deployment

```sh
npm ci
npm test
npm run package:store
```

The ZIP in `dist/` contains only production extension files. Packaging rewrites
the billing configuration to `required:true` and rejects content scripts outside
its explicit production file list. Verify its manifest, references, privacy URLs
and SHA-256 before uploading. A ZIP build is not a store publication.

The site is deployed separately with `npm run deploy:production -- --site
eeedc220-c1b7-499c-bfb6-5f47acb5537a`. Verify the published HTML and support form
afterward. Changes in this local checkout do not reach Chrome until extension
Reload followed by a Gmail refresh, and do not reach Netlify until deployment.

## Authentic screenshot capture

`capture-preview.js` is a development-only helper for the real Gmail page,
not a recreated marketing interface. It replaces displayed inbox text with
fictional examples, hides images/secondary panels and makes the page inert.
It has no Gmail API, mail action, storage, fetch or messaging call. This affects
display only; reload without the helper restores the real view.

To use it temporarily in the canonical unpacked build, add
`capturePreview:true` to the development billing config and load
`release/capture-preview.js` at document_idle for Gmail. Open Inbox with no draft
or conversation open, reload the extension and Gmail, then check
`html[data-gp-capture-ready]` and visually review every pixel before saving.
Restore both development files and reload again immediately afterward.
The packaging guard rejects this helper if it is left in the manifest.
Keep generated capture files in ignored `artifacts/` until explicitly approved
for the website/store; never publish raw personal-inbox screenshots.

## References

- [Restricted Stripe keys](https://docs.stripe.com/keys/restricted-api-keys)
- [Stripe subscription testing](https://docs.stripe.com/billing/testing)
- [Chrome Web Store user-data requirements](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Store copy and reviewer checklist](store-listing.md)
