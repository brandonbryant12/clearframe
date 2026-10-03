# Through the chart — exploratory camera study

The user requested a camera travelling along time, weaving in front of and behind rising bars on a flat 2D chart grid, then pulling back to show the complete chart. Feedback rejected the first pace as too fast. The current timing is 16 seconds: 0.5 opening, 10 flight, 3 pullback, 2.5 full-chart hold, freshly sampled at 24 fps.

This is a source candidate, **not an accepted or cataloged kit**. Native date/value labels have a prepared landscape ending still; their encoded motion, portrait motion, the second dataset's complete motion, encoded quantitative checks and final continuous playback acceptance remain open. [Inputs](inputs.json) contain two original fictional data cases. [Direction](DIRECTION.md) retains human feedback. [Camera contract](../../../docs/camera-studies.md) describes the shared version-3 rig.

## Evidence

- `evidence/first-motion` keeps the initial 6.5-second exploratory pass.
- `evidence/full-chart-ending` keeps the nine-second ending revision.
- `evidence/slower-flight-rejected` keeps a mechanically passing 16-second attempt that looked into empty space before its pullback. It was rejected on picture review.
- `media/reserve-path-landscape` holds the corrected slower pass, exact source, Blender scene, receipt and baked geometry checks. Other planned variants do not count as rendered examples.

The pure camera rig checks bar envelopes continuously. The shared scene selects a clear horizontal grid corridor and expands its backdrop to enclose the camera. The saved-scene checker examines every baked frame plus the endpoint for camera/mesh clearance, zero baselines, final heights, ending projection and out-of-order seeking. These checks do not establish subjective motion quality or unobscured intermediate chart views.

## Reproduce

Use a fresh output location and at least 20 GiB free. The builder refuses to overwrite existing source evidence; retain or move prior output before preparing a revision. From the repository root:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/graph-flight-study/build-media.mjs reserve-path-landscape
```

The helper has named landscape/vertical variants for both fixtures. They remain planned until rendered and reviewed. At most two Blender/FFmpeg workers run under the shared resource gate. Completed PNG intermediates are pruned only after output/source hashes match the compact copies. No external models, paid generation, borrowed artwork, voice or music are used.

## Prepared native ending

`export-anchors.py` projects the exact retained Blender scene and confirms all 60 ending frames have identical anchors. `build.mjs reserve-path-landscape` verifies source/scene/receipt/exporter hashes, data values, ticks and aspect before compiling editable month, USD and value labels. The axis reads USD; the source fixture uses a 100-dollar multiplier. Labels fade in at 13.5 seconds after the camera settles.

`evidence/native-ending` retains the 15-second native frame and the source-bound check result: 65 sampled frames, no errors or warnings. This is a prepared, still-reviewed overlay; the full labeled encode, reveal/registration checks, portrait and second fixture remain open. The original Blender motion clip is unchanged. No kit or example count increased.

Independent review found no value/unit/alignment errors, but requests a longer fully labeled reading hold and a phone-size readability check. See `evidence/native-ending/REVIEW.md`.
