# Automatic page changes QA

## Scope and behavior

The user chose automatic native page replacement instead of true endless scrolling.
Gmail Pro 0.9.24 provides an independent `autoPagingEnabled` preference, default off,
in the existing settings owner and popup. It requires Apple Mail Mode and a right
reading pane. The user enabled and saved it in the installed extension.

Arriving at either edge shows an owned floating prompt with Next/Previous page
and a small progress indicator. Continued meaningful wheel input for at least
750ms and 180 normalized pixels activates the corresponding native button once.
A single large flick or simply waiting cannot change pages. A 240ms pause resets
progress, and the prompt hides after 2.4 seconds unless it has keyboard
focus. The prompt's button is an immediate alternative. Holding a scroll key can
also fill the indicator. Native scrollbar movement alone does not change pages.
Each new edge gesture starts independently, without a global rearming latch.

Upward input at the top supports a short final page with no scrollbar. Forward
navigation lands at the new page’s top; backward navigation lands at the previous
page’s bottom. Gmail's page size, rows, actions, selection, and pager remain native.
No rows are copied, retained, reattached, or given replacement event handlers.
Gmail's page buttons have larger pointer targets. Manual pointer, click-only, and
keyboard activation yields to native handlers unchanged, cancels automatic
positioning, and shows loading feedback while Gmail renders the new page.

One request can be in flight. Programmatic scrolling, startup, resize, reading-pane
scrolling, selected conversations, active drafts/editors, menus/dialogs, hidden
tabs, disabled page buttons, and unknown layouts do not initiate navigation.
Manual input/navigation cancels pending automatic completion handling. There is
no automatic retry after a 15-second timeout.

Gmail may replace the main region and its ancestors. A temporary document observer
therefore runs only while a native page is loading, coalesces checks once per frame,
and disconnects on completion/cancellation/timeout. Native range and distinct row
identities must settle across two frames before resetting the new list to the top.
Only transient identifiers for one native page are held in memory; no mail data
is logged, persisted, sent, or included in this report. No polling or network code,
new permission, API integration, package, or dependency was added.

## Removed experiment

The earlier manual Gate A probe moved original rows into a new table immediately
before the native grid. On live Trash search pagination, Gmail detached the list
container and its retained table. That placement failed; no three-batch native
row/action proof was established. This did not prove all retention approaches
impossible. The user then chose automatic page changes.

Removed the unused probe, activation entry point, fixture page/checks, temporary
installation/rollback helper, helper tests, and obsolete probe documentation.
Only useful native list/pager selectors were retained and renamed for production
paging. Existing timestamp, appearance, and message-list work was preserved.

## Automated validation

- `node scripts/validate.cjs`: 29/29 Node tests, syntax, resources, manifest, and
  minimal-permission checks pass.
- `tests/autoPaging.html`: 32/32 real-Chrome synthetic checks pass. Covers deliberate
  holds, release/reversal, tiny momentum tails, single large flicks, reading-pane
  cancellation, keyboard holds, wheel units, three consecutive pages in both
  directions, short final pages, ancestor replacement, partial/stale rendering,
  overlapping page boundaries, selection/editor guards, native old/new history
  events, balanced mouse phases, manual arrow priority and scroll position,
  timeout without retry, hidden tabs, late completion, disabling, and cleanup.
- `tests/popup.html`: 17/17 real-Chrome checks pass, including the new switch,
  independent persistence, sync updates, and existing preferences.
- `git diff --check`: pass.

Fixtures use synthetic mail. Live mail-action tests for retained rows are no
longer applicable because retained rows and the custom continuous list were removed.

## Original live verification — September 21, 2026 (0.9.22)

Environment: Chrome 153.0.8010.48 on macOS, Gmail Pro 0.9.22, English desktop Gmail,
Apple Mail Mode, reading pane on right. Dedicated `in:trash` search tab with 52
conversations and a native 50-conversation page size. No active composer in this tab.

An initial run navigated successfully but left the loading notice until timeout.
Gmail replaced an ancestor above the observer's original scope. Expanded the
strictly temporary observer to the document and added the asynchronous ancestor
replacement regression before the final live run.

Live checks:
- Selecting the native current-page checkbox selected 50 rows. Scrolling to the
  bottom left the range at 1–50 of 52. Cleared the selection afterward.
- Scrolling the reading pane at the list bottom left the range unchanged.
- Native Previous results returned from 51–52 to 1–50, with 50 native rows.
- Final automatic transition loaded 51–52 of 52, with exactly one native grid,
  two native rows, scroll position 0, and no remaining loading notice.
- Next results was disabled on the final page. Further downward scrolling left
  the range unchanged and did not create another loading notice.

No conversations were opened, marked read/unread, starred, archived, relabeled,
sent, restored, moved to Trash, or permanently deleted. The original work-mail tab
was not navigated or refreshed. Selection changes were cleared.

## Follow-up navigation fix — September 21, 2026 (0.9.23)

