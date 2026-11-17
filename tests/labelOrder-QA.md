# Label organization QA — 0.9.37

## Message drag pickup — November 16, 2026

Native Gmail debugging identified its hidden-element size helper measuring
Gmail Pro's hidden `.aim` label rows during message pickup. For each row whose
computed display was `none`, Gmail temporarily wrote visibility, position and
display, measured its offsets, then restored those styles. The work inbox had
46 user-hidden rows plus collapsed system mailboxes on this path.

Hidden rows now retain an invisible, noninteractive 0 × 0 block. Their native
`.TO`/`.TN` contents remain `display:none` so links also retain zero geometry.
This keeps Gmail's measured row out of its reveal/measure/restore branch without
changing native row identity, ordering, drag thresholds, movement or dropping.
The same collapse rule covers Mailboxes More content; revealing rows, changing
mode and stopping the feature restore the existing native presentation.

Reading-pane observation also ignores cursor-only mutations using the existing
shared filter, and ordinary input no longer refreshes exhausted recipient
fallbacks. Synthetic regressions verify that real style changes still refresh.
There is no production instrumentation or mailbox-content recording.

### Automated validation

- `node scripts/validate.cjs`: resource/syntax/permission checks and **51/51**
  repository tests passed; `git diff --check` passed.
- Label ordering with dark Apple Mail appearance: **57/57** passed. Three
  synthetic pickups across 300 hidden labels caused **zero reveal/restore
  writes**; rows and their links had zero geometry and could not take focus.
  Existing transient-feedback instrumentation reported **zero full scans,
  account reads and style writes**. Replacement, native visibility, account
  changes and cleanup regressions also passed.
- Header/sidebar: **128/128** passed, including More/Less, native hidden-link
  geometry and system-mailbox measurement without reveal writes.
- Apple Mail appearance: **81/81**; label reminders: **13/13**;
  badge filing: **97/97**; reading pane: **58/58** passed.

### Live work inbox and limits

Reloaded the existing unpacked extension from `/Users/rmunoz/Documents/GmailPro`
and refreshed the user's standalone work Gmail app. The final rule produced
zero-size hidden rows and links, with no `.aim` row using `display:none`.
More/Less revealed and restored the native system rows. Meta-click selection
toggled on and off, and three message drags ended in blank reading-pane space
without filing messages; the cursor and selection returned to their idle state.
The user's original appearance and settings remain enabled.

The final short native Performance recording of three drags showed 1,859 ms of
aggregate rendering work, a longest `mousemove` event of **47.606 ms**, and a
longest `mouseout` event of **129.130 ms**. A comparable earlier full-appearance
three-drag recording showed 6,712 ms of aggregate style recalculation. These
aggregate totals include other rendering work and are not exact pickup times.
The recording does not establish time from Gmail's movement threshold to the
first drag image, or attribute all remaining tasks to the extension.

The user reported pickup feels more prompt, with some lag while moving toward a
label. The 100 ms pickup criterion remains unverified, and the 50 ms task target
is not fully met. Native label highlighting and badge filing have fixture
coverage; no real message was deliberately dropped/filed during this diagnosis.
A multi-hour idle soak and screen-reader verification were not performed.
Changes remain local; no commit, push or store update was performed.

## Gmail menu compatibility — November 10, 2026

The work inbox now marks native label-menu triggers with `aria-haspopup="menu"`.
The shared selector only accepted `"true"`, so the organizer rejected the native
label lists and could not apply saved order or hidden branches. Accept both
values while retaining the existing matching-path and hierarchy validation.
No settings migration, reset, or account-scoping change is needed.

All three affected browser fixtures now use current menu markup. Label checks
also cover legacy and mixed triggers, restoration from saved preferences without
startup writes, account isolation, unsupported menu kinds, and mismatched paths.

- `node scripts/validate.cjs`: manifest/resource/syntax/permission checks and
  **47/47 settings/lifecycle tests** passed.
