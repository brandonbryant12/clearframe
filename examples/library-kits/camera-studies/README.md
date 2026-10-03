# Camera studies

Three camera operations, six illustrative subjects, twelve native landscape/vertical specimens. Open [the local preview](preview.html) to play the retained clips. Status: **prototype**. Continuous subjective playback and finished master acceptance are not established by sampled frames or automated checks.

- `linked-system`: a perspective pullback from one control junction to its connected system.
- `hero-field`: a perspective pullback from a selected marker to a wider illustrative field.
- `focus-depth`: a fixed camera racks focus between a near panel and a deeper structure.

Every specimen is ten seconds: eight seconds of prepared footage plus a two-second explicit final hold. Native subject/title/phase/qualification text remains editable and sharp. Two scenarios per recipe demonstrate reuse without rerendering the geometry. Marker counts, apparent size, focus and motion encode no measurements.

`inputs.json` holds copy, `bindings.json` binds source phases and media hashes to native storyboards, `media/` retains clips and saved Blender scenes with exact sources, and `evidence/` holds output receipts and review. See [direction](DIRECTION.md), [provenance](SOURCES.md), [independent review](REVIEW.md), and [camera contract](../../../docs/camera-studies.md). Landscape and portrait are independent compositions; square and 4:5 need new framing and review.

Reproduce from the repository root, using a new destination for any revised source pass. The shared resource gate allows one expensive operation at a time and source preparation checks for at least 20 GiB free:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/camera-studies/build-media.mjs --prune-frames
node examples/library-kits/camera-studies/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/camera-studies/verify.mjs
node examples/library-kits/camera-studies/check-holds.mjs
node examples/library-kits/camera-studies/check-focus.mjs
/Users/brandon/.local/bin/codex-heavy -- node examples/library-kits/camera-studies/check-optical-guards.mjs
node examples/library-kits/camera-studies/package.mjs
```

The media builder refuses to overwrite retained evidence. Prepared media replay needs the native compositor and bundled fonts; regeneration also needs Blender and FFmpeg. Use the repository's native setup instructions. On this machine the existing warm Skia source build additionally uses `SKIA_SOURCE_DIR`; that local cache is not included in this portable kit.

The pose checker establishes bounded framing and seek determinism, not universal collision or occlusion safety. Optical checks establish a visible focus transfer in these encoded fixtures, not a physical lens simulation. Stable grain on close-up field marker bases/crowns remains a surface-quality item for the master pass. Review arbitrary geometry, copy, duration or aspect changes before use.
