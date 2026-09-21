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
are covered by synthetic browser tests. The original CSS-only lifecycle described
by these September 18 results is superseded by the timestamp update below.

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

## Conversation timestamp update — September 21, 2026

Both Apple Mail Mode and the standalone message-list preference now format the
full English timestamp supplied in Gmail's date tooltip. Today uses `Today, 1:31 PM`,
yesterday uses `Yesterday, 1:31 PM`, and other dates use
`Mon, 9/14/26, 1:31 PM`. Normal dates use exact `#9C9EA0`; native/Apple Mail
selected foregrounds remain unchanged. Local calendar comparisons handle midnight,
year/month boundaries and daylight-saving changes. Unsupported formats stay native.

The formatted string lives only in an extension-owned attribute. CSS preserves
Gmail's original date nodes, tooltip and accessible name; disabling both modes
reveals the latest native text. Grid observers batch new/changed rows. Main-region
and shallow ancestor discovery handle staged rendering and replaced Gmail pages.
One midnight timer, plus focus/visibility refresh, handles relative-day changes.
There is no polling, added permission, networking, persisted mail data, or per-row
listener. Cleanup releases observers, timers, row references and owned attributes.

| Current suite | Result |
| --- | --- |
| `node scripts/validate.cjs` | Manifest/assets/syntax/permissions pass; 28/28 Node tests |
| `tests/messageList.html` | 40/40 browser checks |
| `tests/appleMail.html` | 54/54 browser checks |
| `tests/reverseThreads.html` | 42/42 browser checks |
| `tests/autoBcc.html` | 32/32 browser checks |
| `tests/messageZoom.html` | 16/16 browser checks |

Coverage includes a controlled clock, midnight/noon, unpadded month/day, leap days,
calendar boundaries, DST transition dates, future dates, invalid metadata, all
preference combinations, reused/replaced rows, deeply staged main replacement,
100-row mutation bursts, no idle feedback loops, latest-native-text restoration,
and observer/timer cleanup. Full older-date strings pass 320/380/560/1200px list
geometry checks; Apple Mail geometry and selected contrast pass both themes and
all eight accents. The accessible full date is retained; a screen reader was not
used for certification.

The first live check verified the metadata contract only. Follow-up testing found
Chrome loaded a separate installed folder, so workspace changes had not reached
the running extension. After confirming every installed file matched the prior
baseline, the tested changes were copied to Chrome's loaded folder. Version
0.9.19 was confirmed in extension Details, the extension was reloaded, and the
existing Gmail page was refreshed.

Live verification now confirms all 13 current rows display the formatted text,
including full older dates, with exact computed `rgb(156, 158, 160)` (`#9C9EA0`).
All tooltip/accessible labels are preserved, no sender/date bounds overlap, and
the live page reports no console errors. A screenshot inspection confirmed the
visible result. The installed copy passes all 28 Node tests. Yesterday and
selected-row variants remain covered by the synthetic suites above; no mailbox
actions or preference changes were needed for this deployment check.
