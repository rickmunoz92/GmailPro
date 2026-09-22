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

## Compatibility limits

This targets the inspected English desktop Gmail DOM. Native-only fallback is
intentional when Gmail replaces the structure or cannot fit compact controls.
The form retains native DOM/tab order even though it is visually in the toolbar.
Future Gmail layout changes, very small windows, other layout extensions, and
complete screen-reader certification require further compatibility checks.
