# Gmail Pro

**Power-user enhancements for Gmail**

A private Manifest V3 Chrome extension for `https://mail.google.com/*`.
Plain HTML, CSS, and JavaScript. No build step, runtime dependencies, or backend.

## Auto BCC

Enable **Auto BCC**, enter one email address, and choose **Save preferences**.
New compose, inline reply, reply all, and forward interfaces receive that BCC
recipient. Multiple drafts have independent state.

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

## Newest email first (Phase 3)

Enable **Newest email first** and choose **Save preferences**. Within an opened
conversation, Gmail Pro displays the latest message above older messages. The
Inbox list order does not change. Turning the setting off restores Gmail's normal
presentation immediately, including the currently open conversation.

This is visual ordering only. Gmail's actual message nodes, timestamps, data,
thread membership, and server-side conversation remain unchanged. Complete message
wrappers retain their sender details, attachments, controls, and inline composers.
No messages are cloned, removed, or moved in the DOM. Native keyboard navigation
and screen-reader reading order therefore remain in Gmail's original DOM order;
they do not become newest-first. The extension does not change focus or force scroll
positions. Auto BCC and this setting work independently.

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
│   ├── autoBcc.browser.js
│   ├── reverseThreads.html
│   └── reverseThreads.browser.js
├── .gitignore
└── README.md
```

## Architecture

Declarative content scripts run at `document_idle`, in Chrome's default isolated
world, in manifest order. Guarded closures share one `globalThis.GmailPro`
namespace per extension context. There is no bundler, page-script injection,
background worker, message relay, or web-accessible resource.

`content.js` subscribes before loading preferences and merges changes received
while that read is pending. It starts both independent feature modules, delivers
subsequent settings patches, and tears both down on page exit. A failed initial settings read leaves Gmail
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
checks for Gmail's committed chip. Ordinary input/reveal actions restore focus
synchronously without reading selection text. Inline reply headers require focus
before Gmail renders their recipient fields; clicking alone is insufficient.
Header activation is serialized so simultaneous replies cannot take focus from
one another. Gmail can autofocus the editor after the header starts opening; BCC
keeps focus through recipient entry so an intermediate restoration cannot collapse
the fields. The saved caret is restored afterward only while focus remains
in that addressing form. Any real pointer or keyboard interaction cancels that
saved restoration. The two shared interaction listeners are removed on stop.

After confirmation, observation only recognizes removal. Removal, duplicate
presence, cancellation, selector failure, closure, and stop are terminal for that
compose instance. Observers, timers, and input listeners are released on completion
or detachment. Repeated script injection/start/stop cannot create extra owners.

`reverseThreads.js` owns conversation discovery and reversible inline layout
styles. It uses CSS flex ordering on validated complete message envelopes, including
Gmail's collapsed older-message slots. Explicit fixed controls keep their original
slots. Subject/header and thread toolbar are outside the selected list. Unsupported
children or ambiguous containers cause the feature to leave/restore native layout.
It does not blindly reverse every child of a container.

Each active list has one state record containing its current native DOM sequence,
visual sequence, and the exact original values/priorities of only the style properties
Gmail Pro changes. Since native DOM order never changes, restoration needs no timestamp
reconstruction or node moves. Gmail-added/replaced/removed wrappers reconcile from
Gmail's current source order. Styles already in the desired state are not rewritten.
Styles changed by Gmail or another extension are respected: conflicting ownership
releases the reversal until the setting is toggled off/on. Unrelated inline styles
are retained. Detached lists and disabled features release state and observers.

Once discovered, observation is shallow: list child changes, direct wrapper
attributes, and the conversation's ancestor paths. Message body, attachment, and
editor descendants are not observed by this module. Navigation uses hash/popstate
and Inbox-row click events; a briefly wider main-pane discovery observer supports
asynchronous pane construction, stops when a candidate list is found, and has a
five-second maximum lifetime. A late-built main pane is also discovered on focus.
No interval, repeated full-document scan, layout measurement loop, or idle task
runs. Mutation bursts coalesce into an 80 ms task; own style writes occur while the
list observer is disconnected. The disabled feature has no observers or listeners.

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
address inputs, and structural attributes for message wrappers. It does not read subjects, message bodies,
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

No permissions were added for Phases 2 or 3. There are no `tabs`, `activeTab`, `scripting`,
cookies, history, webRequest, OAuth scopes, broad URL patterns, or redundant host
permissions. The popup CSP permits bundled resources and disallows connections,
objects, and form navigation. It does not change Gmail's CSP; code review must
continue enforcing the no-network architecture. Phase 3 changes only the scoped
inline layout styles described above; it loads no external stylesheet.

## Install and develop locally

1. Open `chrome://extensions` in the intended Chrome profile and enable Developer mode.
2. Choose **Load unpacked** and select `~/Documents/GmailPro`.
3. Open Gmail Pro from Chrome's Extensions menu. Choose preferences and Save.
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
packages. Also open `http://127.0.0.1:8765/tests/reverseThreads.html` for real
DOM/layout, lifecycle, and simultaneous Auto BCC/thread-ordering checks. The ordering
fixture counts only observers created by Gmail Pro, excluding browser test tooling.
Stop the server afterward. No server is needed to use the extension.

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

