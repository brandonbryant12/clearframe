---
name: clearframe-fframes
description: Develop and verify the production FFFrames Rust/SVG renderer used by ClearFrame. Use for native block implementation, media decoding, typography, frame timing, rendering diagnostics and native setup.
---

# Production native renderer

Read `fframes/README.md`, `fframes/SETUP.md`, `fframes/DESIGN.md` and `fframes/AGENTS.md`. All active rendering uses FFFrames. A single storyboard selects native blocks; there is no second scene map or per-film Cargo crate.

1. Use the root CLI for prepare/check/still/sheet/render workflows. Build once, then pass content as runtime JSON. Renderer sources, upstream revision and Cargo.lock determine build cache invalidation.
2. Extend catalog metadata/validation and native code together. Inspect the public upstream API in the pinned checkout rather than assuming browser/SVG-string behavior. Module ownership under `native/src/`:
   - `text.rs`: rustybuzz shaping with the bundled fonts (Inter family, Instrument Serif, IBM Plex Mono, Architects Daughter), cached bisection fitting, balanced headline wrapping, phrase ranges and `baseline_in`. Always measure through it; never estimate widths.
   - `design.rs`: palette presets (kept identical to `catalog.mjs` by a test), `toned` palettes for colour-blocked scenes (contrast-tested), colour mixing, backdrops (`glow`, `paper`), film `texture` (grain, vignette) and the `--grid` guides.
   - `motion.rs`: easing curves, preset entrances, exits, and graphic-transition cover/reveal seconds. `ENTRANCE` and `COVER` in `production.mjs` must match `MotionStyle::duration` and `cover_seconds`/`reveal_seconds`.
   - `scenes.rs`: layout grid, `Draw` helpers (`fit`, `lines`, `rich` mixed-face headlines, `rise`, `pop`, `numeral`, `kicker`, speaker tags), story blocks, kinetic modes including `stack`, and `scene_motion`: camera, plate/tone layers, entrances, exits and the panel/iris/whip covers (which use the film's base palette on both sides of the cut).
   - `canvas.rs`: author-drawn elements (validation, paint tokens and gradients, entrances, keys, `along`, loops, echo, morph, rough strokes, meter, spotlight, scramble) and beat `art` layers. Path data is parsed and re-serialized by kurbo.
   - `charts.rs`, `diagrams.rs`, `media.rs`: data graphics, sequences/diagrams, plates (`plate_layer`, treatments) and annotation. `lib.rs` also draws the film `frame` chrome.
   Inter is derived from the pinned OFL source by `native/tools/generate-fonts.py` (instances, tabular figures, `coverage.json`). The accent faces are static OFL files from the same pinned google/fonts revision, recorded under `families` in `provenance.json` with per-face glyph coverage in `coverage-families.json`, which `production.mjs` checks text against. Icons come from `fetch-icons.py` + `generate-icons.py`.
   Anything random must be hash-derived from the frame (see `canvas.rs` `noise`): rough boil, scramble and grain seeds are pure functions of time.
3. Keep frame logic pure, including backward seeks. Use exact local word intervals and monotonic data interpolation (no overshoot on values). Chart ranges and baselines must match labels; ticks come from `nice_ticks`. Preserve unit suffixes and authored focus opacity/duration. Skip hidden elements instead of drawing them at zero opacity; give every clip path or gradient an id from `Draw::uid`. If a block counts or stages items, add its timing to `settleTime`/`STAGED` in `production.mjs` so check can prove the final values are shown.
4. Load media from prepared local assets. Video decoder timing must be relative to the scene and explicit source offset. Fail on missing/short media; do not hide gaps with loops or placeholders.
5. Honor resource limits: codex-heavy gate, one Cargo job, bounded Make/Ninja/Rayon workers, one Metal pipeline. Retain a warm cache and disk headroom. Never run competing cold builds.
6. Run focused Rust tests and Node contract tests, inspect native diagnostics, render PNGs and open them, then verify a real encoded MP4 with audio. Test landscape and vertical; include square/portrait where layout code changes.
7. Keep the upstream SMPTE170M conversion and tags paired. A BT709 delivery requires real pixel conversion. Strip the native empty audio stream before the shared mix; generated clip audio is excluded. The raw MP4 is remuxed with its edit list ignored and timestamps rebased, because upstream segment concatenation can end the edit list one frame early at some lengths; `verify-native.mjs` keeps a 451-frame regression.

Report evidence precisely. Mocked Google calls prove request/response handling, not provider access or actual generated quality. Measured timestamp validation proves internal consistency, not flawless recognition. This local renderer is not a sandbox for untrusted code.
