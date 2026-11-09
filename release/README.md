# Gmail Pro release

## November 9, 2026 — 1.0.7 recipient and startup fixes

Prepared from the canonical checkout for the owner-authorized public update.
Corrects To/CC grouping using native message Details, retains BCC, resumes
bounded read retries after temporary message rendering, and adds idle startup
recovery when early initialization is absent. The owner confirmed CC in Gmail
after reviewing/enabling the current agreement.

Validation: reading pane 47/47, automatic read 72/72, startup browser integration
3/3, settings/lifecycle 47/47, and consent 4/4. The exact intermittent mailbox
read-status case was not reproduced live. Version-only packaging follows those
checks; free access, consent versions and extension permissions are unchanged.

Submitted: `dist/Gmail-Pro-1.0.7.zip` (43 production files), SHA-256
`54d547ac9a54ca9fb4bf7201fb76b2290f362826dd7916bd306698e165b0f788`.

On November 9, the native Chrome interface successfully handled the upload
after the browser scripting interface could not attach to the Store dashboard.
A stale dashboard initially showed 1.0.6 pending review; after account-session
refresh, the Package page and public listing both showed 1.0.6 published.
The uploaded draft was verified as 1.0.7 before submission. Existing listing
copy, screenshots and promo video were preserved. The final dialog had
automatic publication checked, and Google confirmed **Your extension was
submitted for review**. This is a submission receipt; 1.0.7 approval and public
availability remain pending Google review. Version 1.0.6 was the public release
at submission time.


## November 8, 2026 — 1.0.6 layout and listing update

The owner authorized committing/pushing the layout fixes and submitting the
updated extension, overview and feature-card screenshots to Chrome Web Store.

- Package: `dist/Gmail-Pro-1.0.6.zip`, 43 production files.
- SHA-256: `8cccc452d7d7e4ca7588924ca77d5e4e843f0580d32c9c3a90d77a73231e15e4`.
- Compared byte-for-byte with the published 1.0.5 ZIP: only `manifest.json` and
  the three layout files (`appearance.js`, `appleMail.css`, `workspaceLayout.js`)
  changed. Free access, consent versions, permissions and billing code match.
- First-run setup now defers ordinary input, ignores hidden cached controls and
  respects active editing and explicit layout choices. Right-panel collapse
  retries are bounded, and its native edge arrow is themed and visible. The
  unsplit inbox shares themed scrollbar tracks/corners with the reading panes.
- The Store overview leads with the cleaner workspace and practical benefits.
  `node scripts/build-store-slides.cjs` prepares five 1280×800 feature slides from
  the website's 18 feature cards and approved, fictional-content screenshots.
  Rendered JPEGs stay under ignored `artifacts/store/1.0.6/`.
