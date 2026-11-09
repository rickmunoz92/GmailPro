# Gmail Pro — cinematic product film

GOAL: Make the cleaner Gmail workspace feel desirable and make three useful features understandable, then invite Add to Chrome.
OUTPUT: Hyperframes HTML/CSS 3D + deterministic GSAP; 1920×1080, 30fps.
TIME: 24s ×30 =720 frames;109.96BPM≈16.37frames/beat. Three major landings8.74,13.11,19.66.
LOOK: Studio ground#edf2f8, ink#14233e, accent#007aff; final dark studio#11161f and real#23292b UI. Inter700/900 headlines88px tracking−4px; support34px; illustrative message text30–45px. White product sheet1500×703px,14px corners,12px physical edge; soft contact shadow0,38,80px at18%. No grading of captured UI pixels.
OBJECTS: Gmail Pro real three-pane workspace, separately lifted sidebar/list/viewer planes, latest-reply card, message zoom percentage, label drag handles, blue envelope and Chrome CTA. All mail fictional. No abstract technology tunnel or floating unrelated objects.
CAMERA: CSS perspective1800px, transform-style preserve-3d, separate camera carrier and product layers. Actual translateZ dolly from+1110 to−620px; rotationX/Y/Z, asymmetric framing. Shot poses/durations/eases/depth/intensity/shutter live in shots.json. Build with python3 build-film.py. No scale-only imitation of perspective. UI parallax≤60px, rotations≤24°. Native Hyperframes page motion blur on, shutter240°. Short whip exits0.44–0.53s power3.in, long-tail arrival0.65–1.42s expo/power4. No continuous idle drift. Text outside camera holds still.
SHOTS:
0–3.27 macro→angled full workspace; Less clutter/More room; depth reveal then camera push.
3.27–8.19 newest-first action dolly; latest reply settles6.01, result hold, zoom-through.
8.19–12.55 body100→150% scale, toolbar/sidebar unchanged; lands10.37; lateral whip.
12.55–15.29 angled sidebar close-up; Clients dragged before Projects; camera tracks toward Inbox row.
15.29–19.66 “Tap the label. File it away.” Existing Projects badge click, unread dot clears, row leaves, native-style Undo confirmation, dark pullback.
19.66–24 hero dark workspace straightens20.71; title/CTA settled21–24.
BANNED: random spins, bounce, lens flare, particles, invented 10×claims, generic cards-as-slides, title drift, uniform fade-slide intros, personal live mail, gray illegible text. Dark studio explicitly justified by user's references and native dark appearance; no navyvoid with tiny subjects.
QA: view0.4/1.7/4.4/7/8.9/12/13.7/16.7/18.8/21.5/23.7; allseams ±0.08; native full-film review, phone-size type, render motion/sharpness, sound peak/duration, encoded firstposterframe. Run fullcheck includingcontrast. Intentional product-sheet travel/cropping only gets narrow decorative-overflow exemptions; all feature copy must stay readable.
