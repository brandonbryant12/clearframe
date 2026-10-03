# Through the chart — exploratory camera study

The user requested a camera travelling along time, weaving in front of and behind rising bars on a flat 2D chart grid, then pulling back to show the complete chart. Feedback rejected the first pace as too fast. The current `reading-hold-v2` timing is 18.5 seconds: 0.5 opening, 10 flight, 3 pullback, 5 full-chart hold, freshly sampled at 24 fps. Labels finish fading at 13.75 seconds, leaving 4.75 seconds fully labeled.

This is a source candidate, **not an accepted or cataloged kit**. Four revised source clips cover both datasets in landscape and portrait. Four native labeled draft MP4s now have sampled visual review and encoded geometry/clock checks. Continuous playback, color fidelity and final acceptance remain open. [Inputs](inputs.json) contain two original fictional data cases. [Direction](DIRECTION.md) retains human feedback. [Camera contract](../../../docs/camera-studies.md) describes the shared version-3 rig.

## Evidence

- `evidence/first-motion` keeps the initial 6.5-second exploratory pass.
- `evidence/full-chart-ending` keeps the nine-second ending revision.
- `evidence/slower-flight-rejected` keeps a mechanically passing 16-second attempt that looked into empty space before its pullback. It was rejected on picture review.
- `media/reserve-path-landscape` holds the corrected slower pass, exact source, Blender scene, receipt and baked geometry checks. This original 16-second evidence remains intact.

The pure camera rig checks bar envelopes continuously. The shared scene selects a clear horizontal grid corridor and expands its backdrop to enclose the camera. The saved-scene checker examines every baked frame plus the endpoint for camera/mesh clearance, zero baselines, final heights, ending projection and out-of-order seeking. These checks do not establish subjective motion quality or unobscured intermediate chart views.

## Reproduce

Use a fresh output location and at least 20 GiB free. The builder refuses to overwrite existing source evidence; retain or move prior output before preparing a revision. From the repository root:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/graph-flight-study/build-media.mjs reserve-path-landscape
```

Pass `--revision reading-hold-v2` and explicit names to reproduce the four revised variants: `reserve-path-landscape`, `reserve-path-vertical`, `seasonal-workload-landscape`, `seasonal-workload-vertical`. The helper loads the matching named timing file. Source evidence refuses overwrite; native overlays can be rebuilt independently. At most two Blender/FFmpeg workers run under the shared resource gate. Completed PNG intermediates are pruned only after output/source hashes match the compact copies. No external models, paid generation, borrowed artwork, voice or music are used.

## Prepared native ending

`export-anchors.py` projects the exact retained Blender scene and confirms all 60 ending frames have identical anchors. `build.mjs reserve-path-landscape` verifies source/scene/receipt/exporter hashes, data values, ticks and aspect before compiling editable month, USD and value labels. The axis reads USD; the source fixture uses a 100-dollar multiplier. Labels fade in at 13.5 seconds after the camera settles.

`evidence/native-ending` retains the 15-second native frame and the source-bound check result: 65 sampled frames, no errors or warnings. This is a prepared, still-reviewed overlay; the full labeled encode, reveal/registration checks, portrait and second fixture remain open. The original Blender motion clip is unchanged. No kit or example count increased.

Independent review found no value/unit/alignment errors, but requests a longer fully labeled reading hold and a phone-size readability check. See `evidence/native-ending/REVIEW.md`.

## Longer hold and closed backdrop

`media/reading-hold-v2` retains all four fresh 444-frame source clips, scenes and receipts. Matte blue pigment removes the distracting white reverse-view reflections. The first 18.5-second batch exposed an open backdrop edge in portrait and was rejected; `media/reading-hold/REJECTED.md` preserves that distinction. The corrected stage is a closed convex shell with a rounded ceiling and sufficient far clipping distance.

For every one of 445 baked poses per variant, `check-scene.py` checks the camera and near rectangle inside the closed shell, bounds the shell before the far plane, and performs 25 evaluated stage ray casts. Mesh checks require connected, closed, consistently wound, convex geometry. Each fixture also keeps its ceiling outside the frustum. This covers sampled raster poses without depth of field or motion blur; it does not assert continuous visibility of every bar during the weave. The old open stage fails the new closure check.

`evidence/review-closed-stage` records the independent 48-layout and timing review. `evidence/reading-hold-v2` holds the current native checks and ending stills. `rejected-overlay-v1` keeps the labels rejected for collisions. The current overlay retains full values, reduces landscape label width, moves the first portrait dollar label clear of its nearby tick, and keeps portrait ticks/months on the chart background. Portrait diagnostics still flag the stricter middle-80% title-safe area; all type must be reviewed at phone size and in its destination player. No catalog count increases from these exploratory outputs.

## Native encoded draft evidence

Each `evidence/reading-hold-v2/NAME/native-video.mp4` contains 444 frames at 24 fps, with a 114-frame fully labeled hold. `encoded-checks.json` validates all 3,192 bar-centerline observations across the four endings against input values (largest edge residual 2.304 pixels at draft scale). Grid and bar faces occupy parallel planes at slightly different depths; the checker calibrates their scale from the two common zero baselines, rather than reusing per-bar top anchors. It checks native value/month strings in source and compiled jobs, not OCR.

Nine pre-label source/native samples per draft are consistent with the source clock at those sampled times. They compare spatial alignment after subtracting only a constant RGB offset per channel, and compare adjacent source frames (36 same-time samples and 72 neighbor comparisons total). Near-stationary one-frame ties do not uniquely establish every encoded frame's clock. The raw RGB errors remain recorded. `registration-investigation.json` records the initial color-difference failure and the depth-plane calibration correction; color fidelity is not accepted by the spatial check. QA reports zero one-frame pops, flagged near-bar changes and the intentional five-second hold. `evidence/review-native-motion` records independent encoded samples and 360px ending previews. Sparse edge-on views still need normal-speed human judgment; header/footer bands also obscure portions of the chart during close flight. Only the settled ending is intended for quantitative reading. The full smoke suite passes 218/218; its first sandbox run failed macOS SVG rasterization, then passed outside the sandbox under the same resource gate.
