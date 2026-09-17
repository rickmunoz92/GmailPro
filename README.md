# Gmail Pro

**Power-user enhancements for Gmail**

A private Manifest V3 Chrome extension for `https://mail.google.com/*`.
Plain HTML, CSS, and JavaScript. No build step, runtime dependencies, or backend.

## Phase 2: Auto BCC

Enable **Auto BCC**, enter one email address, and choose **Save preferences**.
New compose, inline reply, reply all, and forward interfaces receive that BCC
recipient. Multiple drafts have independent state. **Newest Email First remains
an inert placeholder** and its popup switch is disabled.

- A draft captures the settings when Gmail Pro first detects it. Changes apply
  to future compositions; existing recipients are never rewritten or removed.
- The address is not added if it already appears in To, CC, or BCC, including
  contact chips or unfinished recipient text. Matching ignores case and surrounding
  whitespace. Dots and plus tags are preserved; provider aliases are not guessed.
- Removing an automatically added recipient keeps it removed for that compose
  instance. The extension never retries an insertion that Gmail has already received.
- Turning Auto BCC off cancels pending additions and leaves existing recipients
  alone. Turning it on again affects future compose instances. Changing the address
  also cancels pending work for the old address.
- Closing and reopening a draft creates a new compose instance. Existing recipients
  still prevent duplicates. Removal decisions are in-memory, not persisted across
  a page refresh, reopened draft, or another Gmail tab.
- An unknown or ambiguous layout is left alone. Auto BCC is a convenience, not a
  send-time guarantee: confirm BCC before sending a message that requires a copy.
  Gmail Pro does not intercept, delay, or trigger Send.

## Project structure

```text
GmailPro/
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
│   └── icon{16,32,48,128}.png
├── scripts/validate.cjs
├── tests/
│   ├── settings.test.cjs
│   ├── autoBcc.html
│   └── autoBcc.browser.js
├── .gitignore
└── README.md
```

## Architecture

Declarative content scripts run at `document_idle`, in Chrome's default isolated
world, in manifest order. Guarded closures share one `globalThis.GmailPro`
namespace per extension context. There is no bundler, page-script injection,
background worker, message relay, or web-accessible resource.

`content.js` subscribes before loading preferences and merges changes received
while that read is pending. It starts Auto BCC once, delivers subsequent settings
patches, and tears down on page exit. A failed initial settings read leaves Gmail
untouched; refresh Gmail after resolving the storage error.

`autoBcc.js` owns discovery, insertion, and cleanup. A WeakMap remembers each
addressing form's decision. A Map holds only forms with pending work or recipient
removal monitoring. The main Gmail pane has a child-list observer for inline
compositions. Its ancestor spine is observed **shallowly** for SPA replacement.
A single capturing `focusin` listener discovers floating compose windows. Verified
compose ancestor paths are also watched shallowly to detect closure and additional
windows. There is no permanent whole-document subtree observer, polling interval,
or repeated full-document scan. One initial scan finds already-open compositions;
later discovery only examines newly added subtrees or the focused compose region.

Each active form has a narrow observer on its addressing UI, which excludes the
editable message body. Changes coalesce into one 80 ms task. A five-second deadline
bounds incomplete layouts; this is not a retry loop. At most one summary expansion,
one BCC reveal, and one recipient-entry attempt occur per form. Insertion uses the
native input setter, an input event, and Enter on the verified BCC input, then
checks for Gmail's committed chip. Focus and the existing selection are restored
synchronously without reading their text. No asynchronous task later steals focus.

After confirmation, observation only recognizes removal. Removal, duplicate
presence, cancellation, selector failure, closure, and stop are terminal for that
compose instance. Observers, timers, and input listeners are released on completion
or detachment. Repeated script injection/start/stop cannot create extra owners.

`shared/settings.js` remains the only preference/storage adapter. The popup uses
explicit Save, accessible controls, email validation, and retryable storage errors.
Unsaved edits survive incoming settings changes. Popup-only changes require closing
and reopening it; content or manifest changes require extension reload and Gmail refresh.

### Settings contract

| Property | Default | Chrome Sync key |
| --- | --- | --- |
| `autoBccEnabled` | `false` | `gmailPro.v1.autoBccEnabled` |
| `bccAddress` | `""` | `gmailPro.v1.bccAddress` |
| `newestEmailFirstEnabled` | `false` | `gmailPro.v1.newestEmailFirstEnabled` |

`load()` normalizes missing/malformed values without overwriting storage.
`save(patch)` validates and writes only supplied properties. One plain email
address is accepted; display names and recipient lists are rejected. The popup
requires a nonempty valid address when enabling Auto BCC. The content module also
checks validity independently. Preferences apply across Gmail accounts in the
Chrome profile. The existing schema and stored Newest Email First choice are preserved.

`subscribe(listener)` emits normalized patches for relevant Sync changes,
deduplicates callbacks, and provides idempotent cleanup. There is at most one
Chrome storage listener per context. Same-key concurrent updates use Chrome's
last-write-wins behavior. There is no localStorage mirror or parallel cache.

## Privacy and permissions

Gmail Pro has no backend, analytics, tracking, OAuth, Gmail API, remote logging,
remote code/fonts, or extension-initiated network requests. It does not intercept
Gmail requests or call undocumented Gmail APIs. It inspects only recipient metadata,
address inputs, and structural attributes. It does not read subjects, message bodies,
or attachments. Gmail saves recipient edits as part of its normal draft behavior;
Gmail Pro does not submit or send messages. Only your configured BCC address and
two preferences are persisted by the extension.

