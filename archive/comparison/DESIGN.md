# What carries over, what changes

Reviewed against ClearFrame commit `d7addde` and FFFrames
[`bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b`](https://github.com/dmtrKovalenko/fframes/tree/bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b)
on 2026-09-28. This is an implementation experiment, not an adoption decision.

## The useful separation already exists

ClearFrame's strongest pieces are independent of the browser: the script and sources in
`storyboard.json`, the cached Google media generators, measured narration, timing/captions,
and the audio mix. The browser owns scene mounting, layout, drawing, animation and visual
diagnostics. Replace that layer first. Moving providers into Rust would make it harder to
tell whether an improvement came from the renderer, a different voice take or a new mix.

The two paths are therefore:

| Layer | Existing JavaScript path | FFFrames experiment |
|---|---|---|
| Brief/script/source facts | Shared ClearFrame skills + storyboard | Same |
| Voice/music/images/footage | Existing Google scripts, cached output files | Same generation path; native placement must be authored |
| Word/beat timing | `computeTiming` | Export the exact result; no independent duration guesses |
| Visual authoring | DOM/SVG/Canvas + GSAP; 33 blocks | Native Rust `Video` / `Scene` and `svgr!`; two starter layouts |
| Frame state | Seek one paused master timeline | Compute from frame time; monotonic easing with no mutable clock |
| Rasterization | Headless Chrome screenshots | Skia/Metal; explicit CPU fallback experiment |
| Encode | Installed ffmpeg process | FFFrames/libav and the selected libx264 encoder |
| Sound finishing | ClearFrame `mix`/`mux` | Same WAV and mux, once per frozen input set |
| Review | DOM QA, stills, contact sheet | Upstream inspect, frames, strip, plus human/agent review |

## Skill-by-skill analysis

| Existing skill | Keep | Translate or constrain |
|---|---|---|
| `clearframe` director | Brief → argument → storyboard → sound → build → look → render | Route before build. JS `sheet/check/render` are not native verification. For evaluation, draft narration is explicitly sufficient; no automatic paid "final" generation. |
| `clearframe-script` | Narrative structures, short spoken lines, landing words, measured pauses | Replace `b.say()` with exported absolute word times converted to local scene time. No missing-word fallback in the bridge. |
| `clearframe-motion` | Editorial hierarchy, meaningful accent, readable holds, restrained movement | CSS variables, selectors, GSAP eases and camera helpers become explicit SVG values/functions. Keep house rules over upstream's spring/glow defaults. |
| `clearframe-dataviz` | Zero baselines, common scales, source/period labels, units, exact final values | Rebuild native geometry. A Rust chart must read the same data, not copy numbers by memory. Starter bars are explicitly hours, nonnegative and at most three. |
| `clearframe-library` | Menu of visual ideas, recipes, rhythm and when a bespoke scene is warranted | The 33 block names and props are JS contracts. There is no native block parity. Choose a small explicit native map and fail unsupported features. |
| `clearframe-engine` | Storyboard loading, audio metadata, timing/captions, budget planning | DOM mounting, `CF.kit`, CSS layout, `__CF.seek`, onFrame, browser preview and QA are not reusable native APIs. |
| `clearframe-integrity` | Grounded facts, balanced claims, readable disclosures, voice/media provenance | Replace DOM errors with native diagnostics plus visual review; native inspect does not measure box overflow or truthfulness. Sidecar captions are shared; burned captions need native layout. |
| `gemini-tts` | Existing requests, exact transcript/style separation, per-line cached WAVs | Generate once, reuse bytes. Do not give the rendering process the Google key. |
| `lyria-music` | Chapter-based score direction, cached bed, common ducking/normalization | Mix once externally; do not compare different automatic gain/ducking algorithms. |
| `gemini-image` | Textures/illustrations only, never facts or text | Native raster-image placement needs its own implementation and fixture. |
| `veo-video` | Sparse non-informational footage, same authorized cached clip | Native clip timing, crop and decode fidelity require separate tests; ignore embedded audio unless intentionally included in the shared mix. |

The upstream [FFFrames skill](https://github.com/dmtrKovalenko/fframes/blob/bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b/skills/fframes-video/SKILL.md)
is valuable for API shape, diagnostics and render commands. Its recommended generator,
moving-main installation, native-player dependency and maximum-performance defaults are
not adopted wholesale. This repo uses a fixed revision and bounded local resources.

## Differences that can invalidate a comparison

**Timing is measured, alignment is approximate.** Existing `alignWords` distributes words
across detected speech segments using punctuation/syllable weighting; it is not a forced
alignment model. `estimated: false` means a matching recording exists, not that every word
boundary was recognized acoustically. Sharing its output controls the experiment; it does
not validate lip/word synchronization. Listen to the landing words.

**Runtime state is different.** JS eases named `power2.out` are cubic, whereas the native
starter uses the same cubic equation explicitly. An FFFrames `EaseOut` or spring is not
assumed equivalent. Integer beat boundaries use `Duration::Frames`, avoiding repeated
seconds-to-frames rounding. The starter rejects narration that crosses a beat and extra
outro time instead of silently trimming them. Authored J/L cuts need a separate design.

**CSS typography is not native SVG typography.** Font bytes, family, weight, line breaks,
layout bounds and optical sizing matter. The paired fixture ships one TTF and specifies
the same geometry; font shaping/variable axes/rasterization may still differ and need PNG
review. It does not reproduce every ClearFrame house font or responsive layout.

**Diagnostics have different coverage.** ClearFrame checks DOM overflow, safe areas,
text size, narration pacing, missing sources, dead air and stray animation. FFFrames checks
SVG/font/media faults and off-canvas content. A clean native inspect is not a replacement
for those semantic checks. Inspect scene boundaries and at least entering/settled/leaving
frames. The starter's supported text lengths reduce obvious problems but are not a font
measurement or a guarantee that every string fits.

**Encoding is part of the pipeline.** Matching libx264 CRF/preset does not match libav
versions, chroma conversion, Chrome JPEG capture or color tags. The default JS path has
JPEG capture and explicitly tagged BT.709; native output must be inspected. Reports
preserve the observed metadata. Do not tag pixels with a new colorspace and call it a
conversion. Run a second controlled pixel/encoding test if small quality differences matter.

**Build cost is real work.** FFFrames' warm GPU render may be attractive while a first
Rust/Skia/FFmpeg build and compile errors dominate a short one-off video. Record downloads,
first build, source revision/rebuild, diagnostics, final render and review separately. A
failed build is a workflow outcome, not a missing data point to discard.

## Why this directory is independent

No branch switch or engine migration is needed. Existing examples, blocks, scripts and
Google provider contracts remain where they are. The experiment adds its own CLI, Cargo
template, paired fixture, tests and agent routing. The public root CLI remains unchanged.
Generated bundles/cache are ignored by Git; save a chosen bundle's manifest, Cargo.lock,
source, reports and final artifacts before cleaning it up.

This is trusted local code execution, **not a sandbox**. Copying inputs or removing a
Google key from the benchmark child's environment does not isolate arbitrary authored
Rust/JS. A hosted service would need an isolated render worker with controlled files,
network, credentials, resources and cleanup; that is beyond this local renderer trial.

## Adoption decision

Start with the paired title/chart/ending fixture. If it compiles, looks right and improves
warm renders enough to matter, add a representative native port of `examples/seventy-percent`
(hero number, unit grid, calibration chart, recap), then vertical and real media fixtures.
Evaluate whether the agent spends less total time producing an equally good accepted
video. Keep each framework where evidence supports it; there is no need to choose one
renderer for every kind of film.

