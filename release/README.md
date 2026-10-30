# Gmail Pro 1.0 release

The public site is https://gmail-pro.netlify.app. The Chrome Web Store release
has not been published. Production sales remain closed until acceptance below
is complete. The unpacked owner/development checkout remains usable locally.

On October 29, the owner deferred Stripe activation and store publication while
the personal Gmail interface issues are being resolved. Keep those launch steps
deferred until the owner resumes them.

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
- Support uses the hosted Netlify form; no public personal email was authorized.

IDs are configuration, not credentials. Never put Stripe API keys, webhook
secrets, license signing secrets, customer keys or actual mail into this repo.

## Server configuration

Use the variables documented in `website/.env.example`. Keep actual values in
Netlify's production environment. The webhook and license signing secrets are
already stored there; preserve them. Rotating the license signing secret
invalidates all issued licenses.

Still required: a restricted Stripe server key and the final store extension
ID. The owner must finish Stripe activation and review the final legal/account
submission. Create separate sandbox credentials/configuration for payment tests.
Do not use real cards or production purchases to simulate test payments.

The service needs price reads, Checkout session create/retrieve, subscription
retrieve/update (application metadata), customer portal session create, and
charge/invoice/invoice-payment reads for refund and risk events. Start other
permissions at None and verify the exact resource labels in Stripe's key UI.
Store the key as the secret `STRIPE_RESTRICTED_KEY` directly in Netlify; do not
paste it into chat, source, shell history or the extension.

`GMAIL_PRO_LAUNCH_ENABLED=false` keeps new Checkout sessions closed. Status,
activation and the customer portal remain available once configuration is valid.
Add the published store ID to `GMAIL_PRO_EXTENSION_IDS`; the canonical local
installation currently has ID `kkddeggjgdhlihdkingjkmahonjipcfd`.

The server allows only the two configured prices and validates their actual
amount/currency/recurrence. A signed Stripe webhook fulfills each purchase;
the success-page redirect does not grant access. Licenses are signed references
to Stripe's canonical subscription, not a separate customer database.

## Acceptance before sales and submission

- [ ] Stripe account activated for live charges and payouts; public business
  details, statement descriptor and operator information reviewed.
- [ ] Restricted server key installed securely and its permissions verified.
- [ ] Tax setup and intended selling regions reviewed by the owner; optional
  Stripe Tax has not been enabled automatically.
- [ ] Sandbox monthly and annual Checkout both show seven days free, then
  exactly the intended recurring price; payment details are required.
- [ ] Returning from a canceled or incomplete Checkout grants no access.
- [ ] Signed webhook activates a completed trial; duplicate/reordered events
  do not create a second license or restore restricted access.
- [ ] Trial expiry, first successful payment, failed payment, cancellation,
  paid-period expiry, refund and risk hold verified against Stripe sandbox.
- [ ] Customer portal cancellation and payment-method update verified.
- [ ] Restoring a license, temporary service outage and returning online verified
  in an actual packaged store build, including the 24-hour/period-end bound.
- [ ] Actual, sanitized Gmail Pro screenshots reviewed and uploaded; no real
  message, sender, recipient, label, avatar or account information appears.
- [ ] Store description, permissions, privacy disclosures and support URL saved.
- [ ] Private, expiring reviewer access supplied in the store's review notes.
  Put only its hash/expiry in server configuration; do not commit the key.
- [ ] Store extension ID added to the server allowlist.
- [ ] All local checks and relevant Chrome fixtures pass after final edits.
- [ ] Owner handles any registration fee, new terms or identity/bank verification.
- [ ] After review approval, store link replaces the website's preparation notice.
- [ ] Set launch enabled only after these gates pass, redeploy and verify the
  public-config endpoint and the installed extension's purchase flow.

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
