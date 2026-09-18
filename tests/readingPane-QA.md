# Reading pane and persistent native actions — 0.9.0

Baseline: `bc6aaa9` on `codex/apple-mail-mode`, clean in both local repositories.
Implementation: `feat: refine reading pane and add persistent message actions`.

## Scope and architecture

- CSS compacts Gmail-owned subject/header/avatar wrappers, removes the reading
  Gemini summary and suggested-reply toolbar, and widens the document region.
  It preserves sender/recipient/time/Details/security/attachment controls.
- Native body HTML is neither copied nor modified. The .ii wrapper gets padding
  and horizontal scrolling; arbitrary body typography/colors are untouched.
  Simple messages retain the established readable canvas; no forced darkening.
- The toolbar contains presentation buttons delegating to fresh native controls,
  rather than moved controls or new compose/send logic. Native footer semantics
  are preserved even after newest-first visual ordering and older-message expansion.
- More is the stable insertion anchor. In the inspected Gmail toolbar, this is
  after the Labels/Phish Alert group. No third-party generated class is used.
- Only a fully recognized, visible, fitting replacement enables footer hiding.
  New/unknown native controls, missing toolbar/anchor, and ambiguity fail open to
  native footer presentation. OFF removes injected UI and restores all markers.
- Conversation discovery is shared with reverseThreads; its identity listener
  still works unchanged for Message-only Zoom. The new observer is confined to
  chrome/ancestor nodes and the primary toolbar, not body/editor subtrees.
- No message text, subject, address, signature, attachment or authentication data
  is logged or persisted. No networking or telemetry is added.

## Automated coverage

- Node manifest/security/syntax/settings/lifecycle checks: 21/21.
- New browser suite: 27/27. Covers OFF restoration; hook present/absent; four
  native actions; unavailable Reply All/reaction; disabled actions; native target
  replacement before observer delivery; SPA/main/toolbar rebuilds; empty reading
  pane; unknown controls; newest-first/collapse; warnings/details/attachments;
  authored HTML/table/image/signature/quote preservation; white/dark newsletter
  content; actual message zoom; theme/accent changes; Shift-pop-out delegation;
  native synthetic Reply/Reply All/Forward draft creation with Auto BCC; narrow
  toolbar/resize fallback; body-mutation isolation; route replacement/Back/Forward
  notifications; and missing/restored More anchor.
- Existing browser suites and Apple Mail appearance integrations are also run.
  Final completed results and live validation are recorded below.

Synthetic tests establish extension behavior, not Gmail's undocumented internals.
The new route test uses synthetic view replacement plus popstate notifications;
it is not a claim that every live Gmail route was exercised.

## Native Gmail assumptions and manual checks

The bridge requires an unambiguous visible validated thread, `.iY` shell, primary
`[gh="tm"] [gh="mtb"]` toolbar, accessible English More control, and native
`.ams.bkI/.bkH/.bkG` footer controls. Supported reactions expose “Add reaction.”
The preferred footer is `.btDi4d .amn`; one unambiguous `.gA .amn` is the fallback.
Action correctness follows that native footer, not screen position or guessed
recipient count. To explicitly reply to an older message, use its original
message header/menu unless Gmail has itself retargeted the thread footer.

Manually verify after refreshing Gmail:

1. Compare the supplied email in dark/light themes; check its signature, white
   body, timestamp, recipient Details, and external warning.
2. Open Reply, Reply All and Forward; inspect recipients and Auto BCC before any
   real send. Check Shift-pop-out and discard only the newly created test drafts.
3. Open and dismiss the emoji picker without choosing a reaction; check a message
   whose reactions are disabled and a single-recipient thread without Reply All.
4. Switch conversations rapidly, expand older messages with Newest Email First,
   use message zoom, and test attachment/quoted-history controls.
5. Visit a label, search, Sent and Drafts; try browser Back/Forward, blank-area
   deselection, and a narrow window. Native bottom controls must remain available
   whenever the top replacement cannot be safely established.
6. Turn Apple Mail Mode OFF and confirm Gmail's original reading/bottom controls.


## Completed suite results

Node 21/21; Auto BCC 27/27; Newest Email First 41/41; Message List 20/20;
Label Order 14/14; Message Zoom 16/16; Apple Mail appearance 44/44; popup 14/14;
reading pane 27/27. The Auto BCC, Newest Email First, Label Order and Message Zoom
suites also passed with `?appearance=1` (98 additional checks). Total: 322 checks.
Real browser Enter/Space activation in the synthetic preview invoked the native
Reply/Forward handlers. Synthetic visual preview reviewed with compact header, four top actions, widened
white document surface, retained dark table/signature/quotes, and no bottom bar.

## Live validation status

Before implementation, a separate Gmail tab was used to inspect the exact email
from the comparison screenshots and a ten-message thread. Verified the real
subject/header/body wrappers, summary card, sticky action footer, disabled reaction
case, expanded older message behavior, and native toolbar/Phish Alert arrangement.
Expanding an older message left Gmail's thread-footer target in place; this bridge
intentionally preserves that native behavior.

Live action validation completed on 2026-09-18 with version 0.9.2. Gmail's
positioned toolbar `::before` layer intercepted pointer hits on the initially
unpositioned action group. The group now uses `position: relative; z-index: 0`,
matching native controls above that background without modifying Gmail's layer.
A fixture reproduces the overlay and verifies pointer hits on all four icons
before delegating their clicks. Reading pane checks: 29/29; Node checks: 21/21.

In a separate Gmail tab, all four button centers resolved to their own controls.
Reply All, Reply, and Forward each opened Gmail's native composer. Each newly
created test draft was discarded; no message was sent. Add reaction opened the
native emoji picker, which was dismissed with Escape without choosing a reaction.
No visible composer or picker remained after testing. Version 0.9.1 also verified
avatar/header alignment and full-row unread-dot centering live.



## Changed files and delivery

- `content/appleMail.css`: scoped reading layout and toolbar presentation.
- `content/readingPane.js`: native action delegation and chrome lifecycle.
- `content/gmailSelectors.js`: centralized native-action selectors.
- `content/reverseThreads.js`: shared current-conversation accessor.
- `content/content.js`: start/update/stop integration.
- `manifest.json`: version 0.9.0 and bundled module registration.
- `tests/readingPane.html`, `tests/readingPane.fixture.css`,
  `tests/readingPane.browser.js`: regression and visual/keyboard fixtures.
- `tests/settings.test.cjs`: coordinator lifecycle regression.
- `README.md` and this report: behavior, DOM assumptions and validation limits.

Feature commit: `0dc83a3` — `feat: refine reading pane and add persistent message actions`.
Hardening commit: `0569ec3` — `fix: preserve native actions during toolbar changes`.
Both were pushed to the existing GitHub origin on `codex/apple-mail-mode`, without
force-pushing. The final documentation update follows on that same branch.
