# Gmail Pro

**Power-user enhancements for Gmail**

A private, lightweight Manifest V3 Chrome extension for `https://mail.google.com/*`.
Plain HTML, CSS, and JavaScript. No build step, runtime dependencies, or backend.

## Phase 1 status

The branded popup, preference storage, and extension skeleton are ready. You can
save an Auto BCC preference, one BCC address, and a Newest Email First preference.
Both toggles default to off. **Neither feature modifies Gmail yet**, even when a
saved toggle is on. The popup explicitly identifies this as a preferences preview.

The content entry point runs once in the top-level Gmail page but does not inspect
messages or recipients, read or write the DOM, access storage, create observers,
register event listeners, or start timers. Feature modules are inert placeholders.
Feature correctness on Gmail will be tested when those features are implemented.

## Project structure

```text
GmailPro/
├── .gitignore
├── manifest.json
├── content/
│   ├── content.js
│   ├── gmailSelectors.js
│   ├── autoBcc.js
│   └── reverseThreads.js
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── shared/
│   ├── debug.js
│   └── settings.js
├── icons/
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   └── validate.cjs
├── tests/
│   └── settings.test.cjs
└── README.md
```

## Architecture

- **Content:** declarative scripts restricted to Gmail, loaded at `document_idle`
  in Chrome's default isolated world, in the order listed in the manifest. Gmail
  cannot access the extension's JavaScript namespace through its page scripts.
- **Modules:** small, guarded closures share one `globalThis.GmailPro` namespace
  per extension context. This works in both classic content scripts and the popup
  without a bundler, dynamic imports, page-script injection, or web-accessible
  resources. Guards make repeated initialization safe. It is not a data store.
- **Settings:** `shared/settings.js` is the only preference owner and Chrome
  storage adapter. There is no background worker, message relay, localStorage
  mirror, persistent cache, or second store.
- **Popup:** an accessible form with keyboard-operable switches, email validation,
  visible preview status, explicit Save, and retryable load/save errors. Closing
  it discards unsaved edits. Writes occur on Save, never on every keystroke.
- **Features:** each placeholder exposes `implemented: false`, `start()`, and
  `stop()`. The entry point deliberately does not activate them in Phase 1.
- **Debug:** `shared/debug.js` has a local `DEBUG = false` flag and an allowlist of
  lifecycle messages. It never accepts settings, addresses, Gmail content, DOM
  nodes, or raw exception objects. Do not add sensitive data to logs.

The proposed structure is retained. The only additions are shared debug logging,
local icon assets (with an editable SVG source), and dependency-free validation.
The popup uses system fonts and bundled assets. No framework or package manifest
is necessary.

### Settings contract

| Public property | Default | Chrome Sync key |
| --- | --- | --- |
| `autoBccEnabled` | `false` | `gmailPro.v1.autoBccEnabled` |
| `bccAddress` | `""` | `gmailPro.v1.bccAddress` |
| `newestEmailFirstEnabled` | `false` | `gmailPro.v1.newestEmailFirstEnabled` |

`load()` returns normalized preferences. Missing/deleted or malformed values
fall back to defaults without overwriting storage. `save(patch)` validates and
writes only supplied properties; unknown properties are rejected. Addresses are
trimmed, keep their case, and accept one plain email address (not a display name
or a recipient list). An empty address is allowed while Auto BCC is off. The
popup requires an address before saving Auto BCC as enabled. Future feature code
must independently require both an enabled toggle and a valid nonempty address.

`subscribe(listener)` supplies normalized **patches** for relevant Sync events,
deduplicates callbacks, and returns an idempotent unsubscribe function. There is
at most one underlying Chrome storage listener per context. Subscribe before
loading and merge intervening events, as the popup does, to avoid a stale initial
read. The popup preserves unsaved edits when remote preferences change and saves
only edited fields. Concurrent edits to the same key use Chrome's last-write-wins
behavior; this is not a cross-device transactional database.

The `v1` key prefix is the initial schema boundary. If contracts change later,
add an explicit migration and preserve existing users' choices. Do not reset
preferences during startup. Preferences currently apply across all Gmail accounts
in a Chrome profile; per-account preferences are not part of Phase 1.

## Privacy

Gmail Pro has no backend, analytics, tracking, OAuth, Gmail API integration,
remote code, remote fonts, telemetry, or extension-initiated network requests.
It does not intercept Gmail requests or call undocumented Gmail APIs. No email
messages, recipients from Gmail, message identifiers, or attachments are stored.
Only the two toggles and the BCC address you explicitly enter are persisted.

**Chrome Sync is the requested exception to strictly device-only storage.**
`chrome.storage.sync` stores preferences locally and may transmit them, including
the configured BCC address, through Google's Chrome Sync service when you enable
syncing. With syncing disabled, it behaves locally; offline changes can sync later.
Gmail Pro does not run a server or initiate that synchronization itself. Therefore,
“no external transmission of any kind” and enabled Chrome Sync cannot both be
promised. This distinction is also disclosed in the popup. If strict device-only
storage is required later, change the single adapter to `chrome.storage.local` and
explicitly migrate settings; do not introduce a parallel store. Do not store
secrets or message contents in extension preference storage.

The popup's content security policy restricts scripts, styles, and images to
bundled assets and disables network connections, objects, and form navigation.
That policy covers extension pages; it does not change Gmail's own policy or
guarantee that future content-script code cannot make requests. Code review and
validation must continue to enforce the no-network architecture.