The user reported missing backward scrolling and unresponsive manual arrows.
Backward scrolling was absent in 0.9.22; added it through the same native paging
owner. Before this fix, both arrows worked in a fresh Trash search tab. A read-only
inspection of the reported existing label tab found its visible Newer/Older buttons
enabled and unobstructed. The exact reported arrow failure was not reproduced.
Added an explicit handoff for manual pager input plus regression coverage for
unmodified click phases and competing scroll input during manual navigation.

Final live 0.9.23 verification in the dedicated `in:trash` tab:
- Scrolling down advanced 1–50 → 51–52 of 52; the loading notice cleared.
- Scrolling up over the short final list returned 51–52 → 1–50, with the native
  scroller at its bottom (1788px = 2493px content − 705px viewport).
- Manual Next results then advanced to 51–52 with no automatic loading notice.
- Manual Previous results returned to 1–50 with no automatic loading notice.
- No conversation was opened or modified. The reported original label tab was
  inspected read-only; it was not navigated or refreshed.

Updated only `content/autoPaging.js`, `popup/popup.html`, and `manifest.json` in
the installed copy. Preferences and permissions remain unchanged. The three
0.9.22 files are backed up at
`/var/folders/lx/klmbtxrd0bjf1bd3hrzf4l1c0000gp/T/gmail-pro-before-paging-navigation-78_4bqof`.
Chrome Details verified version 0.9.23 after reloading the extension.

## Deliberate edge gesture — September 21, 2026 (0.9.24)

The user reported that backward paging worked once and then stopped, and that
reaching the bottom changed pages too quickly. The old global fresh-wheel latch
could remain closed while a user continuously scrolled across successive pages.
Replaced it with independent edge progress that requires sustained meaningful
input. The new edge prompt provides an explicit Next/Previous button as well.

Native synthetic mouse gestures now finish mouseup/click even when Gmail changes
its disabled state or publishes history synchronously during mousedown. Pending
navigation tolerates the original hash before Gmail publishes the expected new
hash, and a native page may share some identities with the prior page. Gmail's
own manual events remain untouched. Manual arrows receive larger hit targets
and the same temporary loading feedback without automatic scroll positioning.

Live checks used the user's affected standalone Gmail window, with no active
composer or editor, after refreshing it to load the installed 0.9.24 content script.
No mail action was performed. The page range, native grid, and list position were
read without recording conversation content in this report.

- A single upward gesture at the top showed the Previous prompt and left the page
  unchanged. Its Previous button completed native navigation.
- Continued upward input then completed two additional consecutive backward
  transitions, with loading feedback clearing after each.
- At the bottom, a single gesture showed the Next prompt and left the page
  unchanged while input stopped. Its Next button completed native navigation.
- Continued downward input completed two further forward transitions. The list
  returned to the top after forward navigation.
- All six transitions used Gmail's native page replacement and retained no old
  rows. Pausing at an edge did not trigger a delayed change.
- After these transitions, native app clicks on both top-right Newer and Older
  buttons completed successfully. Each showed loading feedback and then cleared it.
  Restored the original page, with no selected conversations or paging notice.

The exact user-reported manual-arrow failure was not reproduced in the old
version: both browser clicks and native app clicks worked in the affected window.
The balanced-gesture regression and manual-arrow safeguards address potential
interference; they are not proof of the specific original failure's cause.

Installed only `content/autoPaging.js`, new `content/autoPaging.css`,
`popup/popup.html`, and `manifest.json`. Chrome Details verified 0.9.24. Preferences,
permissions, and unrelated installed files were preserved. The overwritten 0.9.23
files are backed up at
`/var/folders/lx/klmbtxrd0bjf1bd3hrzf4l1c0000gp/T/gmail-pro-before-deliberate-paging-fzclmixc`.

## Original 0.9.22 installation and rollback

Chrome's loaded source is `/Users/rmunoz/Documents/GmailPro`. Updated only these
production files and reloaded the existing extension:

- `content/autoPaging.js` (new)
- `content/content.js`, `content/gmailSelectors.js`
- `shared/settings.js`
- `popup/popup.html`, `popup/popup.js`
- `manifest.json` (0.9.21 → 0.9.22; still only `storage` permission)

The original files are backed up outside the repository at
`/var/folders/lx/klmbtxrd0bjf1bd3hrzf4l1c0000gp/T/gmail-pro-before-auto-paging-ekjgt76d`.
The installed production files were compared byte-for-byte with the workspace.
Other installed files and preferences were preserved.

The user enabled the switch manually after the browser automation URL policy
blocked opening the extension settings page. No workaround was used.
To disable: turn off Automatic page changes and save preferences. Existing Gmail
tabs need one normal refresh to load the updated extension; new tabs already use it.

## Limitations

Supported target is the verified English single-list/right-reading-pane layout.
Multiple inboxes, another reading-pane orientation, and unrecognized Gmail markup
fail closed. Live validation covers the two-page Trash search in earlier versions and four
consecutive label pages in 0.9.24. Inbox variants, offline recovery, and cross-account
behavior are not claimed as live-tested. Automated gestures verify the threshold,
but different physical touchpads and mouse wheels may feel different. Gmail controls what happens to an open conversation on native
pagination. This is automatic page replacement, not one combined conversation list.
