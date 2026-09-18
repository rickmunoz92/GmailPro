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

## Automated results

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
