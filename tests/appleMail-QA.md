# Apple Mail Mode — implementation and QA

Date: 2026-09-18. Version: 0.7.0. Branch: `codex/apple-mail-mode`.

## Architecture and ownership

- CSS-first skin under `html.gmail-pro-apple-mail-mode` with shared theme/accent
  tokens, independent of Gmail's mail engine and the existing two-line list toggle.
- `content/appearance.js` owns only root class/attributes and system theme listening.
  Settings use the existing `shared/settings.js` subscription; no new storage owner.
- Added settings: `gmailPro.v1.appleMailModeEnabled` (false),
  `gmailPro.v1.appearanceTheme` (dark), `gmailPro.v1.accentColor` (blue).
- Native state: `.zE` unread; `.aps` open reading-pane conversation; `.TO.nZ`
  current mailbox. Checkbox `aria-checked` is multi-selection. `.btb` is focus.
  No duplicate selected/unread state, subject matching, ID parsing or read-state inference.
- Themes: Dark, Light, Follow system. Eight accents, with token-driven contrast.
  Orange/Yellow use dark foregrounds. All selected text pairs tested at >= 4.5:1.
- Approximately 216px sidebar when expanded on wide windows; 57px rows including
  separators in live Gmail; native pane widths/splitter, scroll geometry, nested
  labels, count visibility, event handlers and accessible structure retained.
- Dark Gmail chrome, flat panes, neutral sidebar selection, compact compose/search,
  two-line rows, 6px unread dots, full-accent conversation/multiselect backgrounds.
  Native email HTML, warnings, attachment actions and message formatting are preserved.
- Reused Auto BCC, reverseThreads/shared discovery, messageList, labelOrder,
  messageZoom and native pop-out handling. No separate pop-out/full timestamp/
  conversation-cleanup feature existed. No APIs, network interception, telemetry,
  dependencies, permissions or fonts added.

## Files

New production files: `content/appearance.js`, `content/appleMail.css`,
`shared/theme.css`. Settings, popup, manifest and content lifecycle are extended.
`messageList.css` is reused by both list mode and master mode.

New tests: `appleMail.html`, `appleMail.browser.js`, `appearance.integration.js`,
`messageRow.fixture.js` (shared synthetic row factory extracted from list tests).
Existing settings/popup tests and cross-feature HTML harnesses are extended.

## Initial implementation automated results

| Suite | Passed |
| --- | ---: |
| Node settings/lifecycle and manifest/syntax/resource validation | 21/21 |
| Auto BCC | 27/27 |
| Newest-first thread ordering | 41/41 |
| Message list | 20/20 |
| Custom label order | 14/14 |
| Message zoom | 16/16 |
| Popup | 14/14 |
| Apple Mail appearance | 30/30 |
| Auto BCC with Apple Mail Mode | 27/27 |
| Thread ordering with Apple Mail Mode | 41/41 |
| Message zoom with Apple Mail Mode | 16/16 |
| Label ordering with Apple Mail Mode | 14/14 |

Total: 21 Node tests, 162 baseline browser checks, 98 additional integration checks.
Browser checks use real Chrome DOM/CSS with synthetic messages only. Fixtures do
not send mail. Commands and local fixture URLs are in README.

Appearance coverage: root toggle/restoration, enum validation/deletion, startup and
storage races, immediate independent saves, failed-save rollback, incoming sync,
system-change lifecycle, all 16 theme/accent contrast combinations, native unread
and open/checked/focused rows, neutral mailbox selection, count contrast, nested
labels, 320/380/680/1200px lists, long text, hover-action spacing, retained handlers,
SPA replacement, original HTML/editor formatting, light document canvas and external
Dark Reader ownership. Existing suites cover synthetic replies/reply-all/forwards,
multiple composers, zoom levels, 500-message threads, label dragging and cancellation.

## Live Gmail checks performed

Inspected English desktop Gmail DOM before implementation and tested the installed
unpacked extension. The user enabled Dark/Blue via the actual popup, and the running
Gmail root updated live. No mail was sent. No email content, screenshots, recipients,
subjects, attachment contents, or session data were saved to the repository.

Verified:

- Current Inbox, custom parent label and nested label selections use native `.nZ`.
  Neutral background and accent text/icon remain distinct from conversation selection.
- Existing reading pane, read/unread rows, native `.aps` changes between already-read
  conversations, native checkbox selection distinct from keyboard focus.
- Visible unread dot: 6px, 13px reserved sender spacing, 57px row height. Live inspection
  caught and fixed CSS specificity overlap with the older message-list stylesheet.
- Selected sender/subject use the accent contrast colors. Live label metadata uses
  nested `.at .av` elements; fixtures now include this structure and test its contrast.
