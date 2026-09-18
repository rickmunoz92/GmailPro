# Gmail Pro

**Power-user enhancements for Gmail.**

Gmail Pro is a lightweight Chrome extension that adds useful power-user
functionality to the Gmail web interface. It runs locally in your browser, with
plain HTML, CSS, and JavaScript—no build step, runtime dependencies, or backend.

## Features

- **Auto BCC:** automatically add a configured address to new messages, replies,
  reply-all messages, and forwards. Each composition is handled independently.
- **Newest Email First:** show the newest message at the top of an opened Gmail
  conversation. This changes presentation only; it does not sort the Inbox or
  change Gmail's stored messages.

Both features are off by default. Open the extension popup, choose your settings,
and select **Save preferences**.

## Installation

1. Clone this repository or download and extract its source ZIP.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh any open Gmail tabs, then open Gmail Pro from Chrome's Extensions menu.

After updating the source, reload Gmail Pro in `chrome://extensions`, refresh
Gmail, and reopen the popup. The repository contains the unpacked extension; no
Chrome Web Store installation or OAuth sign-in is required.

## How it works

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

Complete wrappers keep their sender details, attachments, message controls, and
inline composers. Message nodes are never moved or cloned; timestamps and server-side
conversation data are unchanged. No threads are prefetched, opened in the background,
or downloaded by the extension.

## Privacy

- Gmail Pro runs locally in the browser and does not operate a backend.
- It includes no analytics, tracking, remote logging, remote code, or external APIs.
- It does not intentionally transmit Gmail message content to external services.
  The extension code initiates no network requests and does not read message bodies,
  subjects, or attachment contents.
- Current features interact with Gmail's DOM, not the Gmail API. They do not intercept
  Gmail network traffic or call undocumented Gmail APIs.
- Preferences are stored through **`chrome.storage.sync`**. This includes the configured
  BCC address and feature toggles. Chrome can synchronize those preferences through
  Google's Chrome Sync service when enabled; this is not strictly device-only storage.
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

The fixtures use synthetic messages and addresses; they cannot send email. The popup
fixture serves the actual popup with a test-only Chrome storage adapter. This server
binds only to the loopback interface, disables caching for source edits, and is never
part of the installed extension. Stop it with Ctrl+C after testing.

The regression suites cover duplicate prevention, manual removal, simultaneous
drafts, settings races, focus, SPA navigation, first-frame ordering, collapsed groups,
attachments, restoration, and observer cleanup, including threads with 500 synthetic
messages. Passing fixtures is not a guarantee of compatibility with every Gmail UI.

### Structure and maintenance

- `content/autoBcc.js`: per-composition detection, insertion, and removal state.
- `content/reverseThreads.js` and `.css`: validated, reversible visual ordering.
- `content/gmailSelectors.js`: centralized Gmail selectors.
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
desktop interface and relies on accessibility attributes and structural relationships,
not generated CSS class names. Unknown recipient labels or ambiguous layouts fail
closed rather than guessing.

Composition discovery uses addressing forms, `composeid` markers, labeled recipient
comboboxes, and recipient chips. Conversation discovery uses the thread heading,
a nearby message list, and complete message envelopes. Collapsed message slots must
retain the structural attributes shared with their neighboring messages. Header and
thread toolbar elements must remain outside the message list. Recheck these assumptions
when Gmail changes.

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

## License and affiliation

Released under the [MIT License](LICENSE).

Gmail Pro is an independent project and is not affiliated with, endorsed by, or
sponsored by Google. Gmail is a trademark of Google LLC.
