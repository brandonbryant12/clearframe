---
name: clearframe-blocks
description: Develop and verify the Rust code that draws the inside of ClearFrame's 33 blocks (scene/native/src/blocks) and the shared typography, palette, motion, icon, number and audit modules. Use for block implementation, block typography and layout, plates and footage decoding.
---

# Block internals

Read `film/README.md`, `film/SETUP.md`, `film/DESIGN.md`, `film/AGENTS.md` and `docs/scene-engine.md`. The renderer (`scene/native`, Skia on Metal) draws every block itself: a block builds a display list (`draw::Node`) for its frame and the compositor paints it between the film's own layers. A single storyboard selects blocks; there is no per-film Rust code.

1. Use the root CLI for prepare, check, still, sheet and render. The renderer is built once, then content is passed as runtime JSON. Its sources, `Cargo.lock` and `film/constants.json` set its identity and decide when it rebuilds.
2. Extend catalog metadata and validation and the native code together. Modules under `scene/native/src/`:
   - `text.rs`: rustybuzz shaping with the bundled fonts (Inter family, Instrument Serif, IBM Plex Mono, Architects Daughter, Bebas Neue, DM Serif Display, Playfair Display, Archivo Expanded, Space Grotesk, Big Shoulders Display). It also provides cached bisection fitting, balanced headline wrapping, phrase ranges, `baseline_in`, and `Voice`, the job's resolved type voice (face set, emphasis, case, tracking, leading); `Draw::voice()` reads it. Always measure through it; never estimate widths. `fonts.rs` draws a run as the outlines of the same shaped glyph ids.
   - `design.rs`: palettes (kept identical to `catalog.mjs` by a test), `toned` palettes for colour-blocked scenes (contrast-tested) and colour mixing. `motion.rs`: easing curves, preset entrances, exits and graphic-transition timing, from `film/constants.json` (compiled in by `constants.rs`, the same file the Node scheduler reads). `numbers.rs`: grouping, the true minus sign, atomic sign/prefix/digits/suffix strings and zero baselines. `icons.rs`: the pinned Tabler subset. `audit.rs`: the frame audit over the drawn tree.
   - `draw.rs`: the display list (`group`, `rect`, `circle`, `path`, `text`, `picture`, gradients, `.opacity/.translate/.scale_about/.rotate_about/.clip/.mask/.filter_in/.blend/.id`). It uses SVG semantics: an unset fill is black, transforms wrap outside what a node already has, a clip sits in its group's space. `fx.rs`: filter graphs with SVG meaning (region, linear-light or sRGB).
   - `blocks/scenes.rs`: the layout grid and `Draw` helpers (`fit`, `lines`, `rise`, `pop`, `numeral`, `kicker`, `header`). `story.rs`: headline, number and text blocks, including `rich` mixed-face headlines. `speech.rs`: kinetic modes (including `stack`), captions and the speaker lower third. `compositor.rs`: `render`, layout areas and split plates, the camera, and `scene_motion` with entrances, exits and the panel/iris/whip covers (which use the film's base palette on both sides of the cut).
   - `blocks/canvas*.rs`: author-drawn elements (validation, paint tokens and gradients, entrances, keys, `along`, loops, echo, morph, rough strokes, print, mosaic, solids, meter, spotlight, scramble) and beat `art` layers.
   - `blocks/charts.rs`, `diagrams.rs`, `media.rs`: data graphics, sequences and diagrams, plates (`plate_layer`, treatments) and annotation.

   Inter and the voice families are derived from pinned OFL variable sources by `scene/native/tools/generate-fonts.py` (`uv run --with fonttools python …`), which writes the instances, baked `tnum`/`lnum`, `coverage.json` and `coverage-families.json`. Voice sources are fetched into `film/assets/fonts/source/` on demand, hash-checked and not committed. The instances and their hashes are recorded under `families[].instances` in `provenance.json`; the accent faces are static OFL files from the same revision, under `families[].files`. `job.mjs` checks display text against the voice's own face. Icons come from `fetch-icons.py` and `generate-icons.py`.

   Anything random must be hash-derived from the frame (see `canvas.rs` `noise`): rough boil, scramble and grain seeds are pure functions of time.
3. **Keep frame logic pure, including backward seeks.**
   - Use exact local word intervals and monotonic data interpolation, with no overshoot on values.
   - Chart ranges and baselines must match labels; ticks come from `nice_ticks`. Preserve unit suffixes and authored focus opacity and duration.
   - Skip hidden elements instead of drawing them at zero opacity.
   - If a block counts or stages items, give it `settle`/`staged` rules in `film/registry.mjs` so check can prove the final values are shown.
4. **Media comes only from prepared local assets.** Footage goes through `media.rs`: each open clip is an `ffmpeg` pipe at the drawn size; timing comes from `ffprobe` timestamps, relative to the scene and its explicit source offset; the end is exclusive. Fail on missing or short media; never hide gaps with loops or placeholders.
5. **Honour resource limits:** the codex-heavy gate, one Cargo job, at most two workers anywhere, one Metal context. Keep the warm cache in `scene/.cache` and the disk headroom. Never run competing builds.
6. **Verify:**
   - Run focused Rust tests (`cargo test` in `scene/native`) and the Node contract tests.
   - Run `check`, then render PNGs and open them. Compare against earlier stills with `scripts/engine-parity.mjs --reference`.
   - Verify a real encoded MP4 with audio.
   - Test landscape and vertical; include square and portrait where layout code changes.
7. **Colour and the finished file.** Keep the BT.601 limited-range conversion and its `smpte170m` tags paired; a BT.709 delivery needs real pixel conversion. Footage and generated clips contribute no audio to the shared mix. The raw MP4's timeline is rebuilt from its packets (edit list ignored, timestamps rebased); `verify-native.mjs` keeps a 451-frame regression.

Report evidence precisely:
- Mocked Google calls prove request and response handling, not provider access or actual generated quality.
- Measured timestamp validation proves internal consistency, not flawless recognition.
- This local renderer is not a sandbox for untrusted code.