- Inbox/custom/nested-label navigation and Browser Back/Forward preserve the skin.
  Gmail retains hidden cached tables; visual checks use visible rows, not stale caches.
- Original HTML mail, images, lists and thread controls remained present in the reading
  pane. Existing newest-first styling and custom-label ordering were present in-session.
- New compose opens with the native editor and controls. Only the empty QA composer
  was discarded; no message was sent and no existing drafts were edited.
- Reloading the extension and Gmail preserves the saved master/theme/accent settings.

Dark Reader and other mail add-ons were active during live QA. Their settings were
not changed. Gmail Pro deliberately does not take over Dark Reader's document canvas.
Exact theme fidelity without other extensions is covered by controlled fixtures,
not established by this particular live session.

Browser policy blocked direct navigation to extension settings. The user enabled
Dark/Blue using the normal popup. Live testing did not automate other accent/theme
changes or OFF restoration; those paths passed real-browser synthetic tests.

## Performance and boundaries

No timers, polling, row scans, layout reads, node retention, per-row writes, or new
ongoing MutationObservers in appearance code. A one-shot document-child observer
runs only before `<html>` exists. Follow system installs exactly one media listener,
released on fixed-theme selection, OFF, or page exit. Existing features retain their
own observation strategy; existing idle/cleanup/mutation-burst tests pass.

CSS necessarily participates in Gmail style recalculation. The largest selectors
are structurally gated `:has` row/region checks. No hours-long production memory/CPU
profile was performed; there is no claim of measured zero cost.

Gmail DOM is undocumented. Presentation hooks can change, some semantic labels are
English, and unknown rows fail closed. Desktop Chrome 118+ is required for `@scope`.
Gmail owns enabling/right-vs-bottom reading pane, splitter sizes and navigation.
There is no custom splitter or parallel pane-width store.

Only chrome and known menu/dialog surfaces are recolored. Compose editors retain
native formatting/appearance, which may be light. Message HTML is not inverted;
without another body-theme owner, a light wrapper canvas supports transparent mail.
The Workspace app rail remains available so third-party security add-ons are not
hidden. Gmail's Ask Gmail-branded search remains functional. The browser/window frame
is outside content-script control. Other Gmail extensions may compete with styling.

Master OFF restores native chrome; separately enabled list/zoom/order/BCC features
remain enabled. Disable the standalone list switch too if fully native rows are wanted.

## Manual acceptance checks

1. In Gmail Pro, switch Dark → Light → Follow system, then change the macOS theme.
   Verify open Gmail updates without refreshing. Try all accents, especially Yellow
   and Orange: selected text should be dark and mailbox selection should remain gray.
2. Turn Apple Mail Mode OFF/ON. Confirm native chrome returns and other independently
   enabled features stay configured. Turn off the separate list switch for native rows.
3. With disposable mail, mark unread/read, open an unread conversation, switch rows,
   multi-select, star/unstar, and inspect label/attachment metadata and hover actions.
4. Resize the native split pane narrowly and widely; collapse/expand the sidebar and
   More labels; reorder a label with the existing handles. Try search, Sent and Drafts.
5. Check long/short threads, collapse/expand, message zoom, attachment previews, external
   content/security warnings, and complex newsletter images/tables. Try full-thread view.
6. Open disposable new/reply/reply-all/forward drafts and multiple compose windows;
   verify Auto BCC and Shift-pop-out. Check outgoing formatting manually; do not send
   test messages. Compare with competing theme extensions disabled for Gmail.
7. Use ordinary Gmail keyboard navigation and a screen reader, and keep a tab open
   during normal daily use. These are not certified by the synthetic suites.

## Git preservation and delivery

The pre-existing uncommitted thread-discovery change was preserved in commit
`8f35eda` with its existing regression tests. The requested original project also
retains a named stash backup of that exact source change; the implementation includes
it, so the backup should not be reapplied over the new branch.

Implementation commits include `a366049` (appearance foundation/UI/state tests) and
`7f22c78` (spacing/document-boundary/integration hardening). The final documentation
and contrast hardening are recorded in the branch's later commit. Work is delivered
on `codex/apple-mail-mode` without rewriting `main` or force-pushing. Nothing is
published to the Chrome Web Store.


## Appearance refinement — 0.7.1, 2026-09-18

The follow-up design request hides list star/importance cells and reclaims their
column space, removes conversation/label hover fills and pointer-following row
outlines, and uses identical read/unread sender, subject and timestamp typography.
The native unread dot alone communicates read state. Actual selected rows/mailboxes
and keyboard `:focus-visible` outlines remain visible. Native hover action buttons
are retained. Dark main/sidebar/toolbar backgrounds now use exactly `#23292B`.

