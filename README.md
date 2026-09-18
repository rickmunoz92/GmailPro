# Gmail Pro

**Power-user enhancements for Gmail.**

Gmail Pro is a lightweight Chrome extension that adds useful power-user
functionality to the Gmail web interface. It runs locally in your browser, with
plain HTML, CSS, and JavaScript—no build step, runtime dependencies, or backend.

## Features

- **Apple Mail Mode:** a cleaner macOS-inspired Gmail interface, with dark/light/system
  themes, eight accent colors, unread dots, accent-selected conversations, and a
  neutral selected mailbox with accent text/icons. Gmail remains the mail engine.

- **Auto BCC:** automatically add a configured address to new messages, replies,
  reply-all messages, and forwards. Each composition is handled independently.
- **Newest Email First:** show the newest message at the top of an opened Gmail
  conversation. This changes presentation only; it does not sort the Inbox or
  change Gmail's stored messages.
- **Apple Mail-style Message List:** displays Gmail messages using a cleaner
  two-line sender/subject layout optimized for readability, especially beside
  the reading pane. Labels, attachments, selection and native controls stay available.
- **Message-only Zoom:** enlarge or reduce message content with ⌘+, ⌘−, and ⌘0
  without scaling Gmail’s interface. Resets to 100% for each new conversation.
- **Custom Label Order:** choose the visual order of custom Gmail labels without
  renaming or modifying those labels in Gmail.

All features are off by default. Open the extension popup to enable **Apple Mail
Mode**. Appearance settings save and apply immediately. Other features live under
**Mail tools & advanced appearance** and use **Save preferences**.

## Installation

1. Clone this repository or download and extract its source ZIP.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh any open Gmail tabs, then open Gmail Pro from Chrome's Extensions menu.

After updating the source, reload Gmail Pro in `chrome://extensions`, refresh
Gmail, and reopen the popup. The repository contains the unpacked extension; no
Chrome Web Store installation or OAuth sign-in is required.

## How it works

### Apple Mail Mode

Provides a cleaner macOS-inspired Gmail interface while retaining Gmail as the
underlying mail engine. This is a presentation layer, not a separate mail client.

Under **APPEARANCE**, turn on **Apple Mail Mode**. Choose **Dark** (default),
**Light**, or **Follow system**, independently of **Accent color**: Blue (default),
Purple, Pink, Red, Orange, Yellow, Green, or Graphite. Changes persist through the
existing `chrome.storage.sync` adapter and reach open Gmail tabs without a reload.
No Gmail permissions, API calls, data stores, analytics, or dependencies are added.

For the three-pane layout, use Gmail's own **Settings → Reading pane → Right of
inbox**. Gmail Pro styles the existing panes; it does not enable a Gmail preference
behind your back or simulate a reading pane. Gmail owns splitters and saved pane
widths. The expanded mailbox sidebar is about 216px on wide desktop windows; narrow
windows and collapsed navigation retain Gmail's sizing. Header geometry stays native
so Gmail's measured scrolling regions remain correct.

- **Unread:** Gmail's `.zE` state displays a 6px accent dot aligned with the sender line and
  identical text styling for read and unread messages: bold senders with regular
  subjects/dates in compact, approximately 46px rows. The dot
  alone indicates unread status; both states share the same background.
- **Current conversation:** Gmail's `.aps` reading-pane state fills the row with
  the chosen accent. Text, timestamps, labels, and icons receive contrasting colors.
  The dot is hidden while selected, without changing the native unread state.
  Multi-selection follows Gmail's `aria-checked` state, with row checkboxes hidden.
  **Ctrl-click** (or **Command-click** on Mac) toggles individual conversations.
  **Shift-click** selects a range of currently displayed rows; Ctrl/Command-Shift-click
  adds that range. A normal click still opens the conversation. Keyboard focus
  (`.btb`) keeps an outline and is not mistaken for an opened conversation.
- **Current mailbox/label:** Gmail's `.TO.nZ` state gets neutral gray selection
  chrome with an accent-tinted icon/text. Counts stay readable; nesting and
  disclosure controls retain Gmail's hierarchy and behavior.