**Chrome Sync remains the requested exception to strictly device-only storage.**
`chrome.storage.sync` stores preferences locally and can synchronize them, including
the configured BCC address, through Google's Chrome Sync service when enabled.
With syncing disabled it behaves locally; offline edits can sync later. Gmail Pro
does not operate that service. If strictly device-only preferences are required,
migrate the single adapter to `chrome.storage.local` instead of adding another store.

| Capability | Purpose |
| --- | --- |
| `storage` | Read and save preferences. |
| `content_scripts.matches: https://mail.google.com/*` | Automatic DOM access on Gmail over HTTPS, top-level frames only. |

No permissions were added for Phase 2. There are no `tabs`, `activeTab`, `scripting`,
cookies, history, webRequest, OAuth scopes, broad URL patterns, or redundant host
permissions. The popup CSP permits bundled resources and disallows connections,
objects, and form navigation. It does not change Gmail's CSP; code review must
continue enforcing the no-network architecture. No CSS is injected into Gmail.

## Install and develop locally

1. Open `chrome://extensions` in the intended Chrome profile and enable Developer mode.
2. Choose **Load unpacked** and select `~/Documents/GmailPro`.
3. Open Gmail Pro from Chrome's Extensions menu. Configure Auto BCC and Save.
4. For an update, click Gmail Pro's **Reload** button in the extensions manager,
   then refresh Gmail tabs. Close any test drafts first.

There is no build or Web Store publication step. Managed Chrome policies may
restrict unpacked extensions. Edit the source directly and run Node.js 18+ checks:

```sh
cd ~/Documents/GmailPro
node scripts/validate.cjs
```

These validate manifest capabilities, resource paths, icons, runtime JavaScript
syntax, prohibited runtime calls, settings normalization/writes/subscriptions,
initial-read races, lifecycle cleanup, and address normalization. They use Node's
built-in libraries. They are guardrails, not a comprehensive Chrome/security audit.

For browser DOM regression checks, serve the project locally:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tests/autoBcc.html` in Chrome. This development-only page
runs the actual Auto BCC module against synthetic forms using native DOM events,
MutationObservers, focus, and timers. It cannot send email and requires no test
packages. Stop the server afterward. No server is needed to use the extension.

Coverage includes new/reply/reply-all/forward structures; 2/3 simultaneous drafts;
enabled/disabled/missing/invalid settings; duplicate To/CC/BCC contact chips and
case differences; unfinished recipient text; manual removal and reopening; live
settings changes and stale-work cancellation; delayed/rejected commits; mutation
bursts; SPA pane replacement; detached drafts; repeated start/stop; focus preservation;
and unknown labels. Synthetic success alone does not prove live Gmail compatibility.

For live smoke tests, use a test address and drafts only. Never send test mail.
Confirm one BCC chip for each mode, remove it and keep typing, change settings with
Gmail open, and create three simultaneous drafts. Check duplicate cases, navigation,
and popup persistence. Discard test-created drafts and restore your preferences.
Avoid concurrently enabling another Auto BCC extension: it can modify the same fields.

Inspect the popup through its context-menu **Inspect** action. For content checks,
select **Gmail Pro** in Gmail DevTools' execution-context menu. Set `DEBUG = true`
in `shared/debug.js` temporarily for lifecycle codes such as `compose-detected`,
`bcc-insertion-attempted`, `bcc-already-present`, `bcc-user-removal`, and
`bcc-selector-failure`. Never log addresses, recipients, subjects, bodies, nodes,
or raw exceptions. Restore `DEBUG = false` before committing.

### Validation record

Phase 2 validation on September 16, 2026: 12 Node tests and 25 real-browser
synthetic DOM checks passed. Manifest/resource/syntax checks and `git diff --check`
passed. The installed popup renders the new UI, saves preferences, and preserves
those values when reopened. Test preferences were restored to off/empty.

**Live Gmail insertion acceptance is still pending.** Gmail's installed content
context reported version `0.1.0` with the inert Phase 1 module after a tab refresh.
The unpacked extension must be reloaded through Chrome's extensions manager before
Phase 2 can be tested against Gmail. Synthetic checks do not replace that test.
No real email was sent. Gmail DOM discovery used disposable draft interfaces only.

## Gmail DOM maintenance

Selectors are centralized in `content/gmailSelectors.js`. The September 2026 English
Gmail desktop UI was inspected directly: both floating compose and inline reply
have an addressing `form` with `input[name="composeid"]`; message editors are outside
that form. Recipient inputs have role `combobox` and accessible labels `To recipients`,
`CC recipients`, or `BCC recipients`. Their enclosing listboxes contain committed
`role="option"` chips with `data-hovercard-id`. Collapsed reply summaries contain
recipient spans and a focusable ancestor. BCC reveal links have an accessible
name beginning with `Add Bcc recipients`. These are observed DOM conventions,
**not Gmail API contracts**. No generated class names are used.

English labels are a deliberate current limitation; other locales and redesigned
recipient UIs fail closed. Gmail can also change when fields appear, where focus
lands, which events commit chips, or whether compose nodes are reused. Recheck
these behaviors after Gmail changes, especially inline replies and form replacement.
A floating compose which neither focuses nor attaches beneath an already-observed
compose host may remain undetected until it receives focus. A minimized/unfinished
layout may time out without an insertion. No attempt is made to enforce BCC at Send.

Keep observations scoped and bounded, preserve per-compose decisions, and never
fall back to reading body text, broadly scraping Gmail, or calling private APIs.
Use synthetic fixtures only; do not commit real mailbox data or session artifacts.
Thread ordering has not been implemented or altered.

## Chrome references

- [Storage and Chrome Sync](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content scripts and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Manifest V3 CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Load and reload unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
