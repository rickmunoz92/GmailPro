# Gmail Pro film

`shots.json` owns the camera choreography. Each move has `at`, `duration`, `ease`, optional `from`, and a `to` pose with `x/y/z/rotationX/rotationY/rotationZ`. Positive z dollies toward the camera; rotations are degrees. The stage uses real CSS3D perspective and separate UI planes. Global `intensity` multiplies camera pose values; `perspective`, `depth` and motion-blur `shutter` tune the feel.

1. Edit shots.json (or build-film.py for the illustrative UI/actions).
2. Run `python3 build-film.py` to regenerate the six editable scene files and local camera config.
3. `npm run check` then `npx hyperframes snapshot --review`.
4. `npx hyperframes preview --background` for Studio.
5. `npm run render -- --quality delivery --output ../brag.mp4`.

All dependencies/assets are local, except the pinned Hyperframes CLI. FFmpeg/ffprobe are project-local in .hyperframes/bin. Native motion blur follows the authored paths; it does not apply a color grade to product pixels. The 24-second film is deterministic and seekable. All message content is fictional; interactive close-ups are illustrative, alongside the real approved product captures. See ../CREDITS.md for music/SFX attribution.
