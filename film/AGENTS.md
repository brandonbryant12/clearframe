# Film pipeline and block work

`film/` turns a storyboard into the renderer's inputs: the job (`job.mjs`), staged media, voice levels and manifests (`prepare.mjs`), and the finished film, stills and sheets (`render.mjs`). The renderer is `../scene/native`. It draws the inside of every block (`src/blocks/`), native stages and film compositing. Read `../skills/clearframe-blocks/SKILL.md`, `SETUP.md` and `../docs/scene-engine.md`.

- **Supported blocks first.** Prefer supported blocks and JSON props. Extend catalog validation (`catalog.mjs`, `validators.mjs`, `registry.mjs`), native dispatch (`blocks/compositor.rs`), examples and the relevant regression tests together.
- **Shared modules.** `text.rs` (shaping and fitting), `design.rs` (palettes), `motion.rs` (curves and exits), `numbers.rs` (number formatting), `blocks/scenes.rs` (grid, helpers and story blocks), `charts.rs`, `diagrams.rs`, `media.rs`.
- **Ground and content are separate parts.** The compositor draws a beat's ground (tone, plate) and its content separately around native stage layers; `draw_beat(…, part)` and `scenes::PART` select the part.
- **Pure frames.** A beat's frame is a pure function of the requested frame and the prepared inputs. Build it as a `draw::Node` display list from bundled font metrics and prepared media; no browser fallback.
- **Measure text only through `text.rs`** (rustybuzz, bundled fonts). Check wide, narrow and dense variants, source labels and caption reserves. Counters use the tabular `Figures` face.
- **Speech timing.** Word intervals are local to their beat, end-exclusive and ordered. Preserve silence gaps and backward seeking. Never manufacture missing timestamps.
- **Honest numbers.** Numeric animations keep their units and exact final values; chart geometry shares a zero baseline and an explicit domain. Focus opacity and duration are authored values.
- **Entrances.** They play over a persistent background; they are not cross-dissolves between two active scenes.
- **Resources.** Builds and full renders go through codex-heavy: one Cargo job, at most two nested workers, one Metal context. Do not reinstall dependencies or discard the warm cache in `scene/.cache`.
- **Colour.** Output uses BT.601 limited-range conversion with `smpte170m` tags. Keep the tags matching; BT.709 delivery needs a genuine matrix conversion.
- **Verify.** Run the Rust and Node tests, inspect frames and contact sheets, check encoded dimensions, frame rate and decoded frame count, and listen to the shared mix. Report mocks, compilation, visual inspection and paid API execution as separate evidence.
