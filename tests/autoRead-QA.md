# Automatic read on conversation opening

## Immediate reads on navigation — 0.9.50

The reading-pane controller follows Gmail's native selected conversation, including
clicks, Up/Down arrows, and automatic advancement after toolbar or shortcut
Archive/Delete. Once the selected row, both thread IDs, and visible message body
agree, it invokes the native **Mark as read** gesture without a dwell timer.
Missing/ignored controls retain bounded 250ms retries and the ten-second deadline.
Both IDs, account path, route, selection, and action availability are checked
before every mouse phase. Gmail remains the sole owner of mail state and counts.

The existing observer also watches only native split-pane grids for selection
changes. Hover/focus/presentation class changes do not trigger reading-chrome
refreshes. There is no new document-wide observer, permission, network request,
mail cache, or persistent read state. One transient visit guard prevents manual
unread, cancellation, or timeout from restarting on unrelated DOM changes.

Manual **Mark as unread** stays in effect while that conversation remains open,
including Gmail's native deselection/restoration and Command-Shift-U. Leaving
and reopening it, or clicking it again, reads immediately. Startup with an
already-open conversation keeps its existing status. Bulk selection and hidden
tabs remain protected, and disabling the mode releases the watches and timers.

Regression coverage includes immediate click/Up/Down, toolbar and shortcut
Archive/Delete, reused panes, staged bodies, slow successor loading, rapid
switches, navigation during mousedown, bounded retries, native confirmation,
manual unread/restoration, bulk selection, startup, and cleanup. The results
below describe earlier versions with the superseded 300ms dwell.

Validation on October 1, 2026:

- Automatic-read browser fixtures: **70/70 passed**, including retained DOM after
  route/account changes, row replacement during retries/manual unread, ambiguous
  toolbars, and inert hover/focus changes.
- Related browser fixtures: label filing **49/49**, keyboard shortcuts **131/131**,
  and reading pane **31/31** passed. Final fixtures ran in the isolated in-app
  browser; the reading-pane suite also passed in Chrome.
- `node scripts/validate.cjs`: manifest/assets/syntax/permissions validation and
  **38/38** settings/lifecycle tests passed. `git diff --check` passed.
- Only the canonical checkout was edited. No real conversation was archived,
  deleted, sent, or changed as part of testing. Version **0.9.50** still requires
  extension Reload and Gmail refresh: the browser tool's URL policy blocks
  Chrome's extension-management page. Live Gmail behavior remains unverified.

## Read-status consistency and selection — 0.9.34

- **58/58** automatic-read checks passed in Chrome: at least 300ms of visible
  body time, nested/staged loading, ignored gestures, late/disabled/ambiguous
  controls, delayed confirmation, quick switching, cancellation, bounded retry
  expiry, manual unread restoration, reopening, bulk selection, and cleanup.
- **57/57** Apple Mail appearance checks passed, including white selected
  unread dots across both themes/eight accents, disappearance after native read,
  and restoration after native unread. Existing reading-pane checks: **31/31**.
- Manifest/resource/permission/syntax validation and **33/33** Node checks passed.
- Updated the four changed production files in the installed unpacked extension,
  reloaded **0.9.34**, and refreshed Gmail. Live testing on an already-read
  notification confirmed that **Mark as unread** restores the same selected
  conversation, retains its readable body, and shows a white dot. It stayed
  unread while open; switching away and returning marked it read again. The
  notification ended in its original read state. Exact minimum timing is covered
  by the synthetic tests. No message was sent and no draft content was edited.
- Gmail remains the source of truth; its own automatic-read preference still
  applies. A slow or unavailable native control may delay confirmation beyond
  300ms. Retries expire rather than claiming a read that Gmail did not confirm.

## Quiet automatic-read confirmation — 0.9.27

Before the automatic native read gesture, the reading-pane controller briefly
observes Gmail's existing `.b8[role="alert"]` notification region. It dismisses
only the exact native **Conversation marked as read.** acknowledgement using
its **Close** control, then disconnects. The wait also ends after five seconds
or feature cleanup. No toast CSS, alert visibility, or message text is changed.
Manual read actions outside that wait retain Gmail's normal confirmation.

Archive, delete, unread, error, and third-party notifications retain their
normal visibility and Undo controls. The read confirmation's own Undo control
closes with that specific notification, just as when Close is clicked manually.
Unknown markup or a missing Close control falls back to Gmail's notification.