- Label organization with Apple Mail appearance: **56/56** passed.
- Label filing: **97/97** passed.
- Header/sidebar: **126/127** passed in the 1280px in-app browser. The remaining
  fixed-width search check passed when isolated in desktop Chrome, where the
  fixture's 1400px layout fits. No header implementation changes were made.
- After the user reloaded the unpacked extension in the work Chrome profile,
  the live inbox restored saved ordering and sublabel hiding without resetting
  preferences. The user also confirmed the sidebar looked correct again.

## Nested parent identity fix — October 12, 2026

Gmail's closed parent picker displays a nested parent's short name, while its
selected option's `data-value` retains the full path. Comparing that display text
with the sidebar path incorrectly rejected deeper sublabels as the wrong editor.
Source validation, destination verification, and keyboard Save now share the
selected full-path lookup, scoped to the editor's controlled listbox. An editor
for a different parent is still rejected when both parents have the same short
name. The fixture models Gmail's short display names and selected option values.

- `node scripts/validate.cjs`: manifest/resources/syntax/minimal-permission checks
  passed; **41/41 settings and lifecycle tests** passed.
- Label fixture in the Codex in-app browser: **49/49** passed, including deeper
  source nesting, nested destinations with repeated short names, keyboard moves,
  hidden-path migration, and wrong-parent rejection.
- Live English Gmail: reproduced the original rejection, reloaded the unpacked
  extension from `/Users/rmunoz/Documents/GmailPro`, then opened the same nested
  label's editor through the organizer. The requested move to a top-level parent
  saved successfully, reported the confirmed destination, and persisted after a
  Gmail refresh. The mailbox still showed its original 27 conversations.
- Live verification used the keyboard/native-editor path. Pointer moves are
  covered by the browser fixture; a new live pointer gesture was not performed.
- Changes remain local; Git publication was not requested.

Validated September 29–30, 2026, against English desktop Gmail and the synthetic
browser fixtures. The previous release's organization results are retained below.

## Native-menu sidebar hiding

Verified custom sublabel menus receive a separate **Hide from sidebar — Gmail
Pro** action. Top-level menus, unknown menus, color palettes, and parent-movement
operations retain their native controls. The context records the verified account,
full label path, and original row/menu nodes; dismissal, reuse, account changes,
sidebar replacement, and feature cleanup retire stale controls and listeners.

Menu actions and organizer eyes share explicit, serialized Hide/Show saves through
the existing settings adapter. Hiding works outside editing and with visual order
disabled. Hidden branches include descendants. Revealed branches offer **Show in
sidebar — Gmail Pro**; inherited descendants explain that their parent must be
restored first. No native badge setting is converted into a sidebar preference.
Outside editing, confirmations and dismissible storage errors appear below Labels.

Gmail closes its portal when focus leaves the menu, including focus on a child.
The added keyboard action therefore uses Gmail's `aria-activedescendant` pattern
while keeping focus on the native menu. End and boundary arrows select the added
action; Enter/Space activates it; Home/arrows return to native items; Escape closes
the menu without leaving the organizer. Pointer mousedown retains menu focus.
The action copies the native item's text color so a white Gmail portal remains
readable inside a dark sidebar. Added height is fitted to the viewport reversibly.

## Current automated results

- `node scripts/validate.cjs`: manifest/resources/syntax/minimal-permission checks
  passed; **36/36 settings and lifecycle tests** passed. No new settings schema,
  permissions, packages, Gmail API access, or parallel store were introduced.
- Label fixture: **45/45** in Chrome, and **45/45** in the Codex in-app browser
  with dark and light appearance. Existing native movement, visual-order,
  visibility, More, and message-drag regressions remain covered.
- Popup fixture: **20/20** in Chrome with the production popup markup and updated
  sidebar-hiding guidance.