Phase 2 live verification completed September 17, 2026 with installed version
`0.2.2`, confirmed in Gmail Pro's isolated content-script context. All 12 Node
tests and 27 real-browser synthetic DOM checks passed, along with manifest,
resource, syntax, minimal-permission, and whitespace checks.

Live English Gmail checks passed for new compose, Reply, Reply All, Forward,
three simultaneous compose windows, one BCC chip per composition, manual removal
without reinsertion, and a subsequent new composition. Popup OFF prevented BCC in
a new draft; restoring ON enabled it in a later draft. Preferences persisted when
the popup was reopened. Inbox/thread/Drafts navigation worked without reloading.
Reopening a saved draft with the configured address in To (entered in uppercase)
or BCC skipped insertion and preserved a single recipient.

Live testing exposed focus-dependent inline reply headers and Gmail's delayed
editor autofocus. The fix retains focus through BCC entry, serializes header
activation, and guards caret restoration against intervening user activity or
focus in another compose. Updated fixtures reproduce those timings. The final
0.2.2 run detected 11 compositions: eight one-time insertion attempts, two existing
recipient skips, and one disabled composition; one manual removal stayed removed.
No selector failures, repeated insertion attempts, or Gmail Pro runtime errors
were observed. Unrelated Gmail/other-extension console warnings were present.

Dedicated QA should still exercise CC duplicates directly in Gmail, rapid typing
and focus changes during insertion, more thread layouts, and longer sessions.
These edge cases have synthetic coverage where applicable; a finite live run is
not a guarantee against future Gmail DOM changes or observer leaks. No real email
was sent. The disposable drafts used in the final run were discarded, temporary
runtime diagnostics were restored, and the original enabled setting and configured
address were retained. Newest Email First was still inert at that Phase 2 milestone.

## Gmail DOM maintenance

Selectors are centralized in `content/gmailSelectors.js`. The September 2026 English
Gmail desktop UI was inspected directly: both floating compose and inline reply
have an addressing `form` with `input[name="composeid"]`; message editors are outside
that form. Recipient inputs have role `combobox` and accessible labels `To recipients`,
`CC recipients`, or `BCC recipients`. Their enclosing listboxes contain committed
`role="option"` chips with `data-hovercard-id`. Collapsed reply summaries contain
recipient spans and a focusable ancestor which must be focused to activate the
recipient editor (a programmatic click alone does not activate it). BCC reveal links
have an accessible name beginning with `Add Bcc recipients`. These are observed DOM conventions,
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
### Conversation ordering assumptions

The September 17, 2026 English Gmail desktop UI was inspected in a two-message
conversation and a ten-message conversation with collapsed older messages and
attachments. A heading `h2[data-thread-perm-id][data-legacy-thread-id]` identifies
the opened thread. A nearby `role="list"` contains message envelopes with
`role="listitem"`, `aria-expanded`, `tabindex="-1"`, a `jsaction` attribute, and
one direct div wrapper. Expanded content inside an envelope carries
`data-message-id` and `data-legacy-message-id`. The body div is not itself the
reordering unit. Nested lists inside message content are excluded.

Grouped/hidden older-message slots keep the same single-div envelope, tabindex,
and action attribute as neighboring messages while temporarily omitting role and
aria-expanded. Gmail Pro compares that action attribute to a verified sibling;
it does not hard-code its generated token, invoke handlers directly, or use Gmail
private APIs. Unknown slots fail closed. Recheck this convention when Gmail changes.

