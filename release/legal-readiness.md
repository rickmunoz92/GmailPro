# Gmail Pro legal and release readiness

Prepared November 4, 2026 for Rick Munoz, Colorado, USA. This is a product and
implementation risk review, with proposed terms for qualified counsel to review;
it is not a legal opinion or a promise that claims cannot be brought.

## Decisions and changes

- Operator: Rick Munoz personally. No company, registered address, trademark
  license, insurance coverage or international legal representative is assumed.
- Audience: general audience age 13+. An adult contracts for themselves or as
  parent/legal guardian for a minor. Purchasers must be adults. No under-13 flow
  or verified parental-consent service is implemented.
- Brand: keep Gmail Pro pending trademark counsel review, as the owner chose.
- Current Terms `2026-11-04.2` and Privacy `2026-11-04.1`: explicit assent, mail-action and BCC warnings,
  subscription/renewal/cancellation/refund terms, compatibility and warranty
  limits, a liability cap with mandatory-law exceptions, business-only third-party
  claim responsibility, Colorado law subject to mandatory local protections,
  minors, accurate storage/transmission/retention, and privacy request procedures.
- First use: unchecked adult and agreement confirmations; no mail feature starts
  and no automatic content-script license check occurs before current acceptance.
  Both owner and packaged builds enforce this. On install, the extension opens
  the disclosure page. Updated installs require it when the popup is opened.
- Local evidence: trusted-context record of terms/privacy versions, timestamp and
  adult confirmation. It is not uploaded, identity-verified, or tamper-proof.
  Each browser must accept; erased or outdated records require acceptance again.
- Withdrawal: stops the mail tools and preserves settings. It cannot recall sent
  mail, remove inserted draft recipients, reverse Gmail changes, or cancel billing.
  Subscription management, license restoration and support stay available.
- Checkout: new sessions require Stripe's Terms checkbox and link immutable legal
  versions; session/subscription metadata records offered versions. Stripe stores
  the consent result. New sessions missing recorded agreement cannot complete
  activation or Checkout-event fulfillment. Legacy sessions are not falsely
  treated as having accepted new terms.
- No mandatory arbitration, standalone class-action waiver or sweeping consumer
  indemnity has been added. Counsel should evaluate any proposed change in light
  of enforceability, consumer law and the cost of administering disputes.

## Risks that wording cannot resolve

| Priority | Risk and action before public sales |
| --- | --- |
| High | **Trademark:** Google's guidance discourages including Google trademarks in another product/brand/domain name. A disclaimer does not confer permission. Counsel must assess Gmail Pro, the domain, store presentation and any Google/Apple design assets. The owner retained the name pending that review. |
| High | **Personal exposure:** operating as an individual does not create a separate liability entity. Discuss an appropriate business entity, Colorado trade-name requirements, and technology E&O/cyber coverage; an entity or policy does not eliminate all liability. No entity or insurance was created here. |
| High | **Worldwide/minor availability:** “safe for everyone” is not a geographic compliance decision. Before broad distribution/sales, assess applicable child/teen privacy rules, age/guardian authorization, contract capacity, international transfers, local withdrawal/refund rights, trader contact/address requirements, tax and any EU/UK representative duties. A checkbox is self-attestation, not proof of a guardian's identity. No geofence or under-13 processing is provided. |
| High | **Renewals:** confirm Stripe's durable trial/price/cancellation acknowledgement, trial-ending reminders, renewal reminders, receipts, and required price-change notices in both live and test settings. Test an actual customer cancellation and confirm no new assent is required. The code does not implement a separate email-notification service. |
| High | **BCC and destructive actions:** users must authorize the chosen recipient across affected accounts. Continue keeping Auto BCC off by default. Consent/terms do not excuse bugs that misaddress, send, archive or delete mail. Existing Gmail compatibility and shortcut safeguards still need focused release acceptance. |
| Normal | **Privacy operations:** maintain a monitored support route, proportionate identity verification, access/deletion/appeal handling, provider retention knowledge and an incident-response process. Do not promise deletion from Google/Stripe/Netlify without checking records and legal retention. |
| Normal | **Taxes:** existing Checkout deliberately does not enable automatic tax without verified registrations. Confirm sales-tax/VAT/GST obligations and active registrations before enabling collection; a clause saying tax may apply is not tax setup. |

