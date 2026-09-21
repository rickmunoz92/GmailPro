# Native Shift-click composer QA — 2026-09-21

## Implemented behavior

The user's simplified plan supersedes the earlier transition/state-machine proposal.
Normal primary clicks on supported Reply, Reply All, and Forward controls forward each
native pointer/mouse phase once with Shift in actual event data. Gmail creates the
floating composer directly. Explicit modifiers, disabled controls, existing composers,
message bodies, and unknown controls remain untouched. Keyboard shortcuts stay native.

The adapter has four delegated capture listeners and no observer, timer, draft tracking,
Pop Out activation, hidden editor, or delayed fallback. Independent switches and the
existing start/update/stop lifecycle remain. The persistent toolbar still delegates to
Gmail's native action. Unknown layouts fall back to ordinary Gmail behavior.

Auto BCC owns recipient discovery independently. Its existing initial delay, microtask
recipient processing, duplicate checks, focus restoration, and memory-only draft identity
history remain. A bounded five-second watcher handles a focused floating shell whose
addressing form arrives later, including a nested native region. Discovery, removal,
deadline, and teardown release that watcher.

Composer styling and popup styling are removed at the source. Inline, floating, new,
minimized, and full-screen composers, plus all menus/listboxes/dialogs, remain native.
There is no ownership metadata, popup observer, forced-white skin, or reset stylesheet.
Apple Mail Mode continues to style the main inbox, sidebar, and reading toolbar.

## Automated validation

Run `node --test tests/settings.test.cjs`, then `python3 scripts/serve-tests.py` and open
the HTML suites at `http://127.0.0.1:8765/tests/`. Test-only resource instrumentation
counts the two production modules' observers/listeners, excluding browser tooling.

| Suite | Passed |
|---|---:|
| Settings / lifecycle | 24/24 |
| Native Shift composer + Auto BCC integration | 33/33 |
| Auto BCC | 32/32 |
| Apple Mail appearance | 54/54 |
| Reading pane | 30/30 |
| Thread ordering | 42/42 |
| Message list | 20/20 |
| Label ordering | 14/14 |
| Message zoom | 16/16 |
| Popup settings | 15/15 |

Integration checks include native modifier data/getModifierState, nested targets,
coordinates and pointer identity, all four event phases, early header activation,
cancellation, independent switches, explicit modifiers, disabled/unrelated controls,
unknown markup, no late conversion, teardown, Auto BCC ON/OFF, delayed forms, multiple
drafts, duplicate recipients, manual removal across form replacement, focus retention,
and watch expiration. Appearance tests compare computed native surfaces across dark,
light, and system modes, including detached/nested/recycled menus and dialogs.

## Live Gmail validation

Tested the updated unpacked extension in a dedicated Chrome Gmail tab with existing
Apple Mail Mode and Auto BCC enabled. No email was sent. Only drafts created during
these checks were discarded; no preexisting draft was edited or discarded.

- Persistent-toolbar Reply and Forward: one floating composer, zero inline editors
  outside dialogs, one BCC chip. Reply keeps Message Body focus; Forward keeps To focus.
- Native header Reply All and detached native menu Forward: direct floating composer,
  zero inline editors outside dialogs, one BCC chip.
- Explicit Shift-click on the native header (bypasses the adapter): same native floating
  result, BCC count, and body focus as the ordinary automatic-Shift click.
- Minimize, restore, full screen, and return from full screen use Gmail's native controls.
- New Compose alongside a minimized reply produces two independent drafts with one BCC
  each; the reply remains minimized. New Compose keeps To focus.
- Visually inspected white Gmail composer and full-screen surfaces while the inbox and
  sidebar retain dark Apple Mail Mode. Native signature and quoted content remain.

These checks verify behavior and native presentation, not a numerical opening-time
promise. Gmail can still render its shell before signatures and recipient UI finish.
No timing numbers or recordings from the older implementation are acceptance evidence
for this revision. No private inbox data, screenshots, or recordings are included in Git.

## Limits

Auto BCC OFF and theme OFF/ON equivalence were verified in fixtures; the complete live
settings matrix was not repeated. Earlier browser policy blocked the privileged extension
settings URL; no workaround was used. Attachment upload, image drag/drop, Send, and every
native popup type were not exercised in this revision. No code intercepts those controls.

English desktop Gmail action labels and structural hooks are assumed. Native Gmail
changes can make a control fall back to inline behavior. A new compose identity, page
reload, or identity-history eviction can reapply a manually removed BCC; review recipients
after reopening a saved draft. Minimize/restore does not create a new identity.
