# Native endless-scroll release gate — September 30, 2026

## Result

**Release gate not passed. Production automatic paging remains unchanged.**

The requested behavior is a cumulative conversation list with loading feedback,
using Gmail's native rows and actions and no new account authorization. Two
bounded live retention variants were tested. Neither established reliable native
page loading with the earlier conversations retained. This result applies to
these variants; it is not proof that every possible retention approach fails.

## Test-only implementation

`endlessScrollProbe.js` retains original DOM subtrees in a fixed, extension-owned
scroll host attached directly to `document.body`, outside Gmail's replaceable
list ancestry. No rows are cloned and no Gmail mail-action handlers are replaced.
The probe validates row identities over two render frames and stops if Gmail
invalidates a retained batch. The manual Next batch button isolates the native
retention experiment from the proposed automatic scrolling trigger.

The probe supports retaining the whole native `.Nu.tf` list subtree or the
original grid table. It only mounts on the dedicated local fixture or an explicit
live test URL with `gmail-pro-retention-probe=1`; table retention additionally
uses `retained-subtree=grid`. These query parameters do nothing in production.
The test script is not in the manifest and is not bundled into any production
content script.

Only transient row identities are held in memory. No subjects, message bodies,
senders, or identifiers are written to logs, storage, or this report.

## Live observations

Environment: installed Gmail Pro 0.9.47, desktop Gmail in Chrome, Apple Mail Mode,
right reading pane, a dedicated browser tab without an active composer. Existing
user Gmail tabs were not refreshed or navigated. No mail-changing action was
performed, and the probe tabs were stopped and closed after each attempt.

1. **Whole native list subtree.** The already-read search initially rendered 48
   conversations, with native range 1–48. The native next-page gesture advanced
   the pager to 51–96 and rendered 46 conversations in Gmail's replacement list.
   The retained outer list container remained in the owned host, but Gmail removed
   its grid and tbody. The probe reported `retention-failed` with zero retained
   rows. Moving the outer list outside the replaced ancestry did not preserve
   its original contents.
2. **Original grid table.** An already-read search including all folders initially
   rendered 48 conversations. Retaining the original table kept those 48 rows
   intact, but the probe did not discover a stable next native page within its
   15-second deadline. It reported `timeout`. Browser DOM inspection was also
   interrupted by Chrome's extension-UI guard, so this test does not establish
   the precise cause of the missing completion. Native UI inspection confirmed
   the timeout. The retained table was removed through the probe's Stop control
   and the dedicated tab was closed.

Gmail's visible search batches in these tests were smaller than 50; the probe
used actual native ranges and identities. No batch size preference was changed.
There was no three-batch live proof, and star, read/unread, archive, and multi-page
selection were not live-tested. Visually surviving rows alone are insufficient
for release.

## Synthetic checks

Open `http://127.0.0.1:8765/tests/endlessScrollProbe.html` after starting the existing
`scripts/serve-tests.py` server. Five real-Chrome checks exercise:

- 50 → 100 → 150 distinct conversations across native ancestor replacement,
  preserving original subtrees and first-batch delegated open/selection handlers.
- Native reuse of retained rows being rejected when identities change.
- Controller disposal leaving 150 intact but inert rows, demonstrating why visual
  retention cannot stand in for live action validation.
- Stop during a pending request restoring the current native subtree.
- Stop after three batches restoring the latest native page and removing the host.

Synthetic handlers model the ownership cases; they do not prove Gmail itself
preserves native handlers.

## Final validation

- `node scripts/validate.cjs`: manifest, resource, minimal-permission, and syntax
  checks pass; all 37 Node tests pass.
- Real-Chrome fixtures: native retention 5/5, production automatic paging 32/32,
  popup 21/21, message list 47/47, reading pane 31/31, keyboard shortcuts 96/96.
  Total: 232 browser checks pass.
- `git diff --check` and whitespace checks for all four new fixture/report files:
  pass. Production `content/autoPaging.js` is byte-for-byte identical to the
  initial file, and the production manifest/settings/popup have no diff.

## Restoration and deferred work

The probe was temporarily appended to `content/autoPaging.js` for isolated live
verification. That file was restored byte-for-byte from a verified backup, and
Chrome's existing Gmail Pro extension was reloaded afterward. Manifest version,
permissions, settings keys, popup wording, and production behavior are unchanged.
The remaining changes are this report and three test-only fixture files.

The automatic bottom trigger, spinner, Retry/end states, production integration,
and large-list performance checks were deferred because the native retention
prerequisite failed. Do not replace production paging on the strength of the
synthetic fixture. A subsequent attempt needs a different, independently proven
native ownership strategy or a separately authorized Gmail API approach.
