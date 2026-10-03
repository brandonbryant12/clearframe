# Physical mechanisms

Two original procedural objects with four prepared source clips and eight native explanatory examples. Open [the preview](preview.html), [independent review](REVIEW.md) or [hash manifest](kit.json).

| Mechanism | Explanatory uses | Authored operation |
| --- | --- | --- |
| Reservoir transfer | Resource access; tank operation | Gate opens, equal-area levels redistribute, gate closes, state holds. |
| Conveyor bypass | Warehouse routing; network routing metaphor | Packets approach, queue, take an opened alternate route, state holds. |

Each use has landscape and portrait compositions. Copy, phase captions and attribution remain native. The same prepared object supports two subjects; these are not four independent physical models. Fill levels, token count and speed do not encode measured quantities.

**Prototype.** Draft sources and native examples have retained mechanical and sampled visual evidence. Continuous subjective playback and final master acceptance remain unverified. Square and 4:5 compositions are not reviewed.

## Use and reproduce

Copy a specimen, revise its native text and register its local media. An eight-second, non-looping 24 fps source clip is followed by a two-second static clip beat made from decoded source frame 191. Native compositions use 30 fps. Phase captions read the source receipt's resolved timings. The final caption has more than three seconds to read across both beats.

Run from the repository root:

```sh
node examples/library-kits/physical-mechanisms/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/physical-mechanisms/verify.mjs
node examples/library-kits/physical-mechanisms/check-holds.mjs
```

`build.mjs` regenerates all eight storyboards from `inputs.json`, verifies clip hashes and decodes their final frames. `verify.mjs` retains native layout checks, encoded QA, phone/boundary sheets and shuffled-seek equality. `check-holds.mjs` decodes the actual native videos and checks the subject region for a restart or jump into the still hold. Re-review after edits; do not treat old evidence as proof of new inputs.

The optional `build-media.mjs` regenerates Blender sources serially. It needs Blender and FFmpeg, the shared resource gate and at least 20 GiB free. `--prune-frames` removes only newly generated raw intermediates after verifying the retained scene, source, clip and reports. The existing `media/` directories contain portable source copies, scenes and receipts. A baked scene can be reopened without Python auto-execution.

## Evidence and limits

Four source variants retain 772 baked-frame checks, including the extra endpoint in each scene. These verify reservoir volume/floor/gate/stem constraints, conveyor packet/obstacle/gate clearance, and projected bounds in the declared copy-safe region. This is neither a fluid simulation nor a general collision solver. Three scene reloads reproduce the poster exactly; reservoir landscape differs in one color channel by at most 1/255.

`bindings.json` joins source clip hashes, held-image/static-clip hashes, native storyboard hashes and source phase cues. `evidence/` keeps native diagnostics and source geometry/reload reports. `kit.json` hashes the compact package; ignored build directories are reproducible intermediates.

The camera helper fits fixed orthographic framing and preserves view direction. Every-frame bounds verification and encoded visual inspection are still required. This does not implement moving cameras, a universal automatic crop or a quantitative perspective match. See [the technical contract](../../../docs/physical-mechanisms.md), [direction](DIRECTION.md) and [provenance](SOURCES.md).
