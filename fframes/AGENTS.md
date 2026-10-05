# FFFrames production work

Read `../skills/clearframe-fframes/SKILL.md` and `SETUP.md`. This crate draws the inside of every block. The scene engine (`../scene/`, the default renderer) calls it for each beat as an SVG input layer and composites the film itself; `--engine fframes` still renders whole films with this crate (comparison, recovery). Block changes show in both engines; film-level changes (backdrop, texture, lens, chrome, frame, dissolves) must be made in both `lib.rs`/`design.rs`/`lens.rs` and `../scene/native/src/film.rs`/`compose.rs` until FFFrames retires.

- Prefer supported blocks and JSON props. Extend catalog validation, native dispatch, examples and relevant regression tests together. Modules: `text.rs` (shaping/fitting), `design.rs` (palettes/backdrops), `motion.rs` (curves/exits), `scenes.rs` (grid, helpers, story blocks), `charts.rs`, `diagrams.rs`, `media.rs`.
- Keep `with_part`/`with_text_alpha` (lib.rs) and `scenes::PART`: the scene engine draws a beat's ground (tone, plate) and content separately around native stage layers.
- `render_frame` is a pure function of the requested frame and prepared inputs. Use native SVG trees, bundled font metrics and native media decoding; no browser fallback.
- Measure text only through `text.rs` (rustybuzz, bundled fonts). Check wide, narrow and dense variants, source labels and caption reserves. Counters use the tabular `Figures` face.
- Speech word intervals are local to their beat, end-exclusive and ordered. Preserve silence gaps and backward seeking. Never manufacture missing timestamps.
- Numeric animations retain units and exact final values; chart geometry shares a zero baseline and explicit domain. Focus opacity and duration are authored values.
- Entrances apply over a persistent background; they are not cross-dissolves between two active scenes.
- Builds and full renders use codex-heavy. One Cargo job, at most two nested workers, one Metal pipeline. Do not reinstall dependencies or discard the warm cache casually.
- Color output currently uses upstream SMPTE170M conversion. Keep matching tags; BT709 delivery needs a genuine matrix conversion.
- Run native tests, inspect frames/contact sheets, verify encoded dimensions/FPS/decoded frames and listen to the shared mix. State separate evidence for mocks, compilation, visual inspection and paid API execution.
