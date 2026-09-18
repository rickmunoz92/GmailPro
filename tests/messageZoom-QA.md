# Message-only zoom QA

Tested September 18, 2026 on macOS 26.6.2 / Chrome 153.0.8010.48.
No email was sent. No real mailbox content or captures are included here.

## Behavior and implementation

- Enable **READING → Message-only zoom** in the popup and save. Default is off.
- Command `=` / `+` advances; Command `-` reduces; Command `0` resets.
- Levels: 80, 90, 100, 110, 125, 150, 175, 200 percent; both ends clamp.
- Per the product-owner follow-up, zoom resets on the **next conversation**, on
  leaving the conversation, refresh, and disable. Expanding messages within the
  same conversation keeps one consistent level. Only the boolean feature switch
  persists via the existing Chrome Sync settings adapter. No level is persisted.
- CSS `zoom` targets `.ii > .a3s` within expanded `[role="listitem"]` wrappers,
  identified `[data-message-id][data-legacy-message-id]` envelopes, a conversation
  `[role="list"]`, and `[role="main"]` containing an identified thread heading.
  The targeted body excludes sender/header controls, attachments, and reply UI.
- `window` capture-phase `keydown` requires `metaKey`, a recognized `key`, a
  cancelable unhandled event, and one visible readable conversation. Inputs,
  search, compose, editable descendants, extension controls, overlays and
  ambiguous contexts are excluded. Only `preventDefault()` is needed; propagation
  remains intact. No deprecated key codes or global extension commands.
- Auto-width CSS participates in layout. Inline-size containment and local
  horizontal scrolling keep fixed-width tables/images within their message.
  Nothing is rewritten, cloned, or reparented. At 100%, native styles apply.
- Existing `reverseThreads` discovery is shared through `subscribeConversation`;
  it stays active for either ordering or zoom, and releases when neither needs it.
  Heading identity changes are observed directly. No new broad SPA observer,
  body-content observation, polling, or repeated idle timer is introduced.

## Automated checks

`node scripts/validate.cjs`: manifest/resources/syntax/permission validation and
19 settings/lifecycle tests passed. Browser fixtures (real Chrome):

| Suite | Result |
| --- | --- |
| Message zoom | 15/15 |
| Thread ordering | 34/34 |
| Auto BCC | 27/27 |
| Message list | 20/20 |
| Label order | 14/14 |
| Popup | 13/13 |

The 15 zoom cases include every level and clamp, US Mac key variations, narrow
and wide layouts, explicit pixel fonts, images, a wide table, long/plain/HTML
content, exclusions, ambiguous/hidden/missing threads, modals, expansion, selection,
links/details, existing-feature coexistence, SPA replacement and reused thread
identity, no level writes, refresh/start, disable, and observer ownership.

Fixtures cannot establish native Chrome shortcut handling by themselves. Native
macOS keyboard input was tested separately, as described below.

## Live Chrome/Gmail checks

- Initial trusted-event probe: Command `=`, shifted plus, minus and zero reached
  a capture handler as cancelable events. `preventDefault()` kept the page scale
  unchanged. Both browser-dispatched trusted events and native app keyboard input
  were checked; only native input was used to verify Chrome default zoom behavior.
- Installed extension: native Command plus/minus/reset in the actual Gmail app
  window changed only the reading body. All eight levels and repeated clamps also
  passed trusted-event checks on a live HTML email containing images/tables.
- Page zoom was reset to 100% before checks. Device pixel ratio stayed 2 and the
  viewport stayed 1710 CSS pixels during reading zoom. At every supported level,
  message-list width stayed about 469px, search width 617px, and main width 1398px.
  Thread-heading font stayed 22px. Body width stayed within its allocated pane;
  the tested HTML email had no horizontal body or outer-pane overflow.
- Native Inbox/search/feature-off Command plus changed Chrome page scale to 110%
  (device pixel ratio 2.2, viewport 1554); native Command zero restored 100%.
  Thus default browser zoom remains available when this feature does not apply.
