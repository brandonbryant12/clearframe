# Original 3D assets, prepared once

ClearFrame can prepare an original Blender scene in the background, bake its motion and retain a video insert. FFFrames composes the final film, including its editable type, evidence, charts and sound. Blender is optional and is not involved in ordinary film rendering or copy revisions.

The eleven recipes use independent geometry, materials and motion. They are useful starting objects, not a finite set of permitted looks. Open the saved `.blend`, change a recipe, or author a new built-in recipe when the story calls for a different object. Palette and seed variations are refinements; a fresh direction should also change the silhouette, material, operation, camera or editorial role.

| Recipe | Material and operation | Best use |
|---|---|---|
| `petal-reveal` | Hinged ceramic shells open around a satin core. | A release, protected detail or staged discovery. |
| `exploded-core` | Machined panels separate along constrained axes around a finned cartridge. | Product internals or a system assembly. |
| `ribbon-thread` | A broad metallic ribbon crosses its own route; small markers travel along it. | A continuous conversation, connected ideas or an editorial motif. |
| `counterweight-mobile` | Articulated brass beams hold ceramic weights on connected wires. | Tradeoffs, attention or balance. |
| `shadow-arcade` | Plaster vaults repeat into perspective under moving raking light. | An architectural opening, a chapter or a change of view. |
| `strata-landform` | Pigmented laminates form a cutaway; the upper layers lift and reveal a contrasting band. | Inspection, hidden layers or a research discovery. |
| `quiz-triptych` | Three identical ceramic tiles; one lifts and holds. | A staged multiple-choice reveal with native question and answer text. |
| `gap-bridge` | A colored insert descends into the missing span and settles. | A fill-in-the-blank answer or completion metaphor. |
| `reserve-gate` | An amber gate lifts between porcelain basins in graphite guides, then holds. | Qualitative access and release conditions; no liquid or amount encoding. |
| `reservoir-transfer` | Transparent chambers, blue analytic fill and an amber gate stage redistribution and isolation. | Qualitative access or tank operation; no measured volume. |
| `conveyor-bypass` | Ceramic packets queue at a narrow neck and travel through an opened alternate route. | Logistics or routing metaphor; no measured throughput. |

All are qualitative visual metaphors. Their dimensions, weights, layer counts and trajectories do not represent measurements. Adapt the geometry to the actual subject before using an assembly as a factual product diagram. Keep evidence and text native.

## Invent a new operation

Start with what changes in the story, then choose a material that makes that change legible. Compare a literal demonstration, an explanatory construction and an editorial metaphor before selecting one. A metal assembly is useful for opening a system; it is a weak default for a personal story. A quiet architectural shadow can be the right chapter image even when the main explanation is native typography.

Built-in sculpture recipes live in `library/sculptures/`: a JSON brief and a same-named Python module. The module exports `build(config)`, creates the scene using Blender and `artkit`, and returns `update(phase, frame)`. `phase` advances from zero through one. Key every animated transform with `artkit.key`; a looping recipe must return to its starting transforms at phase one. Avoid handlers, live randomness, external textures and uncached physics. Use `random.Random(config['seed'])` during construction. The JSON brief names the palette, duration, purpose, copy placement and metaphor limitations. There is no creative-ID registry in the engine to edit.

The catalog is extensible source code. Shared/project libraries remain JSON-only; copying Python into a brand kit will not execute it. If the shot needs a different form, add an original trusted recipe or supply an approved rendered asset instead of trying to force one of these objects to represent it.

## Prepare and revise

```sh
node engine/cli.mjs sculptures
node engine/cli.mjs sculpture petal-reveal --draft --still --out /tmp/petal-look
node engine/cli.mjs sculpture petal-reveal --draft --duration 4 --out /tmp/petal-motion
node engine/cli.mjs sculpture petal-reveal --duration 4 --out /tmp/petal-master
node engine/cli.mjs sculpture petal-reveal --draft --still --vertical --theme vellum --seed 23 --out /tmp/petal-alternative
```

Each destination must be new. `--dry-run` prints the configuration without starting Blender or creating files; `sculptures` also works without Blender installed. `--json` prints a machine-readable receipt. `--pos 0–1` selects the poster or single still phase. `--duration` accepts 1–12 seconds; `--fps` accepts an integer from 12–60. The frame count is rounded from duration × fps, and the actual duration is frames ÷ fps. `--seed N` repeats the same bounded construction; `--seed random` records the chosen seed.

All built-in recipes now expose a [motion phase contract](motion-phases.md). Default timing preserves their original pose clock. `--phase-seconds timing.json` can assign positive durations to every named phase, instead of `--duration`; the renderer retains the exact per-frame pose schedule and checks declared static holds. Phase minimums can reject an otherwise valid overall duration. The gate, quiz and bridge distinguish initial hold, action and final hold; continuous loops expose one complete cycle with no internal safe trim. The separate `planClipRetiming` helper produces an explicit encoded-frame selection plan with protected action and reading-hold checks. It does not render a new clip or change a native storyboard.

Drafts are 960 × 540 with 16 EEVEE samples; masters are 1920 × 1080 with 48 samples. `--vertical` swaps dimensions and uses the recipe's portrait camera. The PNGs use Blender's AgX display transform. MP4 conversion retains the sRGB transfer and tags BT.709 primaries/matrix with limited-range YUV. There is no baked text or audio, no transparent background, and no provider call.