## Permissions

| Capability | Why it exists |
| --- | --- |
| `storage` | Save and read the three user preferences using Chrome Sync. |
| `content_scripts.matches: https://mail.google.com/*` | Limit automatic content-script execution to Gmail over HTTPS, top-level frames only. This grants DOM access on Gmail; Chrome may describe it as reading/changing site data. Phase 1 uses neither capability. |

No `tabs`, `activeTab`, `scripting`, cookies, history, webRequest, Gmail OAuth
scopes, broad URL patterns, or duplicate `host_permissions` are requested.
There is no service worker because the popup and content script can access the
storage API directly. No CSS is injected into Gmail in Phase 1.

## Local Chrome installation

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose `~/Documents/GmailPro`.
4. Optionally pin Gmail Pro in Chrome's Extensions menu, then open its popup.
5. Set your preferences and select **Save preferences**. Reopen the popup to
   confirm persistence. Gmail itself will remain unchanged in Phase 1.

There is no Web Store upload, account connection, OAuth consent, build command,
or server to start. Managed Chrome policies can restrict unpacked extensions;
if Chrome blocks loading, the browser administrator must permit it.

## Development workflow

Edit the source files directly. Run the local checks with Node.js 18 or newer:

```sh
cd ~/Documents/GmailPro
node scripts/validate.cjs
```

This checks the MV3 manifest's expected capabilities, all manifest/popup resource
paths, PNG icon dimensions, JavaScript syntax, and obvious prohibited runtime
calls. It runs focused tests for defaults, malformed data, partial writes,
validation, storage failures, change subscriptions/cleanup, duplicate injection,
and inert Gmail placeholders. It uses only Node's built-in libraries. Static
checks are guardrails, not a comprehensive security audit or Chrome validator.

For a manual popup smoke test:

- Open the popup with empty settings: both switches are off, the email is empty,
  and Save is disabled until an edit.
- Enable Auto BCC with no address, then Save: a friendly error should focus the
  email field. Invalid addresses and recipient lists must not be stored.
- Enter a sample address, change either switch, save, close, and reopen. Verify
  persisted preferences and the coming-soon notice. Clear the address with Auto
  BCC off and save; it should remain cleared on reopen.
- Check keyboard Tab/Space/Enter behavior, focus rings, and save/load errors.
- Check `chrome://extensions` for manifest/runtime errors. Reload the extension
  after manifest or content changes, then refresh Gmail tabs. Popup-only changes
  appear when you close and reopen it.

Inspect the popup by right-clicking it and selecting Inspect. For content logs,
select the Gmail Pro execution context in Gmail DevTools. To enable lifecycle
logging during development, change `DEBUG` in `shared/debug.js` to `true`, reload
the extension and Gmail, then restore `false` before committing or distributing.
The PNGs are bundled Chrome icons; `icons/icon.svg` is their editable design source.

## Future Gmail interaction and DOM maintenance

Gmail is a dynamic SPA. Its DOM is not a stable public API. The candidate selectors
in `content/gmailSelectors.js` are **unverified and unused**: role landmarks and
editable textboxes are starting points, not reliable compose/thread identifiers.
There is no live Gmail account or message inspection required for Phase 1.

Before implementing either feature:

- Keep every Gmail selector in `gmailSelectors.js`. Prefer accessibility roles,
  semantic attributes, and verified parent/child relationships. Accessible names
  can be localized; generated CSS class names and English labels alone are brittle.
- Inspect new compose, inline reply, reply all, forward, multiple compose windows,
  expanded/minimized drafts, pop-out compose pages, and account switching. A role
  of `dialog` does not establish that a node is a compose window. A `textbox` does
  not establish that it is a recipient field or a message editor.
- Scope observers to verified active compose/conversation roots. If discovery
  needs an outer observer, choose the smallest verified stable container, watch
  only relevant changes, filter callbacks early, and disconnect promptly. Avoid
  persistent whole-document subtree observation and polling.
- Track owned roots with weak references where suitable. Make start/stop and DOM
  operations idempotent; prevent repeated listeners/observers. Stop on disable,
  detach, navigation, or extension invalidation. Ignore stale asynchronous work.
- Add BCC recipients only through verified Gmail UI behavior. Check existing
  recipients to avoid duplicates, preserve user edits, and never alter Send,
  recipients, focus, or message text unexpectedly. No network interception or
  internal Gmail calls. Test drafts and every requested compose mode explicitly.
- Validate thread structure and chronological order before rearranging anything.
  Preserve expanded/collapsed messages, keyboard/screen-reader order, reply areas,
  focus, and Gmail's rendering ownership. Gmail can recycle/replace nodes; moving
  them may break its state. Test feasibility before choosing a reordering method.
- If a root is missing, ambiguous, or incompatible, leave Gmail untouched. Scope
  failures to that feature/root, retain a working popup, and use only safe debug
  lifecycle codes. Never guess at recipients or message order.
- Document verified structures, Gmail views/locales, assumptions, and fallback
  behavior beside selectors. Use synthetic/redacted DOM fixtures for regression
  tests; never commit real messages, addresses, account IDs, or session data.

## Chrome documentation

- [Storage and Chrome Sync behavior](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content scripts, ordering, and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Manifest V3 content security policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Load and reload an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
