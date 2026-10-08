# Undo Send — October 7, 2026

## Cause and change

Read-only inspection of desktop Gmail found its native `.b8[role="alert"]`
inside `.w-asV[data-gp-header-collapsed]`. The collapsed shell's
`visibility: hidden` also hid the sent notice and its Undo control.

Apple Mail Mode now restores visibility only for an active native `.b8.bAp`
notice with Gmail's structured message boundary. The existing card sits 20px
from the bottom and left, using the shared theme and accent tokens, a 12px
corner radius, a soft shadow, and a distinct Undo button. Long notices wrap
within the viewport. View message, Close, native announcements, focus, and
Gmail's Undo handler remain intact. No native nodes or handlers are replaced.

The toast now has a 3px elapsed-time line along the top, spanning the full width
inside its 1px border. A faint track uses the current accent; the filled portion
grows left to right once. It appears only while the native sent notice has an
available Undo and another native link action (View message).

The user's recording reproduced a themed card with a plain blue Undo link and
no timer. Read-only inspection then captured Gmail's native `Message sent`
notice: `#link_undo` has `role="alert"`, `aria-live="assertive"`, no aria-label,
and an inline `visibility:hidden` state; `#link_vsm` has `role="link"`.
The earlier CSS and keyboard selector required `role="link"` on Undo, and the
test fixture repeated that assumption. Using the captured Undo role reproduced
the missing timer, button styling and mailbox shortcut: 23 of 36 checks failed
before the fix. CSS and native keyboard discovery now use the exact Undo ID
within Gmail's structured notification boundary, retaining native roles and
handlers. The timer excludes inline-hidden, removed or disabled Undo controls.
The fixture defaults to the captured role and View message ID, also covers
missing/alternate View message IDs, and simulates native hidden expiration.

The next user screenshot confirmed the line appeared but sat inside the padded
content. Live Gmail CSS inspection found `.aT { position: relative; }`, omitted
from the earlier native fixture stylesheet. Apple Mail Mode now sets that native
toast wrapper to `position: static`, making the fixed card the timer's containing
block. Card overflow clips the full-width line to its rounded corners. The
message span still owns the animation, preserving reset when Gmail replaces it.
Adding Gmail's actual positioning rule reproduced three failing alignment checks
before this fix; all pass afterward. Turning the mode off restores native
wrapper positioning.
Replacing the native message span starts a fresh animation.
The line cannot intercept clicks, resize the card, or change Undo behavior.
Reduced motion uses five discrete steps instead of continuous movement.

Read-only inspection of Gmail's General settings on October 7 confirmed a saved
**5-second** cancellation period. The CSS duration matches it via
`--gp-undo-send-duration` (default `5s`). Gmail does not expose a deadline in the
notification DOM, so this visual duration does **not** automatically follow
changes to Gmail's setting. Update the CSS duration if that setting changes;
the native Undo control remains the authority for cancellation availability.

Gmail owns the cancellation period and expiration. See
[Gmail's Undo Send documentation](https://support.google.com/mail/answer/2819488?hl=en).
This change does not alter that setting or introduce a send queue, timeout
callback, observer, cache, preference store, or permission.
The idle `-10000px` sentinel, explicit hidden states, unrecognized structures,
authored content, composers, and InboxSDK butterbars retain native behavior.
Turning off Apple Mail Mode restores Gmail's presentation.

## Verification

- `node scripts/validate.cjs`: passed, including 38 settings/lifecycle tests.
- Chrome `undoSend.html`: 37/37 passed. Covers collapsed/expanded header,
  native Undo, View message and Close callbacks, keyboard activation and Z,
  expiration, hidden states, native node replacement, long notices,
  third-party/authored exclusions, and mode disablement. The timer is checked at
  0, 2.5, and 5 seconds; includes once-only fill, theme/accent matching, no layout
  movement, full card width, missing/alternate View message IDs, reset on message
  replacement, alert-role Undo styling/keyboard activation, native inline-hidden
  expiration, removal with Undo, reduced motion, the card as positioning owner,
  and restoration of Gmail's relative wrapper positioning when the mode is off.
- Message and action text meets 4.5:1 contrast for light/dark and all eight accents.
- Chrome Apple Mail appearance: 63/63 passed after the alignment fix. Keyboard
  shortcuts 135/135 passed after the native Undo role fix. Header 71/71 passed
  for the initial restoration.
- Real Chrome Enter on the synthetic native Undo control invoked its existing
  callback and removed the sent notice with the header collapsed.
- Visual inspection: light/dark top-edge timer, plus a long notice in the in-app
  browser at 360 × 740. The card spans x=20…340 with no overflow; all actions stay
  inside the clipped card and remain visible.
- Screenshots are outside the canonical checkout in the task's `artifacts/` folder.

The agent sent no real email. The user's recording and read-only live markup
establish the selector mismatch; updated installed rendering and live server
cancellation still require user verification. Browser
security policy blocked `chrome://extensions/`, so the installed update still
requires the user to Reload Gmail Pro, then refresh Gmail. Version: 0.9.55.

To reproduce, run `python3 scripts/serve-tests.py` and open
`http://127.0.0.1:8765/tests/undoSend.html`. Add `?preview=dark` or
`?preview=light` for a synthetic design preview; add `&long` for wrapping or
`&elapsed=2.5` to pause the line halfway for visual review.