Inspect one still before encoding a clip. The quiz and gap recipes are one-way reveals with an unrevealed default poster; do not loop them in an answer shot. For the quiz, the retained seed selects the tile (`seed % 3`); match the native correct-answer index, and delay the clip until the question hold finishes. Default seed 17 selects the right tile. Review contact points, clipping, negative space and the intended copy region. Then inspect the motion and its loop restart or final settled hold. A closed transform path is useful proof but does not replace watching occlusion, lighting and visual rhythm. Portrait framing is a separate composition check.

Every pass retains `scene.blend`, `poster.png`, exact source copies, configuration, logs and a receipt with hashes and stage timings. A motion pass also retains PNG frames, `clip.mp4` and `asset.json`; `--still` omits those motion outputs. Failures leave a failed receipt. The scene has keyed transforms at every frame, including the next loop endpoint; it can reopen and render with Python auto-execution disabled. The original recipe remains the more convenient source for changing its parameters.

## Use in a film

Copy the approved `clip.mp4` inside the film's `assets/` directory and register it as a clip. Reference it from a video block or a plate, then add native copy. Preserve the source scene and receipt in the asset package. The [feature-launch example](../examples/feature-launch/README.md) demonstrates a short feature story and a copy revision that keeps the prepared 3D media.

The [bundled offline gallery](../examples/sculptures/index.html) contains prepared 1080p clips, posters, baked scenes, source recipes and receipts. It works without Blender. Its videos start only when selected, and starting one pauses the previous video. Rebuild a portable gallery from an asset pass with:

```sh
node scripts/package-sculptures.mjs /path/to/asset-root NEW-GALLERY-DIRECTORY
```

The packager includes known receipt directories present in that asset root, so an older prepared set remains usable as the catalog grows. It refuses empty sets, unknown recipe IDs and changed source or output bytes.

The [research-study kit](../examples/library-kits/research-study/README.md) adds the reserve gate in landscape and vertical with native type. Its source scenes and mechanical checks are retained; subjective continuous playback remains unverified, so it is a prototype. The original eight-asset gallery remains a separate prepared set.

The original render configuration remains as provenance; its output paths describe the original machine. Use `sculpture` with a fresh output directory to regenerate an asset elsewhere. Full PNG sequences remain in the render evidence rather than the compact gallery.

Choose 3D when contact, viewpoint, reflection, occlusion or light explains the shot. Use the [native material studies](art-direction-studies.md) for paper apertures, optical screens and louvers when vector geometry already carries the idea. They render at the film's resolution and remain directly editable in the storyboard.

For measured figures, the [KPI direction guide](kpi-direction.md) covers flat charts, native dimensional forms and their reveal, stagger and emphasis options. Native KPI depth does not require Blender or a rendered insert.

## Select for the actual film

A completed render is a candidate asset. Approve it in the destination composition: its silhouette should read at phone size, highlights should describe the material, contact and clearances should remain plausible, and the camera should leave a deliberate space for copy. Check every moving part at its widest extent. A clean still does not prove a clean loop.

Motion should have a readable preparation, action and settled hold. A question must remain neutral before the answer; a result should stay long enough to read. Avoid constant orbit, rubbery easing on machined parts and repeated reveals under one unchanged claim. For a simple explanatory insert, one controlled operation usually carries more information than several simultaneous movements.

Review the encoded film, including both joins and its delivery crop. Revise weak material contrast, clipped geometry, competing type and conspicuous image boundaries before adding more assets. A polished asset can still be the wrong choice for a particular story. Keep the native version when depth does not improve the explanation; use the original scene when a different object, material or viewpoint is needed.

## Installation and resource limits

Install Blender separately from [the official distribution](https://www.blender.org/download/), or reuse an existing installation. Point `BLENDER_BIN` at its executable if `blender` is not on `PATH`. The adapter has been exercised with Blender 5.2.2 LTS and uses the current EEVEE Python API; older versions may need recipe/API adjustments. See [Blender's command-line documentation](https://docs.blender.org/manual/en/latest/advanced/command_line/index.html). No external models or addon code are bundled.

The CLI uses a clean background startup, disables automatic embedded script execution, and explicitly runs the retained built-in recipe. It does not load project/shared-library Python. Blender and FFmpeg use at most two supported CPU threads. The command enters the local `codex-heavy` gate when available and requires 20 GiB free before rendering. On a small machine, run one render at a time and keep its process session alive. Do not regenerate the scene for a headline revision.

Blender's license and the independent artwork are separate; see [Blender's licensing explanation](https://www.blender.org/about/license/). These original recipe sources and their included procedural artwork follow this repository's license. No third-party model rights are implied.

## Verify retained assets

```sh
# Generate and check the eight draft clips through the public CLI:
npm run verify:sculptures -- /tmp/sculpture-verification
# Check existing asset receipts and reopen their saved scenes:
npm run verify:sculptures -- /tmp/master-verification --assets /path/to/asset-root
# One recipe for a bounded local check:
npm run verify:sculptures -- /tmp/one-sculpture --quick
```

The harness checks retained hashes, poster and video geometry, frame counts, color tags, decoded loop continuity or a settled one-way reveal, and visible movement. It reopens every saved `.blend` with auto-execution disabled and compares the rendered poster pixels with the original. It records both pixel hashes and distinguishes exact equality from bounded EEVEE rounding: at most one 8-bit step in no more than 0.1% of channels. Reports retain failures as well as successful evidence. These are mechanical checks; source truth, useful direction and artistic acceptance remain separate review decisions.

The reservoir-transfer and conveyor-bypass recipes add staged, qualitative physical operations with separate portrait framing. See [physical mechanisms](physical-mechanisms.md) for conserved geometry, contact checks, opt-in camera fitting and retained native examples.