- Privacy categories retain accurate local-processing declarations. Google's
  [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
  explicitly includes local processing and email addresses; listing copy
  distinguishes those uses from Gmail content being uploaded to our service.
- Validation: 44 repository/settings checks; 44 consent/billing checks; the prior
  completed layout/appearance pass (16/16 and 80/80) plus three trusted-input
  fixtures. All five slides were visually reviewed at 1280×800 and checked for
  card/page overflow. This does not establish a live Store-installed fix.
- Submission receipt: Google confirmed **Your extension was submitted for review**
  on November 8. The draft package was verified as **1.0.6** while Published
  remained **1.0.5**. All five feature screenshots and the 4,555-character
  overview were saved; private reviewer notes were updated to 443 characters.
- Existing automatic publication remained checked in the final confirmation.
  Google approval/rollout is still pending. The public 1.0.5 installation is not
  proof of the 1.0.6 fixes; a Store-installed smoke test follows availability.
- Readiness and submission evidence are local-only under
  `artifacts/store/1.0.6/`, including package/slide checksums and the receipt.

## Current offer — November 7, 2026

The owner authorized public free access. Version 1.0.5 removes the subscription
gate while retaining affirmative legal consent. Planned prices are crossed out
on the website; no card, license, trial or automatic future charge is required.
New Checkout is blocked in the worker and HTTP service; keep sales disabled.
Stripe live read-only checks found no subscriptions and no open Checkout sessions.
Free package validation and Google publication status are recorded below.

## Historical paid-launch setup (superseded offer)

The public site is https://gmail-pro.netlify.app. The Chrome Web Store release
has not been published. Production sales remain closed until acceptance below
is complete. The unpacked owner/development checkout remains usable locally.

On November 4, the owner resumed launch preparation. Stripe reports live charges
and payouts enabled. The restricted server key is saved in Netlify Production;
its live Checkout-read permission was verified after deployment. Payment journeys
have been exercised in the dedicated account’s Stripe Test mode.
Website and extension checkout share the same 30-day trial and license service.
The Chrome Web Store draft is `aemijichdmmlihokhlianpllklnjnnfm`; its package,
description, icon, actual fictional-content light/dark screenshots, privacy fields,
and in-app-purchases distribution setting are saved. It was submitted for review on November 4, 2026, with automatic publication
disabled. Google must approve it before the staged package can be published.
Sales remain closed while store publication and payment acceptance are unfinished.

## Offer and services

- US$0.99/month or US$10/year, 30 days free on either plan.
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

## November 5 offer and icon update

New Checkout sessions now request 30 trial days on either plan. Existing subscriptions
retain their Stripe trial dates; no existing subscription was changed. Historical
seven-day test results above describe the previous offer. Current focused checks
cover 30-day Checkout parameters and access through the trial boundary.

Version 1.0.3 includes the blue icon and updated popup offer/terms links. This is
a new candidate, not the already approved package; uploading it requires another
Google review. Preserve the approved package until the launch route is decided.

## November 5 resubmission and Stripe verification

Version 1.0.3 was uploaded and submitted to Google for review, with automatic
publication disabled. The listing uses the blue icon and 30-day offer.
The website has identical blue-icon headers on all current and archived pages;
only navigation chrome changed in archived legal pages.

The production Checkout service requests 30 trial days for both plans. Actual
Stripe Test mode hosted checkouts showed 30 days free, then $0.99 monthly or
$10 annually beginning December 5, 2026. Both required payment details and
recorded the new terms version. Those unpaid test carts were expired afterward.
The live webhook and customer portal configuration were rechecked: lifecycle,
failed payments, refunds and risk events remain enabled; cancellation, card
updates and invoice history remain available. No live subscriptions, payments,
or existing trial dates were modified. Sales remain closed pending approval
and the final installed-store/live Checkout checks.

## November 5 prelaunch readiness and tax decision

- Website footer now wraps the wordmark as a single flex child, preserving the
  normal space between Gmail and Pro without the extra flex gap. This is a
  website-only change; the submitted 1.0.3 ZIP remains unchanged.
- Owner reports Colorado/Denver, no tax registrations, and worldwide sales intent.
  Confirm the actual physical tax jurisdiction before government filings; a
  postal city is not a jurisdiction determination.
- Stripe Tax setup was initialized using the existing Stripe business profile.
  Live Tax Settings now report active. The inherited account preset remains
  General Electronically Supplied Services, with inferred-by-currency tax behavior.
  There are no active tax registrations, the Gmail Pro Product has no tax code,
  and its two Prices still have unspecified tax behavior. Those decisions were
  not changed or represented as complete.
- Server supports opt-in automatic tax using GMAIL_PRO_AUTOMATIC_TAX_ENABLED.
  It remains off. When enabled, Checkout requires an explicit Price tax behavior
  and Product tax code, and sends automatic_tax.enabled=true while preserving
  the 30-day trial. Confirm registrations, classification and fees and run an
  actual jurisdiction calculation before enabling collection; this code does
  not register or file taxes for the operator.
- Worldwide tax route is undecided. Managed Payments setup is a saved inactive
  draft; no category was saved, activation terms were not accepted and the owner
  has not approved the 3.5% add-on. Standard Tax Basic does not transfer the
  operator's registration/filing responsibilities. No paid tax plan, filing
  service or government registration was purchased or submitted.
- Product/price reads, support form definition and production failure checks
  were refreshed. Sales stay disabled; checkout returns 503, unsigned webhook
  requests return 400, and unrecognized origins return 403. No live checkout or
  purchase was created in this pass. Final live restricted-key create/expire,
  portal and installed-store checks remain release gates.
- Current checks: 44 extension checks and 41 billing/consent tests passed.

Relevant sources checked November 5, 2026:
- https://tax.colorado.gov/sales-use-tax-topics-computer-software (rules change
  January 1, 2027; state-administered rules do not cover every home-rule city).
- https://www.denvergov.org/files/assets/public/v/1/finance/documents/treasury/tax-guides/tax-update-2025/taxguidetopic18_software.pdf
- https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Department-of-Finance/Our-Divisions/Treasury/Business-Tax-Information
- https://stripe.com/tax/pricing
- https://stripe.com/managed-payments
- https://docs.stripe.com/payments/managed-payments/eligibility
- https://www.gov.uk/government/publications/vat-notice-7001-should-i-be-registered-for-vat/vat-notice-7001-should-i-be-registered-for-vat

The owner asked whether tax can wait until sales begin. Paid tax enrollment can
wait while sales remain closed; obligations in intended launch markets must be
resolved before accepting the applicable taxable transactions. Some overseas
markets have no small-seller threshold for a non-established seller. A free trial
is not treated here as permission to bypass tax readiness.

### Stripe account follow-up found in the readiness check

Live account reads show charges_enabled=true, payouts_enabled=true and statement
descriptor GMAIL PRO, with the correct website and support URLs. However,
individual.verification.document_live_capture appears in both currently_due and
past_due; disabled_reason is null. The owner must complete Stripe's live identity
verification directly. Enabled payments are not evidence that all onboarding
requirements are cleared.

The Dashboard Account status screen, inspected after the API read, reports
“No active tasks to complete.” There is no live-capture task to hand off there
currently, despite the API requirement fields. Recheck before launch and clarify
with Stripe if the discrepancy persists; do not claim identity review is cleared
or repeatedly ask the owner to upload documents without an available task.