## Publication status and exact next steps

At the live dashboard check in this work, store item
`aemijichdmmlihokhlianpllklnjnnfm` was **Pending review**. Existing automatic
publication was reported off in the release record; verify it in the final
submission. No approval or public launch is implied by a ZIP or passing tests.

1. Review the revised terms, privacy and first-use disclosure with counsel,
   especially the brand, operator identity, minors and countries offered.
2. Publish the website/service including `/terms`, `/privacy` and immutable
   `/legal/terms-2026-11-04-2` and `/legal/privacy-2026-11-04-1`. Keep sales disabled.
3. In Stripe Public details, confirm Terms and Privacy URLs. Stripe requires a
   configured Terms URL before `consent_collection.terms_of_service=required` can
   work. Confirm support details, cancellation URL and notification settings.
   Verify an actual hosted test-mode Checkout shows the unchecked required
   agreement and correct recurring price/trial, and that its consent result is
   `accepted` after test completion. Mock tests alone do not prove this.
4. For the pending store submission, use **Cancel review** to return to draft;
   upload the complete `dist/Gmail-Pro-1.0.2.zip`, replace the detailed description
   from `release/store-listing.md`, and update test instructions for the consent
   step. Never put the private reviewer key in public copy or Git.
5. Inspect the live Privacy definitions and ensure categories cover actual
   handling: personal identifiers, personal communications, website content,
   license/purchase authentication and relevant payment/transaction data. Local
   processing is still handling user data. Keep the canonical Privacy URL,
   minimal permission justifications, no-remote-code declaration, single-purpose
   statement and all applicable Limited Use certifications accurate.
6. Resubmit for review with automatic publication off. Record the package version,
   final status and privacy selections. Do not click Publish item or open sales
   until outstanding release acceptance and legal decisions are resolved.

### Completed publication receipts

- Owner authorized deployment and replacement submission in this chat.
- Final production deploy: `6aec12ad51f3708e0e39fc3d` at
  https://gmail-pro.netlify.app. Live canonical Terms/Privacy and current immutable
  versions were verified against source after deployment; public sales stay off.
- Stripe account `acct_1UP6cGPINTpCb9YV`: Public details previously had blank
  Terms, Privacy and support URLs. Saved `/terms`, `/privacy` and `/support` URLs
  on the production hostname. A hosted Test mode Checkout from current service
  code successfully required and rendered the agreement. Renewal/trial reminder
  settings were not changed or verified in this run.
- Canceled the pending 1.0.0 review, uploaded 1.0.2 after the naming correction,
  saved the revised listing and privacy storage/host justifications, and saved
  485-character test instructions while preserving the existing private reviewer
  credential. Google confirmed submission; final visible status: **Pending review**.
- Explicitly unchecked **Publish Gmail Pro automatically after it has passed
  review** before resubmitting. Approval and public publication remain separate.
- Live store privacy declarations checked: personally identifiable information,
  financial/payment information, authentication information, personal
  communications, location (the dashboard includes IP address), website content.
  Health information, web history and user-activity logging remain unchecked;
  all three Limited Use certifications are checked. Privacy URL remains `/privacy`.
- Final ZIP: `dist/Gmail-Pro-1.0.2.zip`; SHA-256:
  `5884a60840474fa819f2a8cb3d5cdc401ed1872a05dfc1bf120b8a72b06784b5`.
- No Git commit or push was requested or performed. Existing uncommitted work
  was preserved. A store review is not a legal clearance or public release.

