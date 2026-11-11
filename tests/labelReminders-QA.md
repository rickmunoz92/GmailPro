# Label cleanup reminder validation

Local implementation checked November 10, 2026. The privacy update was
subsequently published and an unbilled Google development project configured
for the authorized local test. No extension release, commit or push occurred.
Mailbox authorization and live reminder validation are tracked below.

## Acceptance checks

- Three independent 3-, 6- and 12-month settings default on and persist through
  the existing settings adapter. All off stops new checks and removes controls.
- Existing mail dates produce suggestions after the first connected scan.
  Recency uses the newest email date, rather than the label-application date.
- Parent recency includes all descendants, including unmounted/hidden children.
  An unknown descendant prevents an inactive-parent suggestion. Empty leaves
  can be suggested immediately; wholly empty branches are not age-classified.
- The minimalist zz button and Hide / Dismiss popover follow Light, Dark and
  live System appearance. Escape, focus, outside dismissal and viewport fit
  were exercised in the synthetic browser fixture.
- Hide rechecks the complete branch before saving. New recent mail or a failed
  descendant check prevents hiding. Hiding a parent hides every child and
  deeper descendant. Restoring the parent restores that branch, preserving
  any separately hidden child preference. Native labels, messages and counts
  remain intact.
- Supported native mailbox rows have visibility controls and no extra reorder
  handles. The organizer can restore Inbox even with the AI layout's
  `display: contents` label list and a hidden Inbox.

## Automated results

- `npm test`: passed the 51 settings/startup/manifest checks and all 63
  consent, reminder-worker and billing tests. The worker coverage includes
  cross-account rejection, token isolation, fresh branch verification,
  bounded/resumable scans, coalesced refreshes, failures/cooldowns, revocation,
  account/tab cancellation and stale settings/consent reads.
- After the final UI changes, `node scripts/validate.cjs`: 51/51 passed,
  including JavaScript syntax and resource/permission validation.
- After the live account-policy error was reported, all 20 reminder-worker
  tests passed, including the new failed-authorization regression: no Google
  mail requests, no saved account and a feature-specific explanation.
- After the personal-account scan exposed an empty-JSON response error, all
  23 reminder-worker tests and 51 validation checks passed. Message-list
  requests now include the zero-result indicator needed to verify empty
  labels. Unreadable or incomplete responses remain unknown, suppress
  dependent parent suggestions, and report a safe response-stage error.
- Browser fixtures: label reminders 13/13, label organization 56/56,
  popup 28/28 and startup recovery 3/3 passed. The added popup regression
  confirms Google connection is optional, never starts automatically and
  declining its permission keeps other features usable.
- `git diff --check`: passed.
- The header-layout fixture's existing “document cursor updates do not refresh
  header geometry” case failed. The same isolated case also failed using
  unchanged `HEAD` source copies. It was not changed as part of this feature.

## Performance evidence and limits

The worker requests only label identity, one newest message ID per label/view,
and its internal date. It limits concurrency to four, scans 20 labels per
resumable chunk, budgets 80 quota units/second, caches for 24 hours and backs off
on errors. Scrolling never initiates mail checks. A single IntersectionObserver
limits DOM controls to nearby rows; each rendering batch has both a four-ms
JavaScript budget and a 20-insertion cap. The zz vector uses one cached CSS mask.

In the final isolated in-app browser fixture, 506 mounted native rows produced
at most 22 reminder controls. A paired 75-frame scrolling sample, with the
production Apple Mail styles and sidebar/reminder modules, measured:

| Measurement | Off | On |
| --- | ---: | ---: |
| 95th-percentile frame interval | 17.7 ms | 17.3 ms |
| Long tasks | 1 (63 ms) | 0 |
| First visible decoration | — | 32 ms |
| Worker messages | 0 | 1 |

The on-case synchronous start took 5 ms; sidebar discovery peaked at 3 ms and
the synthetic worker response at 2 ms. Scrolling used cached candidates.
These are fixture observations, not a speed improvement or a guarantee about
live Gmail. Separate Chrome automation samples were highly variable and
reported worse on-case timings (one sample 250.7 ms versus 34.3 ms p95). That
discrepancy was not reproduced in the isolated fixture; its cause is unverified.
A live Chrome/Gmail on/off comparison remains a release gate.

## Remaining activation checks

The build contains a real development OAuth client, bound to the confirmed
unpacked extension ID. The public identifier is stored in `google-oauth.json`
and the development manifest. The production/store client still needs its
separate owner-controlled project and public-review process.
One Google Cloud new-project form required a billing-account selection, but
Google's Workspace documentation says Cloud Billing is not required for the
supported APIs. Use an unbilled creation route; no billing account was selected
or linked. See
[Google setup](../release/google-oauth-setup.md).

The versioned privacy update was published at `/privacy` and
`/legal/privacy-2026-11-10-1` in Netlify deploy `6af3f631f9b124cc439abcf1`.
Both routes returned HTTP 200 with policy article content exactly matching
the prepared files. The old immutable policy still matches, and the billing
public-config endpoint still reports free access with sales disabled.

Google development project `gmail-pro-dev-514403` was created with no billing
account. Cloud Billing reported `billingEnabled: false`, and enabling Gmail
API succeeded. The app is External / Testing, with the owner's personal and
work accounts as test users, a single `gmail.readonly` scope, and the published
home/privacy/terms links. The user confirmed the canonical unpacked extension
ID and loaded folder. The work-profile connection returned Google's “Service
has been disabled for this account” error. Adding the work address to the
test-user allowlist did not resolve it. No work-account label scan or live
hide/restore was completed. An account/Workspace policy is a possible cause; no organizational
policy was inspected or changed. Google read-only mailbox access must still be
granted explicitly for each account. The test extension was subsequently
installed in the owner's personal Chrome profile. After the response-handling
fix, the user confirmed that the connection and label checks completed. Six
live zz controls and the empty-label popover were observed in personal Gmail.
The existing empty Test label was hidden through its reminder, with the native
label retained, and restored through Organize labels. After a full Gmail
refresh, Test remained visible, its current reminder remained dismissed, and
the five other suggestions returned from the cache. The test ended in the
original personal Inbox with Test visible. Captures are saved as
`live-personal-reminder.jpg` and `live-personal-restored.jpg` in the ignored
capture directory.

Remaining live release checks cover an old nonempty label, supported system
rows, a parent with an active descendant, account mismatch/revocation and a
paired Chrome startup/navigation/scrolling comparison. Those failure and
hierarchy cases have automated coverage; they have not all been exercised
against a real mailbox. Public
distribution also requires the applicable Google OAuth and Chrome Web Store
reviews. Store packaging intentionally fails until its OAuth client is set.

Local light/dark captures are in `.tmp/label-reminder-qa/` and excluded from Git.