### Approved billing notifications

The owner explicitly approved automated billing emails. Saved Stripe settings now
have trial-ending reminders (seven days before the 30-day trial ends), upcoming
renewal reminders, expiring-card notices, failed-card-payment emails and failed
bank-debit-payment emails enabled. This changes future notifications, not the
trial length. No email was manually sent in this pass. Other billing defaults
were preserved. Managed Payments remains an inactive onboarding draft; its
product-category preview was canceled without saving a category.

## November 6 updated review submission

Google showed version 1.0.3 as Ready to publish before this task. It was not
published. The current checkout also includes the November 6 toolbar fixes for
icon colors and native Refresh placement beside Select, which postdated the
older ZIP. The owner requested submission of the updated package.

- Incremented the extension manifest to **1.0.4** and built a production-only ZIP
  from the current canonical checkout, with subscription verification required.
- Returned the approved staged item to draft, uploaded `dist/Gmail-Pro-1.0.4.zip`,
  and verified the version shown on Google's Package page.
- Confirmed the existing listing already describes the 30-day trial and matches
  the live website. Updated the private reviewer instructions (497 characters)
  for the current agreement and toolbar flow, preserving the reviewer credential.
- Explicitly unchecked automatic publication before submitting. Google displayed
  **Your extension was submitted for review** and its staged-publication notice.
  This is review submission, not Google approval or public publication.
- Verified `salesEnabled:false` after submission. No sales, payment or public
  publication was enabled. No commit, push or website deployment was performed.
- SHA-256: `c673669c898bd2706aeef97690c13c1a11ffb6d75cc95706d335c0012087f047`.

Validation: repository validation passed all 44 settings checks plus manifest,
resources, syntax and permission checks; the consent/billing suite passed 41
checks. Production popup and appearance browser fixtures passed 24/24 and 79/79.
The full header fixture at the test browser's narrower default viewport passed
125 checks and failed one width-threshold assertion. That isolated assertion
passed at a 1600px viewport, which accommodates its 1400px fixture workspace
(the fixture uses `max-width:100vw`). No source change or weakened assertion was
needed. This was not a repeat of the whole header suite at the wider viewport.
The temporary viewport override and fixture server were cleaned up.

Plain-English Summary:
- Submitted the latest toolbar fixes as version 1.0.4 for Google review.
- Automatic publication and paid sales remain off.
- Automated checks and focused browser verification completed as detailed above.
- Google approval, legal decisions and paid-launch acceptance remain separate.
- Suggested Conventional Commit: `chore(release): submit Gmail Pro 1.0.4 for review`.


## November 7, 2026 — Free public release submitted

The owner explicitly authorized publication as free for now. Google had approved
1.0.4 but it still required a subscription, so it was returned to Draft and
replaced with the verified free 1.0.5 package before publication.

- ZIP: `dist/Gmail-Pro-1.0.5.zip` (43 production files).
- SHA-256: `2b9cf6394146eb2d67e89c763294e4af635b430a3d85cce10d489792950babbf`.
- Packaged config: `required:false`, `free:true`; affirmative versioned consent
  still gates every mail feature. New terms/privacy versions: `2026-11-07.1`.
- No new-user payment, trial or license prompt. Website planned monthly/annual
  prices are crossed out with Free for now labels; no automatic future charge.
- Worker and deployed HTTP service both reject new Checkout. Public config
  reports `salesEnabled:false` and `free:true`, even if the launch flag is enabled.
- Live Stripe read-only audit found zero subscriptions (all statuses) and zero
  open Checkout sessions; no financial state was changed.
- Google distribution saved as Free of charge, Public, All regions. Public
  listing and permission justifications describe free access; obsolete reviewer
  license removed. New private reviewer instructions: 487 characters.
- Submission dialog explicitly had automatic publication checked. Google then
  confirmed: Your extension was submitted for review. This is a review receipt,
  not confirmation of public availability; Google controls approval timing.
- Website/service production deploy `6aef6d7001f1892c1fe1f264` verified live:
  homepage free pricing, current/permanent legal pages HTTP 200, config free,
  direct new Checkout HTTP 503 with no payment required. Final copy-only
  deploy `6aef6e89fed2b4c4fbb0a706` adds the direct store link for availability
  after approval; its live markup and free public config were verified.
- Verification: repository validation/settings checks passed; focused consent,
  billing lifecycle/worker/service/web tests 44/44; actual-popup synthetic browser
  fixture 25/25. Desktop pricing inspected; 390px layout has no horizontal
  overflow, both planned prices are struck through, and no checkout controls or
  checkout initialization script exists on the homepage.
- ZIP config/version and production-only contents inspected. No content-script
  source was changed. No actual signed-in Gmail/store-install test, CI result,
  payment transaction, legal clearance or counsel review is asserted.

All previous paid-launch offer instructions above are historical. Do not enable
paid sales for this free release. A future paid release needs separate purchase
consent and renewed billing/tax validation before accepting payments.
