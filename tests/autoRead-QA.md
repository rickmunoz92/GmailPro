# Automatic read after 300ms — 0.9.26

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
Mode starts a single 300ms timer after the matching message body is visible.
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
page cleanup. There is no startup read, retry loop, mailbox scan, network call,
stored read-state copy, or new permission. Temporary observation is confined
to the candidate row, its identity, table child list, and checkbox attributes.
An unopened click expires after ten seconds. Existing chrome observation and
conversation discovery handle staged rendering. The timer does not run while
the message body is missing or hidden.

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
