# Newest-first tooltip regression — 0.9.49

## Root cause and fix

The saved Newest email first switch was ON. The reported 41-message Gmail
conversation exposed a fully identified subject and valid message envelopes,
but Gmail's hidden importance tooltip also contained an `h2` outside the message
list. The existing conversation identity check treated that auxiliary heading as
a second subject, rejected the pane, and left the native oldest-first layout.
The preceding one-click filing feature did not edit this ordering controller.

`headerFor` now excludes headings and lists inside native `role=tooltip` chrome.
The actual subject must still have both thread IDs. Tooltip metadata cannot
substitute for a missing subject or borrow another cached pane's identity.
The existing local scan revisits heading-bearing scaffolds when a tooltip role
arrives late, restoring ordering before paint without polling.

Gmail's chronological DOM, original message nodes, handlers, collapsed groups,
attachments, and inline composers remain owned by Gmail. Pure message lists
continue to use the existing CSS `column-reverse` marker.

## Verification — September 30, 2026

Run `python3 scripts/serve-tests.py` and open fixtures in foreground Chrome,
one at a time. The original controller failed the synthetic 41-message tooltip
regression; the corrected controller passed it.

| Fixture | Result |
| --- | --- |
| `/tests/reverseThreads.html` | 57/57 passed |
| `/tests/reverseThreads.html?appearance=1` | 57/57 passed |
| `/tests/reverseThreads.html?appearance=light` | 57/57 passed |
| `/tests/readingPane.html` | 31/31 passed |
| `/tests/messageZoom.html` | 16/16 passed |
| `/tests/autoRead.html` | 59/59 passed |
| `/tests/labelFiling.html` | 49/49 passed |

All 326 browser checks passed. New coverage includes the 41-message collapsed
thread with a hidden importance heading, delayed tooltip roles, tooltip visibility,
missing real subjects, auxiliary tooltip lists, and one-click filing of another
conversation while the open thread remains newest first. Existing coverage checks
first-frame rendering, new replies, expansion/collapse, cached/staged panes,
navigation, authored-content exclusions, competing styles, disablement, and cleanup.

`node scripts/validate.cjs` passed manifest/resource/icon/syntax/minimal-permission
checks and all 38 Node tests. `git diff --check` passed.
The previous filing release's results remain recorded in `labelFiling-QA.md`;
this table records the additional 0.9.49 validation.

## Rollout

Chrome Details showed version **0.9.49** after Reload from the canonical
`/Users/rmunoz/Documents/GmailPro` folder. Gmail was refreshed and the reported
conversation reopened. Its 41 native message envelopes remained in chronological
DOM order; envelope 40, the latest expanded message, was visually first with the
`reverse` marker and computed `column-reverse` direction. A native tooltip heading
was present during this verification. The conversation was left open.

Native heading metadata and message envelopes remain the compatibility boundary;
unknown or genuinely ambiguous panes retain their native presentation. No new
permissions, dependencies, stored mail state, or message-content processing were
introduced by this fix.
