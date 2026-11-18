# Native message drag pickup — November 17, 2026

The work Gmail window became slow with retained mailbox lists and an open reading
pane. The trace showed repeated native layout/style reads, rather than a long
extension pointer handler. A breakpoint inside Gmail's drop-target discovery loop
confirmed that it measures the inner `.TO` elements. The earlier regression
measured only their `.aim` parents: the parents were collapsed without
`display:none`, but the inner targets still used it. Gmail's size helper therefore
wrote visibility, position and display, read size, then restored those properties
for each hidden target. The work account had 46 such targets.

`labelOrder.css` now gives those targets and their native `.TN` children zero-size
layout boxes without `display:none`. The hidden owner also scales its subtree to
zero so descendant link rectangles retain their original collapsed geometry.
Visibility, focus and hit testing stay disabled. More, organizer reveal and mode
OFF remove the same existing gates and restore the native presentation. No native
drag listeners, thresholds, movement or drop actions were replaced.

`appleMail.css` also qualifies the profiled navigation/scrollbar scope subjects
with their native classes or role. The original scope roots, boundaries,
specificity and scope proximity remain intact. Profiled wrapper, header,
sidebar-width and label-feedback alternatives have separate class subjects. This lets unrelated cached content be rejected earlier.

## Verification

- `node scripts/validate.cjs`: 52/52 passed; manifest/resource/syntax/permissions checks passed.
- `tests/appleMail.html`: 82/82 passed, including native hover/drop paint, modifier
  selection, all six scrollbar roots, authored-content exclusion and mode OFF.
- `tests/messageList.html`: 53/53 passed.
- `tests/labelFiling.html`: 97/97 passed for the existing badge filing flow and its
  cancellation, identity and ownership checks; no work mail was filed.
- `tests/labelOrder.html`: 57/57 passed. The 300-label pickup regression now uses
  `.aim > .TO > .TN` and measures all three boxes and descendant links. Three
  passes reported zero reveal/restore writes (206.5 ms total fixture work).
  Replacement, visibility, account changes and cleanup remain covered. Its CSS
  order now matches production: label rules precede Apple Mail rules.
- Focused header checks: `tests/headerLayout.html?case=More` passed 6/6, and
  `?case=AI%20Inbox%20defaults%20below%20Mailboxes` passed 1/1. These cover collapsed
  inner targets, link geometry, expanding/collapsing More, replacement, cleanup,
  native ownership and AI Inbox placement. The full header suite was not rerun
  against the final change.
- Reloaded the canonical unpacked extension and refreshed standalone work Gmail.
  Revisited All Mail and Sent, returned to Inbox and reopened a previously read
  thread, retaining approximately 9,900 elements and 106 list rows. The final reload retained 107
  rows after a new inbox message arrived. All 46 hidden
  `.TO` targets had non-none display, zero offset dimensions and zero rectangles.
- Repeated three native drags toward the mailbox column, ending over the static
  Mailboxes heading to avoid filing. Cursor and temporary selection were cleared;
  Inbox route and the original appearance settings remained in place.

## Timing evidence and limits

Chrome recordings used no CPU throttling, screenshot capture or CSS selector
statistics for the matched comparison. Recordings stayed in DevTools; no raw work
mailbox trace was exported and no production telemetry was added.

With the same populated work layout, before the inner-target fix the longest
native mouse-out handler took **3,754.676 ms** (one drag). After it, the three
largest corresponding handlers took **112.882, 151.014 and 193.907 ms**. The longest
mouse-move handler in that three-drag recording was **102.813 ms**. This removes
the measured multi-second loop but does not consistently meet the 100 ms target.
Those live numbers precede the final selector expansion; the user still felt a
noticeable delay at that intermediate stage. Handler duration is not a measurement of time from Gmail's native movement
threshold to the first presented drag frame. A no-task-over-50-ms guarantee has
not been established, and an uninterrupted full workday has not been retested.

The separate synthetic CSS comparison at 8,702 elements measured median
cursor/preview work of **51.7 / 54.4 ms** with the old Apple Mail CSS and
**26.3 / 29.0 ms** with the final selectors (mode-ON maxima **34.0 / 42.8 ms**). These were paired in one page,
with the orders reversed and mode-OFF controls; the controls also varied, so
those numbers are diagnostic rather than an end-to-end pickup result. The
fixture Run button was verified usable after completion; repeat runs clear the
retained synthetic panels before growing them again.

After installing the final selectors, closed DevTools and detached the browser
debugging connection without refreshing away the retained work state. A native
pointer drag toward the static Mailboxes heading completed with that connection
off. The user confirmed "Improved, with a small pause" with profiling and browser
debugging disconnected. The work window remains on Inbox with the original
appearance settings. Full-day stability and the 100 ms pickup target remain
unverified. Closed the six synthetic test tabs and three extension-management
pages afterward; no release was published.

## Reproduce the synthetic CSS comparison

Run `python3 scripts/serve-tests.py` and open `/tests/dragStyle.html`. It uses
fictional labels, rows and retained reading shells only; the fixture has no Gmail
connection. The default run grows to roughly 28,000 elements. `?quick` measures
only the intermediate stage.

For a before/after CSS comparison, first save the intended pre-change
`content/appleMail.css` to the ignored `artifacts/appleMail-before.css`, then open
`/tests/dragStyle.html?baseline&quick`. Both sheets are parsed before measurement
and only one is enabled at a time. The baseline file is local test data and is
not included in the extension package. Keep the fixture foreground and avoid
other concurrent tests while measuring.

Suggested commit: `fix: avoid hidden-label remeasurement during native drag pickup`