Targeted verification: 21/21 Node checks, 34/34 appearance browser checks, 20/20
standalone message-list checks, and 14/14 popup checks. Appearance tests cover native
hover classes, hidden-control restoration and reclaimed spacing, matching read/unread
colors and weights including nested timestamps, exact dark surface colors, and all
existing contrast and layout cases. Browser fixtures were run in Codex's Chromium
browser; these refinements were not revalidated in live Gmail. Reload the development
extension and Gmail to apply the updated bundled styles.

## Label feedback refinement — 0.7.2, 2026-09-18

Inspected live Gmail's label `data-tooltip` attributes, portaled `.T-ays` tooltip
styles, and native yellow `.nY` drop-target stylesheet. Apple Mail Mode now hides
that tooltip while a mailbox row is hovered or targeted and colors native sidebar
drop targets with the selected accent and contrasting text/icons. No listeners,
DOM changes, or drag interception were added.

Validation: 21/21 Node checks and 36/36 Chromium appearance checks passed, including
drop-target contrast across all 16 theme/accent pairs, selected/unselected wrapper
restoration, hover/drag tooltip suppression, and mode-OFF restoration. Existing
message/editor boundary checks pass. Live hover/drag gestures were not replayed;
reload the development extension and Gmail to apply and visually verify the update.

## Quiet conversation hover — 0.7.3, 2026-09-18

Reviewed frames from the user's hover recording and inspected live Gmail's checkbox
opacity, ripple, drag-grip, and row action CSS. Apple Mail Mode now hides the native
per-row action toolbar and retains dates/attachment icons on hover. Unchecked
checkbox opacity no longer changes with pointer/row focus, and checkbox ripples
and hover grips are suppressed. Checked boxes, open-row checkboxes, keyboard focus,
main toolbar actions, and native click/drag behavior are preserved.

Validation: 21/21 Node checks, 37/37 appearance browser checks, and 20/20 standalone
list checks passed. Regression coverage includes steady opacity, hidden toolbar,
metadata visibility at four widths, checkbox selection/focus, and mode-OFF
restoration. Updated styles require an extension/Gmail reload; live gestures were
not replayed after installation.

## Checkbox-free selection — 0.8.0, 2026-09-18

The native conversation checkbox column is hidden and its grid space reclaimed.
Ctrl/Command-click toggles a conversation through Gmail's own checkbox handler;
Shift-click selects a range within the currently rendered table, and combining
Ctrl/Command with Shift adds a range. Ordinary row clicks and nested controls stay
native. The range anchor is checked against route, table membership and thread
identity; mode OFF releases delegated handlers and restores checkboxes. There is
no parallel selection store, Gmail ARIA mutation, polling or per-row observer.
The macOS Control-click contextmenu companion is suppressed without a second toggle;
ordinary right-click remains available.

Validation: 21/21 Node lifecycle/settings checks and 41/41 Chromium appearance checks
passed. Coverage includes hidden-column restoration, native checkbox dispatch,
disjoint selection/toggling, forward/reverse/contracting/additive ranges, missing
and recycled anchors, SPA replacement, nested controls, OFF cleanup, and Mac
context-menu behavior. Live Chrome/Gmail verified hidden row checkboxes, Ctrl-click
selection, Shift-click selecting three conversations, Command-click deselecting one,
and native bulk-action availability. Unread count stayed unchanged; no bulk action
was executed. Live testing used a separate temporary tab to preserve the user's
existing open view.


## Blank-list deselection and loading popup — 0.8.1, 2026-09-18

The dedicated `.vY > .vX` loading banner containing `.vZ.L4XNt > .v1` is
hidden in Apple Mail Mode. General alert and Undo notifications are unchanged.
An ordinary click below the last rendered conversation in `.Nu.tf` clears native
checkbox selection, resets the Shift anchor, and dispatches Gmail's complete
native `u` key sequence to close the reading pane. No selection attributes or
message HTML are modified. This native command requires Gmail keyboard shortcuts;
the extension does not change the user's shortcut setting. Other panes, row-height
areas, controls, footers, modified clicks and mode OFF keep native behavior.

Validation: 21/21 Node checks and 44/44 Chromium appearance checks passed. Live
Gmail in a separate QA tab verified that an open read conversation closes to
“No conversations selected,” and that a checked/open conversation clears both
checkbox state and the preview. A label navigation populated the loading banner
with computed display `none`. No mail was sent, deleted, moved or archived.
The installed unpacked extension was updated and reloaded; existing Gmail views
need refresh to receive the new content script.