New regression coverage includes normal-mode hiding with ordering off,
descendants, restoration, inherited disabling, native badge settings, unsupported
and top-level menus, keyboard boundaries, Gmail's close-on-blur behavior, pointer
focus retention, reused portals targeting different labels, duplicate activation,
read/write failures with persistent dismissible errors, delayed-save cancellation,
account changes, sidebar replacement, lifecycle cleanup, native text color, and
reversible viewport fitting.

## Current live disposable Gmail checks

Created `Gmail Pro Hide QA`, `Gmail Pro Hide QA/Child`, and
`Gmail Pro Hide QA/Child/Grandchild` through native Gmail controls. Assigned Child
and Grandchild to one **unsent disposable draft** named
`Disposable Gmail Pro Hide QA`.

- The root's native menu had no Gmail Pro sidebar action. The Child menu displayed
  the new action separately beneath Gmail's native controls.
- Pointer activation hid Child and Grandchild outside the organizer. Both remained
  hidden after refreshing Gmail, while the root remained visible.
- Both draft badges remained present after hiding. Gmail's assignment picker still
  showed both labels checked after refresh. In message list → Show stayed checked.
- Organize labels → Show hidden sublabels revealed the branch. Grandchild's menu
  action was disabled with the parent-restoration explanation; Child offered Show
  in sidebar. End, ArrowUp/Down, and Space worked on the live native menu, and
  Space restored the branch. Escape kept organizer editing active.
- Restored the branch before cleanup, discarded only the disposable draft, and
  removed the three disposable labels through Gmail's scoped removal dialog.
  Confirmed no QA labels or draft remained and returned the mailbox to Inbox.
  Nothing was sent and no existing message assignments were changed.

## Current deployment and limits

Chrome's extension controls confirmed **0.9.37**, ID
`kkddeggjgdhlihdkingjkmahonjipcfd`, loaded from
`/Users/rmunoz/Documents/GmailPro`. Changed production files were synchronized,
reloaded through native Chrome controls, and Gmail was refreshed. Previous
production files are retained in `/private/tmp/gmail-pro-labels-0.9.36`.

Live verification used the existing dark sidebar and Gmail's white native menu;
dark and light fixtures cover appearance without changing the user's theme.
Gmail menu redesigns/localization remain the main compatibility risk: unsupported
menus receive no added action. A Chrome restart, cross-device Sync, screen-reader
certification, and a multi-hour soak remain unperformed. New native-menu hiding
was checked live; parent movement and native top-level visibility were checked
live in 0.9.36 and retained in current synthetic regressions.

## Historical organization QA — 0.9.36

Validated September 29–30, 2026, against English desktop Gmail and the synthetic
browser fixtures. This replaces the original visual-order-only QA record.

### Implementation

The existing label controller owns the organizer button, top-level visual order,
native sublabel parent moves, and account-scoped sidebar hiding. No additional
permissions, packages, Gmail API access, or parallel settings store were added.

Gmail's flat `.aim` sequence remains unchanged. CSS orders top-level groups only
within their native container, while native hidden rows, More, unread visibility,
collapse controls, badges, and message drag handlers retain Gmail's behavior.
Editing no longer opens More automatically.

Sublabel moves use Gmail's own Edit label dialog and Nest label under picker.
The controller validates the source and destination, preserves the label name,
saves once, and verifies Gmail's resulting path before reporting success. It
expands the chosen destination when needed to observe the committed path.
Unknown controls and failed or unconfirmed saves produce an actionable message.
Keyboard users open the same native editor with Enter or Space on the handle.

The eye control saves `{ account, path }` records through the existing settings
adapter. A hidden branch includes its descendants. Show hidden sublabels reveals
these rows only during editing; native Gmail visibility remains authoritative.
Hidden paths are remapped only after a confirmed Gmail move. Done after Save
closes editing while verification and hidden-path remapping finish.

### Automated results

- `node scripts/validate.cjs`: manifest/resources/syntax/minimal-permission checks
  passed; all **36/36 settings and lifecycle tests** passed (baseline: 34).