JavaScript in `content/appearance.js` applies one root class,
`gmail-pro-apple-mail-mode`, and two preference attributes. Four delegated capture
listeners implement modifier-click selection by clicking Gmail's own checkbox
controls; the extension never writes Gmail's selection attributes or stores a
parallel selected-message list. Range discovery is limited to visible rows in the
clicked table body, on a user gesture. The anchor is validated against its thread
identity, current table and route to avoid stale selections after navigation.
An ordinary click below the last row in the split conversation-list pane clears
native checked rows and the range anchor. Gmail's native `u` (back-to-list) key
sequence clears any open reading pane; Gmail keyboard shortcuts must be enabled
for that native command. The extension does not change that account preference.
Row clicks, message content, controls, footers and modified blank clicks remain
native. The dedicated top-center label-loading banner is hidden; alert/Undo toasts
remain visible. Both changes apply only while Apple Mail Mode is enabled.
The root/row appearance controller has no per-row listeners, polling, message
parsing, or ongoing DOM observers. Reading-pane actions use the separate narrow
chrome observation described below.
A one-shot observer handles document-start before `<html>` exists; a media-query
listener runs only for Follow system. Disabling/page exit removes all listeners,
root styling, and the temporary range anchor.

`shared/theme.css` is the single token/palette definition for Gmail chrome and the
popup. It supplies surface, text, border, focus, sidebar, and accent variables.
Precomputed luminance-based foreground choices use dark text for Orange/Yellow and
white for the other six accents. Sidebar tint variants account for the neutral
background in each theme. Browser tests require at least **4.5:1** for selected
subject/date/label text and selected sidebar text/counts across all 16 theme/accent
pairs. `content/appleMail.css` documents the native selector contract and scopes
chrome styling away from message HTML and editable content.

The existing `messageList.css` supplies the two-line layout. Auto BCC, Newest Email
First, Message-only Zoom, and Custom Label Order keep their existing implementations
and independent settings. Reorder controls adopt the selected appearance. Native
reply, forwarding, attachments, warnings, search, message actions, compose and
compose Shift-pop-out handlers remain Gmail's. Shift-click on a conversation row
selects a range while Apple Mail Mode is enabled. No separate Pop-out Compose, full timestamp,
or conversation-cleanup feature existed in this baseline, so none is duplicated.

Message fonts, HTML, images and tables are not rewritten or inverted. A light Gmail
message-wrapper canvas keeps transparent documents readable beside dark chrome.
If Dark Reader advertises ownership of document colors, its canvas is left alone.
Compose title chrome is styled; the editable message, its formatting, addressing,
and outgoing HTML are untouched. The composer may therefore retain a light editor.
Gmail Pro cannot recolor Chrome's own tab/address bars or a separate window's frame.

Dark main surfaces, sidebar, and toolbar use `#23292B`. Conversation-list stars and
importance chevrons are hidden in this mode, without changing their Gmail state or
reading-pane actions. Label/conversation hover backgrounds and pointer-following row
outlines are suppressed; actual selection and keyboard focus remain visible. Native
row checkboxes and their column are hidden; modifier-click selects conversations. Per-row hover action buttons are hidden;
dates and attachment icons stay visible, and actions remain in the main toolbar.
Mailbox-name hover tooltips are suppressed,
and native label drop targets use the selected accent with a contrasting foreground.
Turning the mode off restores native controls and tooltip/drop-target styling.

Turn **Apple Mail Mode OFF** to restore Gmail's native chrome immediately. Other
independent features remain as configured. If **Apple Mail-style message list** was
already enabled, it remains on; switch it off under advanced settings for fully
native rows. No uninstall or Gmail refresh is needed for preference changes.

Compatibility is intentionally conservative: desktop Gmail/Chrome 118+ only. Native
roles and structure are used where available; Gmail's undocumented presentation
classes remain necessary for unread/selection and some chrome. Unknown row layouts
retain native presentation. Some menus/dialog interiors and Workspace/Chat/Meet
controls stay native; the Workspace rail remains reachable, including installed
security add-ons. Standalone Gemini and Google app-launcher buttons are hidden;
Gmail's search (including an Ask Gmail-branded field), advanced search, account and
settings controls remain available. Other theme extensions can recolor the result;
turn them off for Gmail when evaluating Gmail Pro's own theme and palette.

