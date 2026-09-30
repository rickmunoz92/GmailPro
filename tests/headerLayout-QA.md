# Toolbar search and collapsible header — 0.9.28

## Behavior and ownership

Apple Mail Mode places the native search form in the measured gap between the
mail-action group and pagination. The chevron collapses the whole header and
saves `gmailPro.v1.headerCollapsed` through the existing settings adapter. The
missing/malformed default is expanded. The setting follows the existing profile-wide
Chrome Sync behavior. No queries or message data are retained.

The native form never changes parent and is never cloned. At narrow widths the
field is concealed offscreen until the search icon, keyboard focus, or Gmail’s
native `/` shortcut reveals it over the toolbar. Closing preserves the query and
returns focus to the icon. Native suggestions and filter behavior are retained;
the advanced panel’s outer shell follows the form’s position. Filters and mail
content retain Gmail’s native presentation.

Selectors require one desktop `header[role=banner]`, its `.w-asV` shell, one
`form[role=search]` with `input[name=q]`, and one visible `[gh=tm]` with native
`[gh=mtb]` actions and `.Di` pagination. Search suggestions also contain a
`role=banner` cell, so a generic banner query is intentionally insufficient.
Advanced filters use `.ZF-Av > .ZF-zT`. Unknown/ambiguous structures and a gap too
small even for two buttons restore native placement. Disabling the mode removes
all owned markers, sizing, controls, observers, and listeners.

One resize event per actual collapse transition lets Gmail recalculate viewport,
sidebar, and native pane heights. Gmail’s right-split main still subtracts the old
header height in CSS; only that `.Nr.Nm` owner is fitted to its measured `.Tm`
viewport. Pane widths, scroll positions, and message HTML are untouched.

The controller has a ten-second initial discovery observer, then chrome-only
observation and shallow ancestor replacement watches. Resize observation is
retained across updates rather than repeatedly re-registered. No polling,
message subtree observation, networking, permissions, or dependencies are added.

## Automated validation

- Node manifest/resources/syntax/settings/lifecycle validation: 32/32.
- Header browser fixture: 22/22, including native ownership and submission,
  compact geometry, saved state, focus and Escape, suggestions, advanced-panel
  alignment, cached pane height, late startup, replacements, fallback/recovery,
  navigation, storage failure/retry, late writes after disable, and idle/message
  mutation isolation.
- Existing browser suites: Apple Mail 57/57; reading pane 30/30; shortcuts 71/71;
  paging 32/32; automatic read 43/43; floating compose 33/33; popup 18/18;
  Auto BCC 32/32; thread ordering 42/42; message list 40/40; labels 14/14;
  message zoom 16/16. Browser total including header: 450/450.
- `git diff --check` passes. No package installation or build is needed.

Run `node scripts/validate.cjs`, then the loopback fixture server and
`http://127.0.0.1:8765/tests/headerLayout.html`. Add `?preview=1` for a synthetic
visual fixture, or `?preview=1&width=1000` for the compact search icon.

## Live Chrome validation — 2026-09-21

Verified the loaded unpacked source in Chrome Details before updating: version
0.9.28, with the existing storage-only permission. Development and installed
folders are distinct, so production files were copied explicitly.

- At 1710px: the selected-message action group ends at x=936; search begins at
  x=944 and ends at x=1386, before the chevron and pagination.
- Header collapse changes the 65px expanded header to 0. Sidebar grows by 65px.
  Right/list panes grow from 785px to 849px and end exactly at Gmail’s viewport
  bottom. The native 16px outer bottom gutter remains.
- The saved collapsed choice survives refresh. Expanding and mode OFF restore
  the native header; mode OFF also restores the 720px search at (256, 8), removes
  every owned marker/control, and mode ON re-applies the saved choice.
- At 1400px with a conversation open: icon → native field → close works; focus
  returns to the icon. Gmail’s native `/` key opens/focuses the same input.
- Ordinary typing displays native suggestions. Their lower rows receive pointer
  hits and are contained within the form. Advanced filters align with search in
  both layouts, retain native width, and stay within the viewport.
- A synthetic no-match query submitted through native Enter reaches Gmail’s
  search route and displays No matches; returning to Inbox restores the toolbar.
- A long, already-read conversation scrolls to its bottom (about 2297px of scroll)
  while the pane bottom stays aligned with Gmail’s viewport. A short message list
  fits normally without a spurious scrollbar or header-sized gap.
