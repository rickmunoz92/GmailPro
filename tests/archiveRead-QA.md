# Mark read when archiving

In Apple Mail Mode, ordinary Archive toolbar and row-hover gestures, keyboard
activation of those controls, and Gmail Pro’s ⌘⇧A mark the identified conversation
or selected rows read before archiving. Already-read targets archive normally.
Gmail’s native E shortcut and Send & archive are unchanged. Unrecognized layouts
retain Gmail’s native behavior.

The controller checks both native thread IDs, account path, route, selection,
visible toolbar, and action identity before each synthetic mouse phase. It
requires Gmail’s explicit read row state. It submits Mark as read once, waits
up to five seconds for confirmation, and never retries Archive. New input,
navigation, changed selection/identity, hidden tabs, and mode disablement cancel
pending work. No new permission, network access, or persistent mailbox state is
introduced. Gmail supplies Archive Undo; it does not restore the unread state.

Validated November 11, 2026 in the canonical checkout:

- `node scripts/validate.cjs`: manifest/resource/syntax/permission checks and
  all **51/51** settings/lifecycle tests passed.
- `/tests/archiveRead.html`: **23/23** real-Chrome synthetic checks passed,
  including bulk and hover targeting, delayed/ignored read confirmation,
  duplicate input, keyboard activation, native Undo, account/selection changes,
  read-toggle races, cancellation, and reading-pane integration.
- `/tests/labelFiling.html`, with the archive controller enabled: **97/97** passed.
- `/tests/keyboardShortcuts.html`: **135/135** passed.
- No browser warnings or errors were reported by these fixture runs.

These are synthetic-mail checks. Native row-hover structure was inspected
read-only in Gmail; no real message was archived or marked read/unread, and the
extension was not reloaded into Gmail. Live success/failure behavior, native
full-page conversation layouts, and selection across unloaded pages remain
unverified. Reload Gmail Pro and refresh Gmail to load the local change.
