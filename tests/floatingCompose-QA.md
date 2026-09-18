# Native floating composer QA — September 18, 2026

## Implementation and preservation

- Capture native Reply / Reply All / Forward, delegated Gmail Pro toolbar actions,
  and Gmail's lowercase r/a/f shortcuts. Observe only the current conversation during
  the action, excluding editors that already existed. New Compose stays native.
- Require Gmail's native region, addressing form, Message Body editor, and the current
  pair of Pop out reply controls with exactly one visible. Live Gmail initially exposes
  a construction control that ignores activation; this motivated the paired-control guard.
- Wait for native editor/recipient focus, then invoke the actual control in one pre-paint
  callback with native mouse events. A plain early click was insufficient in live Gmail.
  Re-resolve the control at activation time. Never reconstruct recipients, subject/body,
  attachments, signatures, draft IDs, or Gmail's compose lifecycle.
- One-attempt WeakSet per region; disconnect before activation. Dialogs and pre-existing
  inline editors are excluded. Each conversation has its own bounded action intent.
- Suppress opacity only on a confirmed new editor for at most one rendering opportunity.
  Finally/cancel/navigation/visibility cleanup always removes suppression. Missing controls,
  lost focus, unsupported structures, and failed activation leave inline Gmail usable.
  A two-second expiry only cleans up observation. No polling or external windows.
- Auto BCC's existing owner remembers decisions across native form replacement by the
  observed session data-compose-id. Identity can arrive after form creation. The 100-entry
  memory-only history preserves pending/inserted/removed states without storing message
  text or recipient lists. No second BCC implementation was added.
- The starting checkout already had no external-window modules/service worker, positioning,
  size preferences, or related permissions. `storage` remains the only manifest permission.
  No old architecture had to be deleted. Existing safe compose chrome styling is reused.
- Existing uncommitted recipient-label/unread-dot work was preserved in checkpoint
  `762e248`, with `codex/before-native-compose` pointing to it.

## Automated verification

`node scripts/validate.cjs`: 24/24 unit checks, manifest/resource/syntax checks,
minimal-permission assertions. `git diff --check`: clean.

Real Chrome synthetic browser suite (all local; no mail can be sent):

| Suite | Passed |
|---|---:|
| Floating composer | 26/26 |
| Auto BCC | 32/32 |
| Persistent reading-pane actions | 30/30 |
| Newest-first threads | 42/42 |
| Message list | 20/20 |
| Label order | 14/14 |
| Message zoom | 16/16 |
| Apple Mail appearance | 47/47 |
| Settings popup | 15/15 |
| **Total** | **242/242** |

New coverage includes independent settings, native header/menu/toolbar/keyboard actions,
construction controls, mouseup-driven activation, multiple/minimized drafts, existing drafts,
missing and no-op controls, delayed controls, native-focus fallback, pre-paint cancellation,
navigation, lifecycle cleanup, late compose identity, manual BCC removal and form replacement.

## Live Gmail verification

English desktop Gmail, Chrome, existing account and extensions, Apple Mail Mode enabled.
Only newly created disposable drafts were discarded. No mail was sent. Original five drafts
remained; temporary diagnostic attributes/code were removed before the final smoke test.

- Automatic floating Reply from the persistent toolbar: passed; native body focus,
  signature, recipient and one BCC verified.
- Automatic floating Reply All from the native message header and persistent toolbar:
  passed; one To recipient, three CC recipients, one BCC, signature and body focus verified
  against the selected multi-recipient message.
- Automatic floating Forward from the persistent toolbar: passed; native forward subject,
  forwarded content, signature and one BCC verified.
- Three simultaneous floating drafts from different threads: passed; each retained one BCC.
- Native minimize -> collapsed draft -> manual maximize: passed; no automatic reopening.
- Manual BCC chip removal followed by minimize/restore: passed; BCC remained absent.
- Signature menu -> No signature -> existing signature: passed; native replacement works.
- Native Save & close preserved a disposable text marker and returned the draft inline.
  **Limitation:** that reconstructed inline draft reapplied a manually removed Auto BCC.
  Do not claim removal survives every save/close/reopen path. Review BCC after reopening.
- Attachment picker opened, but selecting the synthetic text file was blocked by the
  ChatGPT browser extension's file-access setting. Upload/remove/drag-drop remain unverified.
- Final production smoke test: one floating Reply All, body focus, zero hidden-transition
  markers, and no diagnostic attributes. No custom editor/window or compose positioning.

## Remaining manual checks / limits

1. Confirm perceived opening smoothness on the user's usual thread sizes and hardware.
   Pre-paint suppression limits flashes but does not guarantee zero inline frames when
   Gmail performs slow asynchronous setup. No frame-by-frame live recording was made.
2. Attach/remove a test file, drag/drop an image, and forward a message with attachments.
   Gmail owns those paths; only the picker and existing signature/forward content were checked.
3. Try Search, a label, Sent, full-thread mode, Browser Back/Forward, and Apple Mail Mode off.
   Navigation/appearance regressions are covered synthetically; that complete live matrix
   was not executed. Keyboard shortcut coverage is synthetic; Gmail must enable shortcuts.
4. Check body formatting and reload/reopen a saved disposable draft. Confirm BCC before sending,
   especially after Save & close or a page reload. Never send the QA draft.
5. Unknown Gmail markup/locales fall back inline. The paired Pop Out controls, editor labels,
   validated conversation shell, and session compose identity are DOM assumptions, not a
   public Gmail API. History eviction/reload/new identity can reinitialize Auto BCC.