Visible header timestamps confirmed Gmail's native oldest-to-newest sequence in
both inspected threads. No stable numeric timestamp/date attribute was found in
those message headers. The implementation therefore reverses Gmail's native sequence;
it neither decodes message IDs nor parses localized visible dates. Gmail's native
chronological ordering is an explicit assumption, not a universal DOM guarantee.
Another extension that already moves/reverses messages may invalidate that assumption.
An existing flex/order layout is left alone rather than overridden.

CSS visual ordering preserves native focus, node identity, and event handlers, but
screen-reader and sequential keyboard order remain native. See the
[CSS Flexbox ordering/accessibility specification](https://www.w3.org/TR/css-flexbox-1/#order-accessibility).

### Phase 3 verification checklist

Automated fixtures cover 1/2/3/25/500 messages; grouped collapsed slots; expansion and
collapse; fixed controls; attachment ownership; exact style restoration; dynamic
message insertion/removal/replacement; unknown layouts; unrelated/nested lists;
mutation bursts and idle behavior; observer cleanup; repeated start/stop; external
style conflicts; thread switch/Inbox/reopening; hash/popstate/main replacement;
cancellation; Reply/Reply all/Forward with Auto BCC; and Auto BCC disabled.
A synthetic popstate event tests lifecycle handling, not Chrome's real history UI.

After reloading Gmail Pro in Chrome's extensions manager and refreshing Gmail:

1. Enable Newest email first and save. Open a 2–3-message thread, then a longer
   thread with grouped older messages. Verify newest on top, with the subject and
   toolbar above the messages and Inbox ordering unchanged.
2. Expand the older-message group; expand/collapse individual messages. Check an
   attachment stays with its original email and its download/preview controls work.
3. Toggle ordering off with the thread open: original oldest-first order should
   return. Toggle on again and verify one reversal, without flicker or focus jumps.
4. Open another thread, return to Inbox, reopen the same thread, and use Chrome Back
   and Forward. Confirm ordering without refreshing. Repeat in full-thread view
   if normally using Gmail's split reading pane, and vice versa.
5. With Auto BCC enabled, create disposable Reply, Reply all, Forward, and new-compose
   drafts. Confirm one configured BCC each. Toggle thread ordering while a reply is
   open; check text, caret, recipients, and controls remain intact. Remove BCC in one
   draft and confirm it stays removed. Repeat with Auto BCC off: no BCC should appear.
6. Try normal Gmail keyboard shortcuts and Tab navigation. Their native sequence is
   retained. Inspect debug events for repeated reorder/failure loops. Discard the
   disposable drafts. Do not send test messages.

Phase 3 automated validation on September 17, 2026 passed: 12 Node tests, all 27
existing Auto BCC browser checks, and all 27 new thread-ordering browser checks.
Manifest, resource, JavaScript syntax, minimal-permission, and whitespace checks
passed. `content/autoBcc.js`, its browser fixtures, and the settings adapter remain
unchanged from the live-verified Phase 2 baseline.

### Phase 3 live results (September 17, 2026)

The user reloaded the installed `0.3.0` build. In the logged-in Gmail app's split
reading pane, a ten-message thread displayed visible message slots in newest-first
order. All ten original DOM anchors remained in the same native sequence, with
CSS orders 9 through 0; the subject heading was not styled. The collapsed older
message group remained between newer and older messages. Expand All produced ten
expanded messages in descending visual order; Collapse All retained that ordering.
The popup saved the setting and preserved it when reopened. OFF restored block
layout, removed every owned order value, and returned native oldest-first display;
ON reversed it again.

With both features enabled, a live Reply received one committed BCC. A synthetic
sentence entered into that disposable draft and the editor focus both survived
switching thread ordering OFF. Reply All and Forward subsequently each received
one committed BCC with ordering off. All three test drafts were discarded. No
Gmail Pro runtime errors appeared in captured console output; unrelated Gmail and
other-extension warnings/errors were present. No email was sent, no attachment
was downloaded, and source DEBUG remains off.

Further live acceptance remains necessary for navigation/real Chrome Back and
Forward, Reply All/Forward while ordering is ON, full-thread view, attachment
preview/download controls, and keyboard workflows. Automated fixtures cover the
underlying cases, but do not replace those live interactions. The browser security
policy blocked opening the extension settings page during the final integration
checks. The user was asked to re-enable Newest email first manually; ordering was
left OFF after the restoration test, and Auto BCC remains enabled with its original
configured address. No further extension reload is needed for that preference
change.

## Chrome references

- [Storage and Chrome Sync](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content scripts and isolated worlds](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Manifest V3 CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)
- [Load and reload unpacked extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
