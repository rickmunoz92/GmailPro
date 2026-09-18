# Apple Mail-style Message List QA

Validated September 18, 2026 with the installed unpacked extension and current
English desktop Gmail in Chrome. No email was sent. No mailbox captures, message
content, addresses or browser credentials are stored in these fixtures.

## Automated results

| Suite | Result |
| --- | --- |
| `node scripts/validate.cjs` | Manifest/assets/syntax/permissions pass; 17/17 Node tests |
| `tests/messageList.html` | 19/19 browser checks |
| `tests/autoBcc.html` | 27/27 browser checks with message-list mode enabled |
| `tests/reverseThreads.html` | 34/34 browser checks with message-list mode enabled |
| `tests/popup.html` | 11/11 browser checks |

Message-list fixtures use synthetic Gmail structure, including separate subject
and snippet nodes, labels, an optional quick-action wrapper, toolbar margins and
Gmail-owned visibility/state rules. They exercise real Chrome layout at 320, 380,
560 and 1200px; they are not copies of live mailbox data. Native event ownership
checks use synthetic handlers and do not prove every Gmail action end to end.

## Live checks

| Scenario | Result |
| --- | --- |
| Inbox; read/unread rows; conversation participants | Two lines, native weights and content retained |
| Selected/current message; right reading pane | Native highlight and row click work; original message restored |
| Existing starred message | Star remains visible in Starred view |
| Labels; attachment/calendar indicators | Retained in Inbox, Sent, label and search views |
| Sent | All 50 visible rows styled, including optional `.a4X` quick-action wrappers |
| Drafts | All 3 existing rows styled; existing drafts were not edited |
| User-created label | All 49 visible rows styled |
| Attachment search | All 50 visible rows styled on both tested pages |
| Reading-pane list / full-width list | About 689px / 1382px wide; 56px rows; no horizontal overflow |
| Hover actions | Native actions visible; no row-height jump or text overlap |
| Checkbox and multi-select | Two rows selected, then both deselected successfully |
| Keyboard navigation | Arrow key advances native focused row |
| Right click | Native context menu opens and dismisses |
| SPA; refresh; pagination; Back/Forward | New and cached rows retain layout |
| OFF, then ON, through real popup | Immediate native 28px rows/snippets, then 56px two-line rows; no refresh |
| Auto BCC and Newest Email First enabled | Existing preferences retained throughout; live thread reversal confirmed |
| Console | No warnings/errors returned for the tested Gmail session |

Long/short subjects, very long senders, missing importance markers, label width,
RTL, unknown structures, CSS leakage, exact DOM restoration and observer cleanup
are covered by synthetic browser tests. The message-list module creates no
observer when `<html>` already exists; its early-start one-shot observer and
cancellation are covered by Node tests. There is no row discovery loop or polling.

## Remaining limits

- Archive, Delete, Snooze and read/unread actions were inspected and exercised
  with synthetic handlers, not executed against real messages during this QA.
- Drag handler identity is tested synthetically; no real messages were moved.
- Auto BCC composition behavior is covered by the full regression suite; this
  pass did not create new live drafts. Existing drafts were left untouched.
- A screen reader was not used. CSS preserves native DOM/focus order, but that
  does not certify every assistive-technology behavior.
- Other Gmail densities, locales and future DOM variants may differ. The known
  semantic and presentation hooks are documented in `content/messageList.css`.
  Unknown structural layouts retain Gmail's native presentation.
