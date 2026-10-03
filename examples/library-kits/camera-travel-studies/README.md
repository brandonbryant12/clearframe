# Bounded camera travel studies

Two original Blender camera operations, four illustrative subjects and eight separately composed landscape/vertical specimens. Each 18-second clip uses eight seconds of prepared motion followed by a ten-second exact held-frame clip. Editable native captions follow the source phase clock.

- **Inspection orbit:** one 68-degree arc around an unchanged open ceramic assembly. System inspection and methods review demonstrate different explanatory uses.
- **Parallax truck:** equal camera/target translation changes the foreground/rear sightline while geometry stays still. Inspection and reporting metaphors retain the qualification that some occlusion remains.

These are original qualitative constructions. Counts, dimensions, apparent sizes and travel do not encode measured quantities. Portrait truck uses a narrower bench, closer screen spacing and shorter travel so the depth relation stays readable. It is a separate composition, not a crop or a dimensional equivalence claim.

[Inputs](inputs.json), [direction](DIRECTION.md), [native bindings](bindings.json), [camera contract](../../../docs/camera-studies.md), [provenance](SOURCES.md), [independent review](REVIEW.md), [preview](preview.html) and [manifest](kit.json) retain the evidence trail. `media/` holds four clips, baked Blender scenes and exact source receipts. `specimens/` keeps native typography separate from the prepared art.

## Reproduce

Run from the repository root with at least 20 GiB free. The media builder refuses to replace retained evidence; regenerate revised candidates in a fresh location. Only its own PNG intermediates are pruned after verified compact copies.

```sh
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/camera-travel-studies/build-media.mjs --looks
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/camera-travel-studies/build-media.mjs --prune-frames
node examples/library-kits/camera-travel-studies/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/camera-travel-studies/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- node examples/library-kits/camera-travel-studies/check-holds.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/camera-travel-studies/check-registration.py
node examples/library-kits/camera-travel-studies/package.mjs
```

`--resume` reuses a completed but unretained source pass only when its current source and output hashes match. It does not restart an uncertain render or overwrite retained media. Saved scenes reopen with auto-execution disabled. Blender preparation and FFmpeg use at most two workers; the shared resource gate runs one expensive task at a time.

The geometric checker covers every baked frame and shuffled seeks. It compares analytic camera poses, fixed optics, static noncamera geometry and full projected subject bounds. For these supplied truck scenes it checks foreground/rear horizontal displacement against inverse depth. Those checks establish bounded geometry, not universal collision or visibility safety. Saved-scene replay, encoded source/native registration, hold checks and independent decoded phone frames provide separate evidence.

Status: **prototype**. Subjective continuous playback, final master acceptance, square/4:5, arbitrary new scenes and automated collision/occlusion solving remain unverified. New copy, geometry, timing or optics require fresh checks and review.