- No email was sent, no draft created, and no unread conversation was opened for
  testing. Test data and captures containing real mail were not saved to the repo.

## Search alignment follow-up — 0.9.29

- Centered native SVG icons, the initial plain input, and the later autocomplete
  input/ghost field within the 34px content row. Preserved 56px native button
  widths and the form's ability to grow for suggestions.
- Added realistic native padding/absolute-input coverage, including centering
  while suggestions are open, icon containment, and style restoration.
- Re-ran validation: 32/32 Node checks and 23/23 header browser checks pass;
  `git diff --check` passes. The other browser totals above are from 0.9.28.
- Confirmed Chrome's loaded folder before updating to 0.9.29. Live Gmail's text
  and all SVG centers match the 36px bar's center (0px offset). Suggestions grow
  the form to 607px while the input stays centered in the search row.
- Chrome's Gmail renderer crashed during one reload; reloading recovered it,
  and subsequent checks passed. The temporary search query was cleared.

## Compose toolbar follow-up — 0.9.30

- Added an accessible icon-only Compose action immediately after the native
  selection control. It delegates to the original Gmail Compose button; the
  original button and its handlers remain in their native sidebar parent.
- Hide only the validated dedicated Compose row while the toolbar icon is
  available. Missing selection controls, mixed sidebar content, insufficient
  space, and mode OFF restore the native row. Replacement/navigation coverage
  includes cloned toolbar markup and native Compose button replacement.
- Neutralized only the Phish Alert toolbar bitmap, with separate light/dark
  tints; its native action, tooltip, and icon source remain unchanged.
- Live 0.9.30: Compose follows Select, with a 0px center difference; the 60px
  sidebar row is removed and the mailbox scroller grows from 837px to 897px.
  Clicking Compose opens Gmail's normal composer. The empty test draft was
  discarded, with no message sent. Phish Alert's computed filter is neutral.
- Node validation: 32/32. Browser regressions: header 28/28, floating compose
  33/33, appearance 57/57, reading pane 30/30, shortcuts 71/71, paging 32/32.
  Other suite totals above refer to earlier versions. `git diff --check` passes.
- Automatic approval review rejected opening a live email for additional
  toolbar testing because message content was unnecessary. Selected-message
  action behavior was checked through the synthetic regressions instead.

## Toolbar spacing and stable search — 0.9.31

- Reduced Compose's leading margin by 8px, moving Compose and following actions
  left together. Its native checkbox alignment remains unchanged.
- Search now stays 400px wide across selection changes. Insufficient space uses
  the existing icon/overlay instead of continuously shrinking the field.
- Validation: Node 32/32, header browser 29/29, and `git diff --check` pass.
  Live Gmail: Compose moved from x=289 to x=281; Refresh from x=333 to x=325.
  Search remained 400px before and after checkbox selection; selection was
  cleared afterward. No email was opened or sent for this verification.
- Confirmed the loaded extension folder and reloaded version 0.9.31.

## Reply All and search fit — 0.9.32

- Reply All stays available whenever native Reply is available, falling back to
  that native action when Gmail omits Reply All. Native Reply All is preferred
  when available; activation re-resolves the current message and controls.
  No recipient addresses are constructed or modified.
- Reduced the stable field from 400px to 360px. The user's already-open toolbar
  measured action-right 1002px and pager-left 1434px, leaving 376px for search
  after the existing gaps and chevron. The field therefore fits all actions.
- Validation: Node 32/32, header 29/29, reading pane 31/31, keyboard shortcuts
  71/71, floating compose 33/33. Coverage includes the single-recipient fallback,
  native action replacement, unavailable Reply, and the narrower full toolbar.
- Loaded source confirmed before updating/reloading 0.9.32. Live search is
  360px and visible after reload; single-recipient activation was tested with
  synthetic messages. No live email was opened or sent for this verification.

## Label navigation header fix — 0.9.38

- Gmail's label/search toolbar wraps a native filter row and a separate mail-action
  row. Its 101px wrapper exceeded the previous 80px geometry limit, restoring the
  native header, search, and Compose row. Measure the shared action/pagination
  row instead, and include that row in the existing resize observation.
