# Custom Label Order QA — September 2026

## Implementation decision

Live inspection found custom rows under `[gh="cl"] > .TK`, separate from
system folders. Nested rows are flat siblings with explicit indentation and
full label navigation paths. More creates a second container only while open;
collapsing a parent removes its child rows.

Early experiments physically moving rows revealed Gmail's incremental renderer
relies on native DOM positions. The shipped implementation uses reversible CSS
visual order and preserves every native row's DOM sequence. Native HTML dragging
was also replaced by handle-scoped Pointer Events, verified by live mouse dragging.
No Gmail API/network interception, server-side label edits, message labeling,
test-label creation, or sending were used.

## Automated results

- Manifest/resources/syntax/minimal permissions: passed (`node scripts/validate.cjs`).
- Settings/lifecycle: 18/18.
- Custom labels: 14/14, including 300 labels, multi-level nesting, unchanged native
  row sequence, parent collapse/expand, SPA replacement, initial/staged rendering,
  new/stale/deleted/renamed labels, keyboard/pointer moves, save failures, More
  preservation, normal click/context/drop handlers, independent settings,
  idempotence and zero idle/repeated-apply DOM mutations.
- Auto BCC: 27/27.
- Newest Email First: 34/34.
- Apple Mail-style Message List: 20/20.
- Popup: 12/12, including label switch, sync metadata, reset and failed reset.

Total: 125 automated checks. Browser fixtures run in Chrome against synthetic
content; no dependency or external drag/drop library was added.

## Live checks performed

- Inspected existing labels, zero/unread counts, menu metadata/icons and nested
  structure without changing label names, hierarchy or visibility settings.
- Entered edit mode from the actual extension popup with all three existing
  Gmail Pro features enabled; only top-level labels received handles.
- Moved a parent with keyboard controls: all 51 visible child rows remained grouped.
- Moved another top-level label with actual mouse Pointer Events; automatic save
  status appeared and the visual rank changed while native node sequence stayed fixed.
- Collapsed/re-expanded the moved parent: 0/51 descendants as expected and exactly
  234 unique visible rows afterward, with no duplication in the final implementation.
- More expanded during editing and collapsed again after Done. Two additional
  existing labels were discovered in its separate container.
- Verified saved visual ordering after Gmail reload, label opening, native search,
  Back/Forward, opening an already-read message and returning to Inbox, and main
  sidebar collapse/re-expansion.
- Verified Off removes ordering styles and controls; On reapplies the saved order;
  Reset restores native presentation. Temporary test order was cleared and the
  new feature returned to Off. Existing feature toggles were retained.
- Visually checked editing with the user's existing dark theme.
- No console errors attributed to `labelOrder.js` were captured. The shared Gmail
  tab did contain generic extension messaging errors during reload; their source
  was not attributable to this feature, so this is not a claim of a clean Gmail console.

## Limits / manual follow-up

- Visible and More sections keep Gmail's ownership; labels cannot be dragged across
  that boundary. Hidden sections retain their saved ranks when absent from the DOM.
- Names in navigation paths are not immutable Gmail IDs: a rename receives a new
  default position. Preferences apply across accounts in one Chrome profile.
- Screen-reader and sequential Tab order stay native; ↑/↓ on handles follows
  visual order. Full assistive-technology certification remains unperformed.
- Pointer dragging has no edge auto-scroll. Scroll first, collapse large parents,
  or use keyboard arrows for distant moves.
- A real Chrome restart, cross-device Sync, multi-hour soak, a distinctly colored
  label, native hover/context menu selections, and dropping a real message onto a
  label remain manual checks. Message-drop handling was tested synthetically to
  avoid altering actual message labels; Auto BCC composition was covered by the
  existing synthetic suites, without creating or sending real test messages.
- Gmail DOM redesigns/localization (especially the More/less accessible labels)
  can require selector updates. Unknown structures fail closed.

## Files changed

- `content/labelOrder.js`, `content/labelOrder.css` — isolated feature and edit styles.
- `content/gmailSelectors.js`, `content/content.js` — selectors and shared lifecycle.
- `shared/settings.js` — validated Sync toggle/order metadata.
- `popup/popup.html`, `popup/popup.js`, `popup/popup.css` — toggle, Edit and Reset.
- `manifest.json` — version 0.5.0 and bundled label scripts/styles; same permissions.
- `scripts/validate.cjs` — manifest resource assertions.
- `tests/settings.test.cjs`, `tests/popup.browser.js` — preference regressions.
- `tests/labelOrder.html`, `tests/labelOrder.browser.js` — synthetic sidebar suite.
- `README.md`, `tests/labelOrder-QA.md` — user guide, architecture and QA record.
