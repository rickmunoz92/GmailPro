# One-click Inbox label filing

## Behavior

Apple Mail Mode enables ordinary primary clicks and Enter/Space on validated
custom-label badges in Inbox conversation rows, including native `/pN` pages
and floating-draft `?compose=...` URL parameters. Mailbox eligibility uses the
hash path; in-flight cancellation continues to compare the full hash.
Gmail’s single-row checkbox is the selection owner. The controller verifies both
thread IDs, the account path, route, label metadata, selection, and native read
state before invoking Archive once. It keeps existing labels and stays in Inbox.
Gmail owns the reading pane, counts, acknowledgement, and Archive Undo.
A completed Archive gesture, a fresh native “Conversation archived.” message,
and removal of the exact target from the same Inbox context are all required
before Gmail Pro shows “Moved to [full label path]”. The floating card is centered
12px below the list's top edge, inherits the light/dark theme and accent, and
expires after 1.5 seconds. It wraps long names, does not move the list or capture
pointer/focus, and follows list resizing. Successive confirmations replace the
single card and restart its timer. Navigation, account/context changes, mode OFF,
and cleanup release the card, resize observer, frame and scroll listeners.

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

Partial failure reports “Marked read, but couldn’t file. Try again.” If the row
disappears without native acknowledgement, feedback reports an unconfirmed move
instead of claiming success or a failed Archive. Error feedback remains
dismissible for six seconds. Native
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


## Freeze fix and toast verification — October 1, 2026

The new fixture reproduced browser event-loop starvation before the fix with a
reading pane containing all four extension actions, a disabled native reaction,
and a 450ms delayed Archive. A fixture-only watchdog interrupted more than 200
queued refreshes before Chrome itself could freeze. All-visible controls and
list-only layouts did not reproduce the loop. Changing visibility only when
needed and registering toolbar observations after extension writes removes the
loop; timers, animation frames and native completion now continue normally.
Synchronous mode OFF during an Archive gesture also stops further actions/UI
updates and observation safely.

Foreground Chrome results using the local-only fixture server:

| Fixture | Result |
| --- | --- |
| `/tests/labelFiling.html` | 75/75 passed |
| `/tests/readingPane.html` | 31/31 passed |
| `/tests/autoRead.html` | 70/70 passed |
| `/tests/reverseThreads.html` | 57/57 passed |
| `/tests/keyboardShortcuts.html` | 131/131 passed |

All 364 browser checks passed. `node scripts/validate.cjs` passed its manifest,
resource, icon, syntax and permission checks plus all 38 Node tests.
`git diff --check` passed. No dependencies, settings, permissions or public
interfaces changed.

Added checks cover actual 1.5-second success and six-second error durations,
successive moves, full nested/Unicode names, delayed/missing/stale/error
acknowledgements, incomplete mouse gestures, temporary/recycled rows, late
confirmation after cancellation, cleanup, light/dark colors, narrow widths,
wrapping, list resizing, focus/layout stability, safe text rendering, and native
Undo. Chrome parsed the reduced-motion override and verified the animation
against its current motion preference. Light/dark cards were also visually
inspected using `/tests/labelFiling.html?preview=light` and `?preview=dark`.

Only synthetic mail was changed. Chrome extension Reload followed by a Gmail
refresh is required to activate the updated content scripts in an existing
Gmail tab. Screenshot artifacts are kept outside the repository.


## Open-draft route regression — October 1, 2026

Read-only inspection of the current Gmail tab found an Inbox hash with a native
`?compose=...` suffix. Apple Mail Mode was active, all seven conversation rows
were validated, and three native label wrappers were present, but none had a
filing action. The strict Inbox route matcher rejected the draft parameter and
let the native conversation click run. No real messages or drafts were changed.

Before the route fix, seven new synthetic cases reproduced missing badge actions
or prevented filing from starting. The mailbox check now strips the query suffix,
using the existing header owner's route convention, while keeping the strict
Inbox and `/pN` path validation. The filing operation still checks the entire
hash, account path, selection, and conversation identity before every action.

Regression coverage includes read/unread rows with floating drafts in Inbox and
paginated Inbox, draft parameters arriving after startup, cancellation when the
full draft URL changes, and native behavior in label/search routes with drafts.
The existing synthetic preview accepts `?preview=dark&draft=1` (or `light`) to
review a move confirmation while the unsent draft remains open.


Foreground Chrome verification after the route fix:

| Fixture | Result |
| --- | --- |
| `/tests/labelFiling.html` | 84/84 passed |
| `/tests/messageList.html` | 53/53 passed |
| `/tests/readingPane.html` | 31/31 passed |
| `/tests/autoRead.html` | 70/70 passed |
| `/tests/reverseThreads.html` | 57/57 passed |
| `/tests/keyboardShortcuts.html` | 131/131 passed |

All 426 browser checks passed. `node scripts/validate.cjs` passed all checks and
38 Node tests; `git diff --check` passed. A real primary click in the dark
synthetic preview removed the exact target, showed the full-path success card
and native Undo, and left the unsent draft open. The screenshot is outside the
repository. Existing Gmail tabs require extension Reload followed by Gmail
refresh to pick up this additional route fix.