- Retain the 360px field, saved header preference, native search parent/handlers,
  filter controls, Compose, and branding. Unknown or oversized action rows and
  insufficient horizontal room still retain the usable native fallback.
- New regressions failed before the fix. Header checks now pass 34/34; Node
  validation passes 36/36, including resources/syntax/settings/lifecycle checks.
  `git diff --check` passes. No permissions, dependencies, or settings changed.
- Verified Chrome's loaded folder and applied/reloaded 0.9.38. Live custom labels,
  Starred, and Snoozed retain inline search and the collapsed header. The affected
  custom label has a 101px toolbar, 32px native filters, 360px search with a 0px
  center offset from the mail actions, and one Compose icon and sidebar wordmark.
  No messages were opened, sent, or changed during these checks.

## Single toolbar across mail views — 0.9.39

- Apple Mail Mode hides only the native mail-toolbar refinement row (`From`,
  time, attachment, calendar, and recipient chips) and restores Gmail's compact
  48px action row plus its 1px border. The rule applies to every mailbox, label,
  and search-results view. There is no route-specific state or DOM removal.
- Gmail's original search form and advanced-search button remain available.
  Turning the mode off restores the native refinement row and toolbar height.
- Header checks pass 34/34, including advanced-search hit targets, reclaimed
  height, late filter insertion, navigation, compact search, and mode OFF.
  Appearance checks pass 57/57; Node validation passes 36/36.
- Applied and reloaded 0.9.39 in Chrome's verified loaded folder. Sent, Starred,
  and a custom label each show a 49px toolbar, a hidden refinement row with no
  reserved height, inline search, and the saved collapsed header. The search
  bar's native advanced-search panel opens normally and closes with Escape.
  Returned to Inbox afterward. No messages were opened, sent, or modified.

## Mailbox caption — 0.9.40

- Added an 11px, theme-aware muted caption directly below the toolbar border,
  inside Gmail's native conversation list. It uses 22px of list space, remains
  sticky while that list scrolls, and adds no gap to the reading pane.
- Shows the current mailbox or final nested-label name and Gmail's pagination
  total. Singular, formatted, approximate, empty, unavailable, and pending totals
  are covered. Counts describe Gmail's listed conversations using the requested
  “messages” wording; individual replies are not read or tallied.
- Normalizes encoded SPA label routes against native sidebar links. Withholds
  the old total during navigation until native count evidence changes. Uses only
  the existing header controller, bounded chrome observers, and shallow list
  replacement watches. Mode OFF removes the caption; cloned/replaced panes
  recover without duplicate captions or idle writes.
- Header checks pass 42/42, including eight caption regressions; appearance
  checks pass 57/57 and Node validation passes 36/36. Diff whitespace checks pass.
- Applied and reloaded 0.9.40 in Chrome's verified loaded folder. Live captions:
  Inbox • 10 messages, Sent • 14,483 messages, Starred • 1 message,
  Flowserve • 680 messages, and Snoozed • 0 messages. Inbox's caption is 22px
  high at y=49 immediately beneath the 49px toolbar; search remains 360px wide.
  Returned to Inbox. No messages were opened, sent, or modified.

## Caption spacing in short folders — 0.9.41

- Reproduced the intermittent gap in live Inbox: Gmail's `.Nu.tf` uses
  `justify-content: space-between`, distributing spare height above and below
  short conversation lists once the caption becomes an extra section. The
  measured caption-to-first-row gap was 157.5px.
- A scoped CSS rule absorbs that spare height after the native `.ae4` list,
  keeping conversations immediately below the 22px caption and the footer at
  the bottom. It applies whenever a caption is present across folders, labels,
  and search results. Native heights, scrolling, and the reading pane are retained;
  removing the caption or turning the mode off restores native spacing.
- Added native short-list/loading/footer geometry to browser fixtures. The new
  regression failed before the fix and passed afterward. Checks cover multiple
  folders, nested labels, search, both header states, changing content heights,
  loading sections, content replacement, overflowing lists, scrolling, and OFF.
  Header checks pass 44/44, appearance checks 57/57, Node validation 36/36,
  and diff whitespace checks pass.
- Applied and reloaded 0.9.41 in the verified loaded Chrome extension. Live
  Inbox, Starred, Sent, and Flowserve have a 0px caption-to-first-row gap.
  Snoozed's empty-state container also has a 0px gap. Inbox retains a 49px toolbar,
  360px search, and footer ending 16px above the pane bottom. Returned to Inbox;
  no message actions were performed during verification.