A checkout pending across a parameter-changing service update can receive a
Stripe idempotency mismatch. The service now returns explicit recovery guidance
and retains the original purchase token/key; it does not create a second cart.
Support must reconcile/expire the original pending Checkout before a fresh
purchase. Historical-offer automatic recovery is not implemented.


## Verification record

- Repository validation passed: manifest, resource references, bundled script
  syntax, minimal permissions and all 44 settings/lifecycle checks.
- Focused consent, entitlement lifecycle, billing service and worker tests passed
  (34 tests), including access restrictions, failed saves, stale responses,
  cancellation access and legacy compatibility.
- Actual production popup markup with synthetic Chrome APIs passed 24/24 browser
  checks, including first-use assent, failed writes and withdrawal.
- The 1.0.2 store package has subscription enforcement required and was uploaded.
- Current website, popup, manifest, store copy and documentation call the feature
  Keyboard shortcuts; the macOS requirement remains explicit. Published historical
  legal snapshots remain immutable. The copy-only Terms revision has a new
  version; the older permanent URL remains available.
- Legal-page layout was visually checked. All four current canonical/versioned
  legal URLs returned 200 with article text matching source, excluding Netlify
  hosting comments outside the policy text. Live homepage naming and closed
  public-config sales were verified after the final deploy.
- A real hosted Stripe Test mode Checkout from the production service code
  displayed the unchecked adult/Terms agreement, current immutable policy links,
  seven-day trial, $0.99 monthly price, automatic renewal and cancellation notice.
  The test session was expired afterward with no subscription or payment created.
- Still required before sales: counsel/legal decisions; notification/receipt
  configuration and current release acceptance in README. Completed hosted
  Checkout consent evidence was not exercised in this run; server tests cover
  accepted/missing consent. No real email, real payment or CI result is asserted.

## Primary references checked

- [Chrome privacy policy requirements](https://developer.chrome.com/docs/webstore/program-policies/privacy), [disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements), [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use), [dashboard privacy](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [payments](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment), and [update workflow](https://developer.chrome.com/docs/webstore/update).
- [Google brand guidance](https://about.google/brand-resource-center/guidance/) and [store intellectual-property policy](https://developer.chrome.com/docs/webstore/program-policies/impersonation-and-intellectual-property).
- [Berman v. Freedom Financial Network](https://cdn.ca9.uscourts.gov/datastore/opinions/2022/04/05/20-16900.pdf) and [Nguyen v. Barnes & Noble](https://cdn.ca9.uscourts.gov/datastore/opinions/2014/08/18/12-56628.pdf). These are fact- and jurisdiction-dependent support for conspicuous affirmative assent, not a Colorado enforceability opinion.
- [FTC ROSCA](https://www.ftc.gov/legal-library/browse/statutes/restore-online-shoppers-confidence-act), [Colorado online cancellation](https://leg.colorado.gov/bills/sb25-145), [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions), [Colorado children's data legislation](https://leg.colorado.gov/bills/SB24-041), and [Colorado privacy guidance](https://coag.gov/resources/colorado-privacy-act/). Do not rely on the vacated 2024 FTC click-to-cancel rule as if it remained operative.
- [Stripe hosted Checkout consent](https://docs.stripe.com/payments/checkout/custom-components?ui=full-page), [trial notifications](https://docs.stripe.com/billing/subscriptions/trials), and [customer emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails).
- [Colorado business structure guidance](https://www.coloradosos.gov/pubs/info_center/eLearningCourses/StartingABusinessInColoradoEnglish/page36724.html), [SBA launch guidance](https://www.sba.gov/counseling/launch-your-business/), and [EU distance-selling requirements](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm).

## Plain-English Summary

- Legal copy now describes the extension's real risks, data handling and paid service.
- Mail features require affirmative current agreement; management stays accessible.
- Focused checks pass; policies are live and 1.0.2 is pending review with sales closed.
- Brand clearance, personal liability and geographic/minor compliance need counsel.
- Suggested Conventional Commit: `feat(legal): add versioned consent and strengthen service policies`.
