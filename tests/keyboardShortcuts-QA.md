# Archive and Send keyboard shortcuts — 2026-09-21

## Behavior

Mac only. Both preferences default on and use the existing versioned Chrome Sync
settings owner. The popup saves them independently with Save preferences. The content
owner starts after settings load and stops on pagehide or when both preferences are off.
There are three delegated keyboard listeners and one blur listener, no observers, timers,
background worker, new permissions, network calls, or alternate selection/draft store.

- Command-Shift-A invokes the currently enabled main-toolbar Archive button once.
  Gmail owns the open conversation / bulk-selection semantics. Search fields, editable
  content, composers, menus, and non-compose dialogs block Archive.
- Command-Shift-D invokes only the normal Send button in the focused composer. Body,
  recipient, subject, and composer-control focus are supported. Hidden/minimized,
  missing, disabled, ambiguous and unfocused composers do nothing. Authored-content
  button lookalikes, Send & archive, and More send options are excluded.
- Enabled chords are consumed even without a valid action. Failed Send resolution
  never falls through to Gmail's Discard shortcut. Turning Send off restores that
  native shortcut. Extra modifiers, composition input and other keys are untouched.
- Native validation and undo behavior remain Gmail's. No queued send or retry occurs,
  and no send-time recipient/BCC change is made. The draft's current recipients apply.
- Native repeat flags suppress held-key repetition. macOS can omit release events for
  Command chords; every fresh non-repeating keydown remains usable, and the next plain
  letter must still type normally. Companion-event state clears on release/blur/stop.
- Native controls receive one mousedown/mouseup/click sequence. Gmail's toolbar needs
  this pressed state; click alone does not activate Archive. If a phase removes or
  disables the control, the remaining phases stop.

## Compatibility gate and real-key verification

Before feature implementation, used `keyboardCompatibility.html` in normal Chrome and
inside the installed Gmail app window (`com.google.Chrome.app.fmgjjmmmlfnkbppncabfkddbjimcfncm`).
Native macOS app keyboard input delivered trusted, cancelable A and D keydowns to the
local page. Chrome Tab Search and Bookmark All Tabs did not open.

Then loaded the production handler in `keyboardShortcuts.html` in both environments.
Used Prepare real-key check, Command-Shift-D in the synthetic editor, and Command-Shift-A
with the synthetic Archive button focused. Counters showed one native-button callback
per press and zero Discard callbacks. Repeated separate Send presses and subsequent
plain `d` typing passed in the Gmail app after fixing omitted macOS release events.
The user's Gmail app was returned to Gmail after each local fixture check.

These pages have no Gmail connection and cannot send mail or archive real conversations.
The compatibility page intentionally only counts key events; production logic lives
solely in the content module. No private content or diagnostic footage is committed.

With the installed extension in Gmail, Command-Shift-A displayed Gmail's native
"Conversation archived" confirmation. The test conversation was then restored using
Move to Inbox and verified in the inbox. No actual email was sent.

## Regression results

Run `node --test tests/settings.test.cjs`, then `python3 scripts/serve-tests.py` and the
browser fixtures at `http://127.0.0.1:8765/tests/`.

| Suite | Passed |
|---|---:|
| Settings / lifecycle / Mac platform gate | 27/27 |
| Keyboard shortcuts | 35/35 |
| Popup settings | 16/16 |
| Floating composer | 33/33 |
| Auto BCC | 32/32 |
| Message zoom | 16/16 |
| Message list / right-aligned labels | 20/20 |
| Apple Mail appearance | 54/54 |
| Reading pane | 30/30 |
| Thread ordering | 42/42 |
| Label ordering | 14/14 |

All 319 checks passed.

Shortcut scenarios cover fresh target resolution after navigation/replacement, independent
preferences, key repeats/releases, missing/disabled/hidden/ambiguous controls, competing
native event handlers, zero discard activation on enabled paths, multiple drafts, nested
regions, full-screen/minimized surfaces, preserved text, BCC insertion/manual removal,
native-button validation, listener deduplication, and teardown.

## User-triggered live Send check

Actual Gmail sending remains a user-triggered acceptance check. Refresh Gmail after
loading 0.9.17, focus a draft you intend to send, then press Command-Shift-D. Confirm the
normal Send result and Undo Send availability. Also confirm that Command-Enter still
works normally. No actual email was sent automatically during development.

Supported contract: English desktop Gmail in Mac Chrome/app windows. Browser chrome
focus is outside page interception; disabled features and non-Mac platforms retain
native behavior. Gmail markup changes fail closed for actions. If the extension fails
to load or is disabled, Gmail's original Discard shortcut applies.
