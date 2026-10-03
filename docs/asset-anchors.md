# Static prepared-asset anchors

`asset-anchors` exports named points and reserved copy rectangles for a verified static range in a prepared Blender asset. The original scene, clip and receipt remain unchanged. Native text and leaders use the exported geometry through `placeAnchors` and `labelInZone` in `engine/lib/asset-anchors.mjs`.

```sh
node engine/cli.mjs asset-anchors examples/library-kits/physical-mechanisms/media/reservoir-landscape \
  --definition examples/library-kits/anchor-studies/definitions/reservoir-landscape.json \
  --out /tmp/reservoir-anchors-new.json --json
```

The command enters the shared heavy-process gate. It requires Blender, an existing ready/baked receipt, matching file hashes and the 20 GiB free-space reserve. The destination must be new. Scene scripts are disabled. Preparation reads the trusted saved scene; it does not render or save it.

## Contract

A definition names render-enabled mesh subjects, object-local anchor points, normalized top-left copy rectangles and padding. `frames: [start, end]` is a zero-based half-open source-frame range. Every included frame is evaluated, including interior frames. Blender frame numbers are source frame numbers plus one.

The exporter verifies dimensions, frame rate, square pixels and an orthographic or perspective camera. Projected evaluated mesh vertices, conservative bounding-box corners, vertex counts, anchors and camera parameters must remain stationary within the declared tolerance. Clipped or out-of-frame subjects are rejected. Copy rectangles must clear every projected subject box plus padding. Bounds are conservative geometry bounds, not alpha masks: shadows, blur, transparency and occlusion are not assessed. Face/edge connectivity and material animation are not compared.

The manifest binds the scene, clip, receipt, definition and exporter. `verifyAnchorSource` checks the actual files again before use. `placeAnchors` maps the points, bounds and rectangles through a centered `contain` or `cover` placement. It reports cropped points and rectangles. `labelInZone` requires the entire requested label rectangle to fit a fully visible copy region. Numeric underflow or unrepresentable destinations are rejected.

These helpers do not measure glyphs, fit copy, solve collisions, detect visibility or track moving labels. Native layout checks and encoded visual review remain required. Changing camera, geometry, source pixels or framing requires a fresh export and review. The range applies only to the held source pose; it says nothing about earlier moving frames.

## Retained examples

[Anchor studies](../examples/library-kits/anchor-studies/README.md) reuses the original reservoir and conveyor assets in four editorial cases, each independently composed for landscape and vertical. Eight seconds of source motion lead to a twenty-second native annotation hold. The explicitly looped hold clip contains 48 identical lossless frames matching source frame 191; the action clip is not looped.

This is the partial static branch of T03. Per-frame tracking, occlusion intervals, arbitrary cross-renderer camera matching, square/4:5 layouts, subjective continuous playback and final master acceptance remain open.