- Moving to another read email reset message zoom from 125% to 100%. Refresh
  started at 100%, with the feature toggle still enabled. No-message Inbox was
  excluded. Existing right-hand reading-pane dimensions were preserved.
- Two-message conversation expanded with Gmail's **Expand all**: both bodies
  received 125%, while headers and thread controls retained native sizing.
- Reading pane temporarily disabled: full-conversation native Command plus worked
  at 110% with unchanged browser scale. Original split-pane setting was restored.
- Compose: a new unsent test composition was focused. Command plus/reset left the
  editor at CSS zoom 1 and its HTML length and inline styles unchanged. Existing
  Gmail/Chrome handling was left alone. Only this test draft was discarded.
- Auto BCC, Newest Email First, Apple Mail-style Message List and Custom Label Order
  were enabled during live checks; their complete synthetic suites passed too.
- No warning/error console entries were captured during the live check.
- Feature left enabled, message level 100%, browser zoom 100%, original right-hand
  reading-pane mode restored. No account/label/recipient preference was changed.

## Remaining limits / manual checks

Gmail selectors are not a public API. Unknown/ambiguous structures intentionally
retain browser shortcuts. Non-US keyboard layouts, other browsers, assistive
technology, browser-menu/trackpad zoom, and conflicting shortcut extensions were
not certified. Normal inputs, local horizontal scrolling for oversized tables,
selection and link/attachment handler preservation received synthetic coverage;
real attachment downloads and clipboard copy were not exercised. Plain-text-like
content was tested synthetically without inspecting real message MIME data.

After an update, reload the extension and Gmail if necessary. Try a particularly
wide HTML newsletter, copy selected text, open an attachment normally, and check
any non-US keyboard or screen-reader workflow you rely on. These are additional
compatibility checks, not required setup. No fallback shortcut is required on the
tested Chrome/macOS version.

## Changed files

Runtime: `content/messageZoom.js`, `content/messageZoom.css`, `content/content.js`,
`content/gmailSelectors.js`, `content/reverseThreads.js`, `shared/settings.js`,
`popup/popup.html`, `popup/popup.js`, `manifest.json` (0.6.0).

Validation/docs: `tests/messageZoom.html`, `tests/messageZoom.browser.js`,
`tests/settings.test.cjs`, `tests/popup.browser.js`, `scripts/validate.cjs`,
`README.md`, and this QA record.


## Follow-up: maximum-zoom scrollbar bounce

The reported recording exposed a height-dependent case missed by the initial QA.
At a 1710 × 970 CSS-pixel viewport and 200% message zoom, the right reading pane
alternated between 908px and 892px of available width. Gmail rounded and rewrote
its inner width as scrollbars appeared/disappeared; message width oscillated
between 820px and 804px even though the zoom level stayed at 200%.

A scoped `scrollbar-gutter: stable` on Gmail's identified `.Nu.S3` reading scroller
reserves its scrollbar space during non-100% message zoom. It leaves the allocated
pane width, message-list width, and zoom levels unchanged, and native gutter rules
return at 100% or when disabled. It does not alter thread discovery or ordering.

The regression fixture deliberately reproduces the original alternating scrollbar
geometry with the gutter set to auto, then requires stable geometry over 120
animation frames with the production rule. Live retesting on the affected email
at the recorded height settled at a consistent 804px message width, with no outer
horizontal overflow. The recording and extracted frames stay outside the repository.

Follow-up validation: 19 settings/lifecycle checks and all browser suites passed:
zoom 16/16, thread ordering 41/41 (including pre-existing workspace changes),
Auto BCC 27/27, message list 20/20, label order 14/14, popup 13/13. An Auto BCC
focus case failed during the parallel run and passed when rerun independently.
Chrome logged generic asynchronous message-channel closure errors during the
extension reload; no zoom-script stack trace was reported. Normal viewport and
100% message zoom were restored after live testing. Pre-existing thread-ordering
and README changes were preserved and are not part of this fix commit.