## Fixed caption while scrolling — 0.9.42

- Moved the caption out of Gmail's native scrolling pane and beside the toolbar.
  It uses fixed positioning against the measured pane bounds. A 22px pseudo-element
  reserves its existing space inside the list, retaining the short-list spacing
  fix, footer placement, and Gmail's scrolling ownership. No scroll listener or
  per-scroll positioning writes were added.
- Pane resize observation keeps the caption aligned when the splitter or header
  layout changes. Reserved space follows native pane replacement and cleans up
  when the feature stops. The fixed caption shields covered rows from clicks.
- The new regression failed on the sticky implementation and passed after the
  change. Checks assert that the caption is outside the scroll surface, keeps
  identical bounds throughout scrolling, performs no caption writes on scroll,
  follows native width and header changes, and removes its reserved space on OFF.
  Header checks pass 45/45, appearance checks 57/57, Node validation 36/36,
  and diff whitespace checks pass.
- Applied and reloaded 0.9.42 in Chrome's verified loaded folder. In an isolated
  live Flowserve view, native wheel scrolling moved the list from 0 to 830 and
  1719px while caption bounds stayed x=217, y=49, width=434.25, height=22.
  Advancing from conversations 1–50 to 51–100 retained those exact bounds and
  the total of 680. The initial conversation-to-caption gap remained 0px.
  Closed the isolated verification view; no message actions were performed.

## Caption locked to its toolbar — 0.9.43

- The separately positioned caption still used scrolling-pane coordinates.
  Moved it into the native toolbar itself, with CSS anchoring it directly below
  the border. Only its width follows the native pane; scrolling cannot update
  independent top/left coordinates. The existing 22px reservation, short-list
  spacing, native scroll positions, and reading pane remain intact.
- Added a regression that shifts the native pane repeatedly while scrolling.
  It failed on 0.9.42 and now verifies unchanged toolbar-relative placement,
  zero positioning writes, native toolbar replacement, and duplicate cleanup.
  Fractional pane widths and native scrollbar gutters remain correctly aligned.
- Header checks pass 46/46, appearance checks 57/57, Node validation 36/36,
  and diff whitespace checks pass. No settings, permissions, or dependencies
  changed.
- Applied and reloaded 0.9.43 in the verified loaded Chrome extension. Rapid
  native wheel scrolling through 1719, 59, 1719, and 0px kept the caption at
  y=49, exactly against the toolbar bottom, with width 434.25px. Native paging
  to conversations 51–100 kept that same anchor and total. Inbox, Sent, Starred,
  Snoozed, and Flowserve each retained toolbar ownership and a 0px gap before
  native list content. No message actions were performed during verification.

## Seamless mailbox scroll edge — 0.9.45

- Gmail's native `.V3.adh` scroller adds a top border and inset shadow after
  scrolling, directly beneath the Gmail Pro wordmark. Apple Mail Mode now keeps
  that border transparent and removes the scroller shadow. Native border width,
  scrolling, the vertical sidebar divider, and the mail-toolbar border remain.
- The new regression failed before the CSS fix. It checks top, middle, and bottom
  scroll positions in both themes, stable border geometry, and restoration of
  native decoration when the mode is disabled. The full workspace passed
  55/55 header checks; the isolated staged commit passed 47/47 header checks
  and 36/36 Node checks without the earlier uncommitted sidebar changes.
  Reviewed both diffs; whitespace checks pass.
- Confirmed Chrome loads `~/Documents/GmailPro`, verified its CSS and manifest
  matched the pre-edit workspace, and applied only the tested CSS and version.
  Reloaded 0.9.45 and refreshed Gmail, including its app window. Live mailbox
  scrolling reached 812px with the native scrolled class active, a transparent
  1px top border, no shadow, and the sidebar/toolbar dividers retained at 1px.
  No email actions or settings changes were performed.

## Compatibility limits

This targets the inspected English desktop Gmail DOM. Native-only fallback is
intentional when Gmail replaces the structure or cannot fit compact controls.
The form retains native DOM/tab order even though it is visually in the toolbar.
Future Gmail layout changes, very small windows, other layout extensions, and
complete screen-reader certification require further compatibility checks.
