# Gmail Pro — cinematic launch plan

Run: 2026-11-08-133732, full /brag. Landscape1920×1080,30fps,24s; music/SFX on, narration off. The user's updated cinematic direction is the current creative contract.

## Planning rubric
1. Product: a Chrome extension that makes existing Gmail cleaner, with newest-first conversations, message zoom and label tools.
2. Strongest capability: a cleaner workspace with more reading room; enlarge the message while keeping the surrounding workspace fixed.
3. Hook: begin inside the message, then a rapid 3D dolly pullback reveals the whole angled Gmail Pro workspace.
4. Source: real approved light/dark screenshots, layered into sidebar/list/viewer planes; faithful illustrative feature actions using fictional mail.
5. Length:24s, enough for three actions plus a readable hero CTA.
6. Tone: premium, energetic tech commercial; perspective, burst/hold pacing, natural ease and restrained beat sync. The supplied references guide camera/depth, not unrelated visual decoration.
7. Audio: bundled Sascha Ende instrumental, warm low-HF CC0 accents; music attribution included. No narration.
8. Caption: Gmail Pro gives Gmail more room to breathe, with newest replies first, message-only zoom, one-click filing, and labels arranged your way.
9. User flow: cleaner inbox→latest reply→message zoom→custom labels→one-click filing→light-dark→Add to Chrome.

## Creative angle
Treat the interface as a physical product. A true perspective scene with a camera carrier, translateZ dolly, rotationX/Y/Z and separated native UI planes creates depth. Whips and button-focused pushes accelerate; product actions and titles settle into clear holds. No random spinning, bounce, tunnel graphics, invented statistics, AI claims or personal mailbox.

## Storyboard / 24 seconds
- 0–3.27: macro→angled pullback. “Less clutter. More room.” Real workspace and lifted UI planes; push into the thread.
- 3.27–8.19: action punch-in on newest-first control; latest message moves to top and lands6.01. “Latest reply. First.” Readable result hold, then toolbar zoom-through.
- 8.19–12.55: camera straightens; body100→150% lands10.37 while toolbar/sidebar stay fixed. “Zoom the message. Keep your workspace.” / “80–200% · macOS shortcuts.” Lateral whip.
- 12.55–15.29: angled sidebar close-up, Clients drags before Projects. “Your labels. Your order.” Macro transition across the interface.
- 15.29–19.66: “Tap the label. File it away.” Focus on the existing Projects badge on an unread Inbox row. Pointer activates it; unread dot clears and row leaves Inbox. Native-style “Moved to Projects · Undo” confirmation holds as the camera pulls back. The currently viewed different conversation stays put. Final camera retreat reveals real dark appearance.
- 19.66–24: dark workspace straightens and settles20.71. Gmail Pro, “A cleaner way to use Gmail,” Add to Chrome and public site hold21–24.

The filing action preserves the conversation's existing labels; it does not add a new label or open the label mailbox. This matches content/readingPane.js and README.md one-click label filing. UI is illustrative and uses fictional content.

## Motion / music
The 3D rig and per-shot camera poses live in composition/shots.json. Tune intensity, perspective, rotation, dolly, move duration/ease, layer depth and native motion-blur shutter; rebuild with python3 build-film.py. Current Hyperframes0.9.25 supports this natively through seek-safe GSAP and CSS3D. No additional renderer or runtime architecture is needed.
Beat-grid landings6.01/10.37; strong hero lock19.66; other motion follows readability. Preset: Happy Beats & Business Moves Vol12,109.96BPM. Music gain.30,fade-in.25s/fade-out1.5s. Eight sparse action accents≤.55gain. Current Hyperframes audio-data helper failed because numpy is not installed; audio-reactive pulsing omitted, deterministic beat choreography retained.

## Verification and delivery
Full Hyperframes check with contrast enabled; read representative full-res, scene-seam and phone sheets, inspect actual encoded motion and sound metadata. Render localMP4, choose settled poster, bake poster into frame0 and write share-copy. Upload user-authorized unlisted embeddable YouTube host, add its URL to the Chrome Store promo field, and submit updated listing. Preserve previously submitted code, five feature slides, overview, privacy declarations and automatic publication preference.
