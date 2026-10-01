# One-click Inbox label filing — 0.9.48

## Behavior

Apple Mail Mode enables ordinary primary clicks and Enter/Space on validated
custom-label badges in Inbox conversation rows, including native `/pN` pages.
Gmail’s single-row checkbox is the selection owner. The controller verifies both
thread IDs, the account path, route, label metadata, selection, and native read
state before invoking Archive once. It keeps existing labels and stays in Inbox.
Gmail owns the reading pane, counts, acknowledgement, and Archive Undo.

The conversation need not be open. Existing checked rows block the action with
“Clear your selection to file one conversation.” Modified clicks, other
mailboxes, system labels, headers, unknown structures, and authored content keep
native behavior. Full tooltips are matched to native custom-label sidebar links
and `data-label-name`; abbreviated display names never determine a destination.
The native badge wrapper is `.yi > .ar > .at[title] > .au > .av`; the
previous direct `.yi > .at` variation remains supported.

Read readiness/retries and the complete operation expire after ten seconds.
Archive is never retried. Cancellation includes navigation, account-path changes,
selection changes, explicit keyboard commands, window/tab departure, mode OFF,
and cleanup. Shortcut cancellation preserves the selected target for the user’s
new command. Native mouse phases each revalidate the target. Owned selections
are released only when the original context and sole selection still agree.

Partial failure reports “Marked read, but couldn’t file. Try again.” Native
errors and Archive Undo are preserved. Undo reverses Archive, without promising
restoration of unread status. Mail state is neither copied nor persisted by the
extension. Badge annotations are restored when disabled; third-party attribute
changes are preserved.

## Verification — September 30, 2026

Run `python3 scripts/serve-tests.py` and open the following pages in foreground
Chrome, one at a time:

| Fixture | Result |
| --- | --- |
| `/tests/labelFiling.html` | 48/48 passed |
| `/tests/autoRead.html` | 59/59 passed |
| `/tests/readingPane.html` | 31/31 passed |
| `/tests/messageList.html` | 47/47 passed |
| `/tests/appleMail.html` | 61/61 passed |
| `/tests/keyboardShortcuts.html` | 131/131 passed |

All 377 browser checks passed. `node scripts/validate.cjs` also passed its
manifest/resource/icon/syntax/minimal-permission checks and all 38 Node tests.
`git diff --check` passed. Failure fixtures shorten the production-requested
ten-second expiry for deterministic browser execution; the automatic-read
suite verifies the real shared deadline. The filing suite fails on asynchronous
JavaScript errors and unhandled rejections.

Filing cases cover unread/read conversations, another conversation open,
multiple labels, nested/truncated names, Unicode/spaces/plus signs, existing
selection, duplicate clicks, delayed/ignored/disabled/hidden/ambiguous controls,
missing Archive, row replacement, recycled identities, changes during native
mouse phases, cancellation, partial failures, cleanup, keyboard ownership,
authored-content exclusions, native Archive Undo, late/renamed sidebar data,
and recovery of a pre-existing main after temporary startup gating.

With explicit user authorization, the current Gmail Inbox was inspected without
mail actions. All four visible custom-label badges used the native `.ar` group and `.au > .av`
wrappers, exposed full tooltip paths, and matched one native sidebar owner each.
All five rendered conversation rows exposed both thread IDs and native read
state. This corrected the older synthetic row fixture to match Gmail’s wrapper.
Actual filing/read mutations were tested only with synthetic conversations.

Rollout completed: Chrome Details showed version **0.9.48** and loaded source
`/Users/rmunoz/Documents/GmailPro`. The extension was reloaded and Gmail refreshed.
All four visible custom-label badges then exposed button roles, `tabindex=0`,
the full accessible action name, and pointer cursors. Inbox remained the active
route with no conversations selected. A startup discovery gap was corrected
through the existing scan while no main is registered; temporary diagnostics
were removed and their absence verified. Future Gmail markup changes may require
selector updates; unknown markup remains native.
