# Hyperframes Composition Brief: Gmail Pro

Create a 24-second, 1920×1080, 30fps launch video that makes Gmail Pro look
compelling through useful product actions. Voice is disabled. Use music and
restrained motion-matched SFX.

Output: `brag-output/composition/`, final `brag-output/brag.mp4`, poster
`brag-output/brag.jpg`, caption `brag-output/share-copy.txt`.

## Product and sources

Project: `/Users/rmunoz/Documents/GmailPro`.
Read: website/public/index.html, website/public/site.css, README.md,
shared/theme.css, release/store-listing.md, and the existing reading/zoom/label
feature implementations from the current task context.
Use `website/public/assets/gmail-pro-light.jpg`, `gmail-pro-dark.jpg` and
`icons/icon128.png`. These real UI captures have approved fictional content.
Do not use personal inbox screenshots or browser chrome. Recreated interaction
details must be faithful, inert and labelled as an illustrative fictional demo.

## Creative contract

Use the full storyboard in `brag-plan.md`. Strong first two seconds; readable
settled headlines; action-caused transitions; bright brand surfaces and a real
inbox occupying at least 40% of each product shot. Do not turn the film into
five static feature slides or a landing-page scroll.

Verbatim or trimmed grounded copy:
- Less clutter. More room.
- Meet Gmail Pro.
- A desktop-style view of Gmail.
- Latest reply. First.
- Zoom the message. Keep your workspace.
- Your labels. Your order.
- Light. Dark. Yours.
- A cleaner way to use Gmail.
- Add to Chrome.

Identity: #fbfcff / #f8faff ground, #14233e ink, #007aff accent, #23292b native
dark UI. Inter 400/700/900. Headline 76–100px, support 32–42px, UI details
26–34px. No tiny feature paragraphs. No ungrounded speed claims or permanent
free claims. The 80–200% zoom must retain its macOS shortcut qualifier.

## Audio

Copy the bundled `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` into
assets/music/. Credit Sascha Ende, ende.app, CC BY 4.0 in CREDITS/upload metadata;
the excerpt is trimmed and mixed. Cue preset JSON is next to the skill's track.
Use strong locks at 8.74, 13.11 and 19.66 seconds when natural. Music gain 0.30,
fade-in 0.25s, fade-out 1.5s. Choose low-HF-risk CC0 SFX from the brag bundle for
visible clicks and landings, usually 0.35–0.60 gain. No narration or voice ducking.
Use current audio-reactive extraction only if a supported helper exists; otherwise
document the unavailable helper and retain seek-safe beat timing.

## Implementation

Use current Hyperframes conventions and local render. The installed 0.9.25
package consolidates the former core/animation/creative/keyframe domains into
hyperframes references; follow its format, motion, spec, sound and runtime
contracts plus hyperframes-cli. Do not enter another intent interview or generic
promo workflow. /brag already owns this concept and storyboard.

One editable sub-composition per scene. Every timed object has stable identity,
proper clip/timing data and a paused seek-safe timeline. Use local assets and
bundled fonts. Native fit checks and contrast remain enabled. Complete
`npx hyperframes check --json`, snapshot review and final render; no cloud render.

Publishing is explicitly requested by the user: upload the finished public
marketing video to YouTube as an unlisted embeddable host for the Chrome Store,
then add its URL to the existing listing. Preserve all other store settings.

## Current cinematic revision (supersedes flat motion descriptions above)

Follow the updated brag-plan.md and composition/SPEC.md. The user's four image references establish real perspective, spatial layering and deliberate high-energy camera moves. Use the native CSS3D/GSAP camera carrier with configurable shots.json: translateZ dolly, rotationX/Y/Z,1800px perspective,≤60px parallax and native Hyperframes motion blur shutter240. No scale-only imitation. Alternate macro pullback, angled lateral approach, action punch-in, whip, orbit and hero settle. All feature text stays outside the camera and stops while read. The dark studio finale is explicitly justified by the references and product's real dark theme.

Audio-data extraction was attempted with the current Hyperframes helper; numpy was missing. Retain deterministic strong-cue choreography and skip audio-reactive treatment rather than adding dependencies or generic pulsing.

## Included one-click filing action
The user requested tap-the-label filing. It now has a dedicated4.37-second shot15.29–19.66. Tap an existing Projects badge in an unread Inbox row; clear unread status, remove that row, retain its labels and show native-style “Moved to Projects · Undo.” Do not animate a new label assignment or navigation into Projects. The source of truth is README.md one-click label filing and content/readingPane.js. The generic workspace-only shot is removed; the total remains24seconds. See updated brag-plan.md and shots.json for current timing. Native dark appearance is revealed at the end of filing's pullback.