See [Apple Mail Mode QA and handoff](tests/appleMail-QA.md) for verification, remaining
manual checks, performance boundaries and the implementation file map. The visual
reference is [Apple's Mail viewing settings](https://support.apple.com/en-nz/guide/mail/cpmlprefview);
this implementation is independently designed and does not bundle Apple fonts.

### Auto BCC

The extension observes Gmail's composition and recipient controls. A composition
captures the settings when it is first detected. If the address is valid and not
already in To, CC, or BCC, Gmail Pro reveals BCC and commits one recipient through
Gmail's normal interface. Address matching ignores case and surrounding whitespace,
including contact chips; dots and plus tags are preserved.

Manually removing the inserted BCC keeps it removed for that composition. Settings
changes affect future compositions, and disabling Auto BCC cancels pending additions.
Existing recipients are not rewritten. Reopening a saved draft or refreshing Gmail
creates a new composition instance; existing recipients still prevent duplicates.
Gmail Pro does not intercept or trigger **Send**.

### Newest Email First

A bundled stylesheet loads early. Narrow MutationObservers validate the conversation
container and activate CSS ordering before the next paint. Lists containing only
message wrappers use `column-reverse`. A fallback preserves fixed controls' slots
when they are interleaved with messages. Turning the feature off restores the native
presentation.

Read status and expanded/collapsed state do not affect ordering. Discovery waits
for Gmail's list role, heading metadata, and complete message wrappers, including
slow or staged reading-pane loads. Once validated, it returns to shallow watches
outside message bodies; removing the pane re-arms discovery for its replacement.

Complete wrappers keep their sender details, attachments, message controls, and
inline composers. Message nodes are never moved or cloned; timestamps and server-side
conversation data are unchanged. No threads are prefetched, opened in the background,
or downloaded by the extension.

### Apple Mail-style Message List

Under **Mail tools & advanced appearance → MESSAGE LIST**, enable **Apple Mail-style message list** and select
**Save preferences**. Sender and date appear on the first line; labels and the
actual subject appear on the second. Known snippet elements are hidden visually,
with their DOM and preview data preserved. Long text truncates with an ellipsis.
Rows are approximately 56px tall, and Gmail continues to control unread weights,
selected backgrounds, stars, importance, attachment indicators and hover actions.

This is a CSS Grid presentation of Gmail's existing cells, not a replacement inbox.
No messages or cells are moved, cloned, parsed or rewritten. The shared settings
adapter stores `gmailPro.v1.appleMailMessageListEnabled` in `chrome.storage.sync`.
Turning it off and saving restores the native appearance immediately, without a
Gmail refresh. Auto BCC and Newest Email First remain independent.

JavaScript toggles one extension-owned class on `<html>`. Persistent CSS handles
Gmail navigation and inserted/replaced rows automatically. There are no row scans,
polling, layout reads, event interception or ongoing MutationObservers. If startup
precedes `<html>`, a one-shot observer watches only the document's direct children
and disconnects as soon as that element exists. Colors and fonts remain Gmail's,
including existing dark themes; this standalone feature does not implement a dark mode. Apple Mail Mode adds the
separate optional color system described above.

### Message-only Zoom

Under **READING**, turn on **Message-only zoom** and save preferences. While reading
an open conversation, use **Command +** (or **Command =**) to enlarge its content,
**Command −** to reduce it, and **Command 0** to reset to 100%. Supported levels are
**80%, 90%, 100%, 110%, 125%, 150%, 175%, and 200%**, clamped at either end.

Zoom is temporary for the current conversation. **Opening another conversation,
leaving it, refreshing Gmail, or disabling the feature resets it to 100%.** Expanding
another email within the same conversation keeps the current level, consistently
across all expanded bodies. Only the on/off preference is saved in `chrome.storage.sync`
(`gmailPro.v1.messageZoomEnabled`); the level is never stored or synchronized.

The feature applies layout-aware [CSS `zoom`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/zoom)
to `.ii > .a3s` message bodies inside expanded, identified message envelopes in the
conversation list under `role="main"`. It does not zoom the sender header, attachments,
reply controls, toolbar, message list, sidebar, or reading-pane container. Text reflows;
fixed-width tables or images that cannot fit scroll inside their message body instead
of expanding the pane. Nodes, links, images, message HTML, selection, and native
handlers are preserved. At 100% all native body styles are restored.

A capture-phase `keydown` handler checks `metaKey`, modern `key` values, cancelability,
visible conversation structure, and focus. It calls `preventDefault()` only for the
three recognized reading shortcuts; it does not stop propagation. Search, inputs,
editable controls, compose editors, extension controls, visible menus/dialogs,
ambiguous contexts, and pages with no open message retain their existing behavior.
No outgoing font formatting or compose visual zoom is implemented. With the switch
off, Gmail Pro installs no zoom keyboard handler.

The existing thread-discovery observer also reports conversation identity changes
for resetting zoom, independently of whether Newest Email First is enabled. There
is no second broad observer, polling, or observation within message bodies. CSS
covers message insertion/expansion. A one-shot document-start observer is used only
if `<html>` does not exist yet. Discovery watches disconnect once a supported thread is validated; idle pages do not run timers repeatedly.

Native macOS shortcuts were verified in Chrome **153.0.8010.48** on macOS **26.6.2**,
including the installed Gmail app window and full conversation view. Local reading
zoom kept Chrome page zoom at 100%; Inbox/search and feature-off cases retained
Chrome’s zoom. No extension-command fallback was needed. Browser menus, trackpad
zoom, other browsers, non-US keyboard layouts, competing extensions, and future
Gmail/Chrome changes are not covered by that guarantee. Existing browser zoom is
never forcibly reset. See [message zoom QA](tests/messageZoom-QA.md).

### Custom Label Order

Under **LABELS**, turn on **Custom label order**, save preferences, then select
**Edit label order** while Gmail is active with its sidebar expanded. Small handles
appear beside top-level labels. Drag a handle or focus it and press **↑ / ↓**.
Each completed move saves automatically; **Done** or **Escape** exits. A failed
save leaves the prior order in place and shows a retry message. **Reset label
order** clears the saved ordering; disabling restores Gmail's native presentation.

The feature uses CSS `order` on Gmail's original custom-label rows inside a column
layout. It never moves, clones or replaces Gmail rows: live testing showed that
Gmail relies on its native child sequence during incremental rendering. Each parent
and all rendered descendants receive consecutive visual positions. Gmail retains
expand/collapse, unread counts, icons, colors, menus and message-drop handlers.
Pointer Events are confined to extension-owned handles during editing; no native
HTML drag/drop listeners are installed. Keyboard moves follow the visual order.

Identity is the decoded `#label/…` navigation path, validated against the row's
`data-label-name`. No immutable Gmail label ID was exposed in the inspected rows.
Deleted/stale entries are ignored. Renames act like new labels, which follow saved
labels in Gmail's native relative order. Missing entries remain in the preference
so editing a partially rendered section cannot erase ordering for unseen labels.

Gmail renders visible labels and labels behind **More** in separate containers.
Editing temporarily opens the custom-label More control and restores it on exit
if the user has not already collapsed it. Ordering is stored as one logical list,
but each native visibility section is ordered independently: labels never cross
Gmail's visible/More boundary. Nested children are never independently draggable.
Some children exist only while expanded; they inherit their parent's rank when
Gmail renders them. No parent/child relationships or visibility settings change.

The shared settings adapter saves `gmailPro.v1.customLabelOrderEnabled` and
`gmailPro.v1.customLabelOrder` through `chrome.storage.sync`. The order is limited
to 500 entries and 7,500 JSON bytes to stay below Sync's per-item quota. Only label
path/order preferences are stored, never message data or authentication information.
As with other preferences, this applies across Gmail accounts in a Chrome profile;
matching label paths share their position. Reset removes stale entries too.

Ordering is local presentation behavior: **Gmail mobile and other clients are
unaffected**, and actual Gmail label names/hierarchy remain unchanged. Chrome Sync
can carry the preference to other installations of Gmail Pro. Screen readers and
Tab navigation retain Gmail's native DOM sequence. Gmail DOM changes may require
Gmail Pro selector updates; unsupported structures retain native presentation.

## Privacy

- Gmail Pro runs locally in the browser and does not operate a backend.
- It includes no analytics, tracking, remote logging, remote code, or external APIs.
- It does not intentionally transmit Gmail message content to external services.
  The extension code initiates no network requests and does not read message bodies,
  subjects, or attachment contents.
- Current features interact with Gmail's DOM, not the Gmail API. They do not intercept
  Gmail network traffic or call undocumented Gmail APIs.
- Preferences are stored through **`chrome.storage.sync`**. This includes the configured
  BCC address, feature toggles, theme/accent choices, and custom-label navigation paths/order. Chrome can
  synchronize those preferences through Google's Chrome Sync service when enabled;
  this is not strictly device-only storage.
- Gmail may save recipient changes as part of its normal draft behavior. If you send
  a message, the configured BCC recipient receives a copy through Gmail.

No user preferences, mailbox data, browser profiles, or credentials belong in this
repository. Documentation and fixtures use synthetic examples only.

## Permissions

| Capability | Purpose |
| --- | --- |
| `storage` | Load and save extension preferences. |
| Content-script match: `https://mail.google.com/*` | Run only on Gmail over HTTPS, in the top-level frame. |

This is a Manifest V3 extension. It has no background service worker, OAuth scopes,
`tabs`, `activeTab`, `scripting`, `webRequest`, or broad host permissions. The popup's
content security policy permits bundled resources and disallows network connections.

## Clean reading pane and persistent message actions

Apple Mail Mode streamlines Gmail's message-reading interface by reducing
Gmail-specific chrome while preserving the original email content. It uses a
compact subject/sender header, a 28px avatar, tighter metadata spacing, and a 16px
outer gutter instead of Gmail's 72px avatar column alongside the whole message.
The Gmail-owned body wrapper adds 16px of readable inner padding and horizontal
scrolling for wide content. Received HTML, fonts, colors, links, tables, images,
signatures, quotes, attachments and outgoing editor formatting are not rewritten.
White documents remain white; simple messages retain a safe readable document
canvas rather than risking black text on dark chrome. Security/external warnings
and Gmail's Details control remain available. The reading summary card and
suggested-reply toolbar are hidden only in Apple Mail Mode.

Reply, Reply All, Forward, and supported reaction actions are available in the
main toolbar while a message is selected. The compact icon group has accessible
names, tooltips, native button keyboard activation, and a CSS divider. It is
inserted before Gmail's More group, after the existing Labels/third-party hook
group in the inspected layout. No phishing-extension class name is required; the
same insertion point works when that extension is absent.

The new controls **delegate to Gmail's current native footer controls**. They do
not move native nodes, build drafts, derive recipients, send mail, call Gmail APIs,
or use network endpoints. Available/disabled native actions determine what is
shown. Every activation resolves the visible thread and native control again;
there is no captured message-action handler or selected-message store. Shift and
other activation modifiers are forwarded, leaving pop-out behavior to Gmail.

Target semantics deliberately match Gmail's native bottom action bar. Newest Email
First changes visual order only and therefore does not retarget replies. Expanding
an older message does not independently make it the thread footer's reply target;
use that message's retained native header/menu for an explicit reply to it. If
Gmail itself retargets/replaces the footer, the top controls follow immediately.

The original bottom bar is hidden only after recognized native actions have a
visible, fitting top replacement. Missing/ambiguous controls, a missing toolbar,
unrecognized actions, or insufficient toolbar space retain the native footer.
Composer controls and editors are never hidden by that replacement. Turning Apple
Mail Mode OFF removes the group, divider, temporary markers and observation,
restoring native reading chrome and bottom actions.

`content/readingPane.js` shares `reverseThreads`' existing conversation discovery.
One additional narrow observer watches reading chrome, toolbar controls and their
ancestor spine, excluding received-message documents and compose editors. There
is no new document-wide observer, polling, telemetry, or persisted message data.
Selectors are centralized in `content/gmailSelectors.js`; presentation selectors
are documented in `content/appleMail.css`. This targets current English desktop
Gmail: `.iY`, `[gh="tm"] [gh="mtb"]`, the accessible More control, and native
`.amn` action links (`.bkI/.bkH/.bkG`) plus the accessible reaction button. Gmail
DOM changes or another extension moving those controls may disable only this
bridge; native actions remain the fallback. See [reading-pane QA](tests/readingPane-QA.md).

## Development

Use Node.js 18 or newer for the local validation suite:

```sh
node scripts/validate.cjs
```

This checks the manifest, referenced assets, icon dimensions, JavaScript syntax,
permissions, and settings/lifecycle unit tests. There is no package installation.

For real-Chrome synthetic DOM tests, run the local development server with Python 3:

```sh
python3 scripts/serve-tests.py
```

Open these pages in Chrome:

- `http://127.0.0.1:8765/tests/autoBcc.html`
- `http://127.0.0.1:8765/tests/reverseThreads.html`
- `http://127.0.0.1:8765/tests/popup.html`
- `http://127.0.0.1:8765/tests/messageList.html`
- `http://127.0.0.1:8765/tests/labelOrder.html`
- `http://127.0.0.1:8765/tests/messageZoom.html`
- `http://127.0.0.1:8765/tests/appleMail.html`
- `http://127.0.0.1:8765/tests/readingPane.html`

Repeat Auto BCC, reverseThreads, messageZoom, and labelOrder with `?appearance=1`
to run the same regressions with Apple Mail Mode active.

The fixtures use synthetic messages and addresses; they cannot send email. The popup
fixture serves the actual popup with a test-only Chrome storage adapter. This server
binds only to the loopback interface, disables caching for source edits, and is never
part of the installed extension. Stop it with Ctrl+C after testing.

The regression suites cover duplicate prevention, manual removal, simultaneous
drafts, settings races, focus, SPA navigation, first-frame ordering, collapsed groups,
attachments, restoration, and observer cleanup, including threads with 500 synthetic
messages. Passing fixtures is not a guarantee of compatibility with every Gmail UI.
The message-list suite checks narrow/wide layouts, native state, labels, ellipsis,
hover spacing, handlers, SPA replacement, restoration and CSS boundaries. Auto BCC
and thread-ordering fixtures also run with the message-list feature enabled.
See the [recorded message-list QA](tests/messageList-QA.md) for live coverage and
the checks intentionally limited to synthetic data.

### Structure and maintenance

- `content/appearance.js`: root appearance lifecycle and optional system-theme listener.
- `content/readingPane.js`: native message-action bridge and narrow reading-chrome lifecycle.
- `content/appleMail.css`: gated native chrome, sidebar and message state presentation.
- `shared/theme.css`: shared light/dark tokens, palette and contrast variants.
- `content/autoBcc.js`: per-composition detection, insertion, and removal state.
- `content/reverseThreads.js` and `.css`: shared conversation discovery and reversible visual ordering.
- `content/messageZoom.js` and `.css`: scoped reading magnification, shortcut guards, and per-conversation reset.
- `content/messageList.js` and `.css`: one preference class and scoped two-line layout.
- `content/labelOrder.js` and `.css`: reversible custom-label visual ordering and edit handles.
- `content/gmailSelectors.js`: centralized JavaScript selectors; points to the
  CSS-only message-list selector contract in `content/messageList.css`.
- `content/content.js`: one settings subscription and shared lifecycle, started early.
- `content/autoBccStart.js`: preserves Auto BCC's `document_idle` startup.
- `shared/settings.js`: the sole preference adapter; no parallel preference store.
- `shared/debug.js`: allowlisted lifecycle logging, off by default.
- `popup/`: settings UI; `tests/`: synthetic regression fixtures.

Keep changes focused, observers narrow, and operations idempotent. Run all suites
before contributing. Never commit real Gmail captures, addresses, message content,
cookies, credentials, or browser profiles. Use disposable drafts for live testing,
verify recipients yourself, and **never send test mail**. Debug logs must contain
only lifecycle codes; restore `DEBUG = false` before committing.

## Gmail DOM compatibility and known limitations

Gmail's DOM is not a public API. The current implementation targets the English
desktop interface. Composition and conversation discovery rely on accessibility
attributes and structural relationships. Unknown recipient labels or ambiguous
conversation layouts fail closed rather than guessing.

Composition discovery uses addressing forms, `composeid` markers, labeled recipient
comboboxes, and recipient chips. Conversation discovery uses the thread heading,
a nearby message list, and complete message envelopes. Collapsed message slots must
retain the structural attributes shared with their neighboring messages. Header and
thread toolbar elements must remain outside the message list. Recheck these assumptions
when Gmail changes.

The message list uses a structural CSS gate: a table with `role="grid"` inside
`role="main"`, native rows/cells, a checkbox, a subject link containing
`data-thread-id`, a sender cell and a timestamp with a title. Opened message bodies
are excluded. Gmail does not expose semantic roles for subject, snippet or labels,
so the scoped stylesheet also depends on documented presentation hooks: `.yX/.yW`
(senders), `.xS/.xT/.y6/.bog` (subject), `.y2` (snippet), `.yi` (labels), `.yf`
(indicators), `.byZ` (extra metadata), `.xW` (date) and the native toolbar role.
These hooks are centralized in that stylesheet, never scattered across scripts.
Recheck them when Gmail changes. If the structural gate no longer matches, the row
keeps Gmail's normal layout. Unknown snippet markup is retained rather than parsed.

Custom-label selectors in `gmailSelectors.js` validate `[gh="cl"] > .TK`, flat
`.aim` rows, `.TN` indentation, label navigation links and matching menu metadata.
System-folder containers are excluded. The sidebar section is observed for relevant
structural changes; ancestors have shallow child-list watches to detect replacement.
A temporary document subtree observer supports initial shell loading for up to ten
seconds, then disconnects; navigation can rediscover a late shell. No continuous
polling runs, unread text changes do not reconcile ordering, and own style/control
writes occur with observation disconnected. See [label-order QA](tests/labelOrder-QA.md).

Additional limits:

- Auto BCC is a convenience, not a send-time guarantee. Check BCC before sending a
  message that requires a copy. Incomplete layouts, rapid focus changes, and late
  Gmail rendering can prevent insertion. An isolated first-reply miss during live
  testing was not reproducible and remains a hardening concern.
- Removal decisions are in memory per composition, not shared across refreshed pages,
  reopened drafts, or Gmail tabs. Preferences apply across Gmail accounts in one
  Chrome profile.
- Thread ordering assumes Gmail's native message sequence is chronological. No
  localized timestamp parsing or message-ID decoding is used.
- CSS changes visual order only. Screen-reader and sequential keyboard order retain
  Gmail's native DOM order. Focus and scroll positions are not forcibly changed.
- Early rendering before asynchronous preferences are available is not guaranteed
  to be flash-free. Unavailable storage leaves Gmail's normal behavior in place.
- Other recipient or thread-ordering extensions may conflict. Existing competing
  layout styles are left alone. Full-thread view, attachment interactions, keyboard
  shortcuts, and assistive technology deserve additional live QA.
- The two-line stylesheet uses CSS `@scope` (Chrome 118+); older browsers retain
  native rows. It targets desktop message tables, not mobile/basic HTML Gmail.
- Gmail still abbreviates conversation participants and labels in its own DOM;
  the extension does not reconstruct full names. Long label groups share at most
  45% of the second line and retain native tooltips. Native attachment previews or
  additional metadata may make a row taller than 56px.
- CSS preserves DOM/focus order and event handlers, but this is not a complete
  screen-reader certification. Gmail redesigns and competing layout extensions
  can require selector updates.

## License and affiliation

Released under the [MIT License](LICENSE).

Gmail Pro is an independent project and is not affiliated with, endorsed by, or
sponsored by Apple or Google. Gmail is a trademark of Google LLC; Apple Mail and
macOS are trademarks of Apple Inc. “Apple Mail-inspired” describes visual inspiration.