- Label browser fixture: **34/34** in Chrome and the Codex in-app browser on
  the final revision, in plain, dark, and light views. This includes native hover
  mutation, title-labelled disclosure, edge scrolling, and Escape propagation.
- Popup browser fixture: **20/20** in Chrome and the Codex in-app browser on
  the final revision. New coverage verifies the organizer opens through the
  existing message entry point with visual ordering disabled, and resetting order
  preserves hidden-sublabel preferences.

Label regressions cover the header position/accessibility, pointer and keyboard
movement, descendants, unchanged native DOM sequence and message dragging,
self/current-parent/descendant destinations, hidden name collisions, native
visibility and More, account isolation, branch hiding/reveal/restore, reload
state, read/write failures, partial success after Gmail commits, cancellation,
Done after Save, stale row removal, account changes, sidebar replacement,
unknown editor controls, save rejection without retries, hover mutations,
collapsed destinations, and edge scrolling. Existing large-list, idle-mutation,
settings independence, and lifecycle regressions remain covered.

### Live disposable Gmail checks

Created only these disposable labels for the named QA workflow:
`Gmail Pro QA A`, `Gmail Pro QA B`, `Gmail Pro QA A/Child`, and
`Gmail Pro QA A/Child/Grandchild`.

- The arrows appeared immediately left of Labels + and opened the organizer.
- Enter on the Child handle opened Gmail's real native editor. Choosing the new
  parent and saving moved Child and its collapsed Grandchild together. Gmail's
  parent picker confirmed the full resulting hierarchy.
- Actual pointer dragging between the two parents saved the native parent change.
  Gmail's hover mutations did not cancel the gesture. A collapsed destination was
  expanded using Gmail's title-labelled disclosure to verify the new path.
- Hid Grandchild with the Gmail Pro eye, moved its ancestor, and reloaded Gmail.
  Grandchild remained hidden at its new path. Show hidden sublabels revealed it;
  the eye restored it and cleared the disposable hidden-path preference.
- Assigned Child and Grandchild to one **unsent disposable draft**. After moving
  Child, both resulting label badges and native assignment checkboxes remained
  present on that draft. The draft was discarded after the check; nothing was sent.
- Native top-level Hide removed QA A from the main sidebar while organization was
  active. Native Show if unread also kept the zero-unread label absent; Show
  restored it. The message-list visibility setting remained unchanged.
- Removed all four disposable labels through native Gmail settings and confirmed
  no QA labels or disposable draft remained. No existing message assignments or
  label hierarchy were changed for this QA workflow.

Live inspection confirmed Gmail's sublabel Show/Hide controls message badges;
top-level label-list visibility governs the main sidebar. Individual sublabel
sidebar hiding is therefore explicitly identified as Gmail Pro behavior.

### Deployment and remaining limits

The installed unpacked extension was verified in Chrome as Gmail Pro **0.9.36**,
extension ID `kkddeggjgdhlihdkingjkmahonjipcfd`, loaded from
`/Users/rmunoz/Documents/GmailPro`. Production files were copied from this
workspace and reloaded through Chrome's extension controls. Backups of the
previous loaded files are retained in `/private/tmp/gmail-pro-labels-0.9.35`.

- The bridge currently recognizes the inspected English Gmail controls. Gmail
  redesigns or localization can require selector updates; unsupported controls
  fail closed and leave Gmail's native editor available.
- A real Chrome restart, cross-device Chrome Sync, screen-reader certification,
  and a multi-hour soak remain unperformed. Reload persistence, keyboard/native
  editor behavior, native Hide/Show/unread visibility, and message assignments
  were verified as described above.
- Native message-to-label dragging and More behavior were regression-tested
  synthetically; this release does not claim a new live message-drop check.
- Paths are Gmail navigation names, not immutable label IDs. External renames
  receive new paths; hidden-path remapping covers only confirmed moves initiated
  through this organizer. Visual order keeps its existing preference behavior;
  custom sidebar hiding is scoped to the verified Gmail account.