- Automatic-read and notification browser checks: **43/43 passed**, including
  delayed rendering, shared-container reuse, third-party/received-HTML exclusions,
  cleanup, timeout, native Close gestures, and other notifications' Undo handlers.
- Existing reading-pane checks: **30/30 passed**. Node configuration checks:
  **32/32 passed**; syntax, manifest, resource and permission validation passed.
- Installed and reloaded **0.9.27**, then refreshed Gmail. A live already-read
  reminder was temporarily marked unread and reopened: it became read, while
  Gmail cleared the read acknowledgement and moved its notification region
  back offscreen through the native Close action. The reminder ended read.

An ordinary primary click on an unread split-pane conversation in Apple Mail
Mode starts a 300ms timer after the matching message body is visible.
The existing reading-pane controller owns the timer and uses the shared
conversation discovery. Both native thread IDs and the native `.aps`/`.zE`
states must match again at activation. Only one visible, enabled **Mark as read**
control in one native toolbar may receive the gesture, and checkbox selection
blocks the action. Gmail owns all read-state mutations and unread counts.
The bridge sends mousedown, mouseup, and click, matching the existing keyboard
toolbar bridge. Live Gmail ignores a bare `.click()` on this control; the
synthetic toolbar requires pressed/released state to catch that regression.

Pending reads cancel on conversation changes, identity changes, row removal,
navigation, keyboard input, tab visibility changes, window blur, mode OFF, and
page cleanup. There is no startup read, idle polling, network call,
stored read-state copy, or new permission. Temporary observation is confined
to the candidate row, its identity, table child list, and checkbox attributes.
An unopened click expires after ten seconds. Existing chrome observation and
conversation discovery handle staged rendering, with a bounded 100ms readiness
check for nested body changes that do not touch the observed chrome. The 300ms
timer does not run while the message body is missing or hidden. At the deadline,
Gmail Pro rechecks the native unread state and retries the explicit **Mark as
read** action every 250ms for up to ten seconds. It stops on confirmation or
cancellation, and never substitutes a **Mark as unread** toggle.

The native toolbar's **Mark as unread** action is allowed to finish. If it
clears the reading pane, Gmail Pro reopens the same identified row once through
Gmail's native link, suppressing auto-read for that restoration. No native
selection/read classes or received HTML are rewritten. The restoration wait
expires after five seconds and cancels on user navigation, bulk selection,
identity loss, or cleanup. Another ordinary opening click gets a fresh dwell.

Run `python3 scripts/serve-tests.py`, then open `/tests/autoRead.html` in the
foreground. Tests exercise the native-action bridge with synthetic messages,
including the minimum delay, slow loading, quick switching, cancellation,
manual unread, the native gesture, and missing/disabled/hidden/ambiguous controls. Switching tabs
while this suite runs intentionally cancels its timers; leave it foreground.
Also run `/tests/readingPane.html` and `node scripts/validate.cjs`.

Gmail's own automatic-read timing is independent. If configured to mark
immediately, Gmail can read messages before this extension's delay; choose
**Never** in Gmail's reading-pane settings to make the extension's 300ms dwell
the sole automatic trigger. Other native delays can still read a message later
after the extension cancels. Full-conversation navigation and unsupported
layouts retain Gmail's behavior. Disabling Apple Mail Mode also disables this
extension's automatic-read action; restore a native delay if desired.

## Verification — September 21, 2026

- Automatic-read browser checks: **33/33 passed** in Chrome, including a native
  toolbar fixture that ignores bare clicks.
- Existing reading-pane browser checks: **30/30 passed**. Manifest, resource,
  syntax, permission and Node configuration validation passed (**32/32** Node checks).
- Updated the installed unpacked extension in `~/Documents/GmailPro`, reloaded
  version **0.9.26**, and refreshed Gmail. Removed temporary status-only diagnostic
  logging before the final reload; the installed controller matches the source.
- Changed Gmail's native Preview Pane read preference from **After 3 seconds**
  to **Never**, allowing this extension to own the requested dwell behavior.
- Live check used an already-read reminder: temporarily marked it unread, opened
  it, observed `.aps` with `.zE` immediately, then observed `.aps` without `.zE`.
  It ended in its original read state. Exact minimum timing and quick-switch
  cancellation are verified by the synthetic timing tests.
