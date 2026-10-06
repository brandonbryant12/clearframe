---
name: clearframe-engine
description: Author, validate and render ClearFrame storyboard.json projects with the scene engine (Skia on Metal, the only renderer). Use for timing, native block props, importing speech, media assets, captions, diagnostics and delivery.
---

# Engine contract

Read `README.md`, `docs/style.md` and the schema at `schema/storyboard.schema.json`. The shared Node layer owns project loading, media generation, timing and audio. `film/production.mjs` prepares a version 2 block job and `scene/compile.mjs` the scene plan (`build/native/plan.json`); `scene/engine.mjs` builds and runs the renderer. Native GPU stages (`stage` block, beat `stage`, film `stages`): `skills/clearframe-scene/SKILL.md`.

`start DIR --idea ... --document ... --brand ...` gathers portable inputs (see `docs/intake.md`), writes evidence and brand briefs, copies assets unchanged and records hashes. It creates a starter for the directing agent to rewrite, not a finished film. No paid calls run.

A project needs `storyboard.json` with a nonempty `beats` array. Each beat has a unique slug `id`, supported `block`, validated `props`, optional `vo`, `chapter`, `transition`, `exit` (default `auto`: mirror the next entrance), duration/pacing and sfx, plus the layer fields `plate`, `tone`, `camera` and `art` (see `docs/canvas.md`). The film may set `texture`. Generated assets have slug IDs; local image/clip assets can use `file`. Numeric blocks require a visible `props.source` and `sources` entry. See `clearframe blocks NAME` for current props.

By default, beat length follows lead + recorded/estimated voice + block tail. Forced duration must not clip narration. Cues (`land`, `growSay`, `drawSay`, item `say`, bar `focus.say`, and canvas/art `say`, `exitSay`, `keys[].say`, `along.say`) use exact words/phrases or local seconds. Missing spoken cues fail. Recorded audio does not imply measured word times: see `docs/speech.md`.

`check` warns when the first staged item arrives late under narration even if the block cue is early, and when stroked rect/circle/ellipse shapes omit `fill`. Keep spoken data cues intact by establishing a plate or art at `at: 0`, `enter: "none"`; use `fill: "none"` for outlines.

`check` also fails when a beat ends before its counters and bars reach their final values (drafts warn), when staged items are cued too late to finish, and when displayed text uses characters the bundled fonts cannot draw (it names the character and prop).

```sh
node engine/cli.mjs new film --playbook decision-memo --theme signal
node engine/cli.mjs voice film --draft
node engine/cli.mjs timing film
node engine/cli.mjs sheet film --draft
node engine/cli.mjs still film --beat compare --pos 0.7 --grid --draft   # --grid: coordinates for art
node engine/cli.mjs sketch route --vertical                             # canvas starting points
node engine/cli.mjs check film --draft
node engine/cli.mjs looks film --beat compare --draft
node engine/cli.mjs render film --draft
node engine/cli.mjs review film
node engine/cli.mjs qa film            # time bugs, export tags, loudness, timeline + phone sheets
node engine/cli.mjs beatmap film       # tempo, measured drop, cuts against the beat grid
node engine/cli.mjs draft film --rough # first full-length look: placeholders as slates (docs/editing.md)
node engine/cli.mjs preview film --beats compare --handles 2   # one stretch of the full timeline
node engine/cli.mjs diff film r002     # what changed since a revision: content, appearance, timing
node engine/cli.mjs runlog film        # measured command and phase times
```

Review state lives in `DIR/review/` (`docs/editing.md`): every full render saves a revision (inputs preserved by content in `review/objects/`), `note`/`notes` anchor feedback to the revision watched, `revise` makes a candidate with before/after passages, `accept`/`reject` record a person's verdict (`decide` an agent's), `restore` brings back a revision after saving the current state, `keep` pins voice, words, facts, picture or look. Recorded narration is edited with `cut`/`uncut`/`split`/`merge`, rebuilt from `source/recording.wav`; never by editing `vo`.

`preview` (or `render --draft`) produces a review MP4 with a fast encoder (x264 veryfast, CRF 21). Optional `--scale 0.25–1` reduces raster size while retaining authored layout, frame count and audio timing; default 1 keeps full size. `draft --scale 0.5` passes the scale to its MP4. Final renders reject reduced scale. Receipts and QA distinguish authored and encoded dimensions. `--rough` is a draft for the first review: beats with `placeholder` (and generated assets not made yet) render as labelled slates, canvas/art elements marked `unfinished` render as drawn, and only frame-audit findings about that declared text are listed as craft instead of failing; every other check still fails, and outside `--rough` both are errors. `preview --beats|--range|--note|--chapter` renders a stretch of the full prepared timeline with the full mix's audio and checks its clock against frames drawn directly. `qa` decodes the finished MP4 and fails on a one-frame pop; it warns where the picture barely changes for 2.5 s or more under the voice, where a world's invisible cut jumps, where the export is untagged or off its loudness, and where the drop is not heard where `music.drop` placed it (`--loop` also measures a loop's seam). The final mux tags BT.709 primaries and transfer, the BT.601 matrix the encoder uses, TV range and square pixels, losslessly. `music.drop: {beat, at, song}` starts the track so its drop (measured by `beatmap`, or `song` seconds) plays at that beat's start or cue; a negative offset delays the song. `captions` writes SRT/VTT. `plan` estimates generation and cache state. `voice`, `music`, `images`, `clips` perform explicit generation; use `--only`, `--budget` and `--force` deliberately. `speech` imports an audio/transcript pair; `align --words` imports measured offsets; `align --transcribe` calls Gemini transcription.

For a full 1080p final, give the calling shell/harness at least **300,000 ms (five minutes)** for rendering and audio finishing; longer films may need more. This is an external harness allowance, not a CLI flag or a render duration cap. With a session-based executor, yield and resume the same running process instead of restarting it at 120 seconds. Keep progress updates under a minute apart.

Compilation, retained pipelines and optional sculpture asset passes automatically enter or inherit the heavy gate. On this 8 GB Mac, run full renders and full test suites through `/Users/brandon/.local/bin/codex-heavy -- <command>` as well; when wrapping a render, pass `env CLEARFRAME_HEAVY_HELD=1` after `--` to avoid a nested build lock. Keep at least 20 GiB free for expensive work.

Compilation uses one Cargo job and names the lock holder while waiting. Small checks can run directly. No browser or npm runtime dependencies are required.

`pipeline DIR [--draft] [--scale 0.5] [--no-render] [--json]` runs a retained production pass: critique, optional free draft narration, check, matching sheet, encode, QA and boundary review. It automatically enters/inherits the local heavy gate. Each run gets `build/pipeline/<run-id>/` with timings, inputs, artifacts and an unresolved review queue. `ready-for-review` is not human acceptance. `--no-render` ends at `checked-no-render`. Final mode uses prepared inputs; no paid provider calls run. See `docs/production.md`.

Outputs: `build/native/job.json`, `build/native/plan.json`, prepared media/manifest, `build/timing.json`, SRT/VTT, review PNGs, `build/video.mp4` and its provenance JSON. Final rendering verifies dimensions, FPS, decoded frames and unchanged inputs. Original media remains in `assets/`. An explicit existing `--out` requires `--force` to overwrite.

Custom visuals belong in the native catalog and Rust renderer; update validation, tests and examples together. There is no legacy JavaScript scene fallback. See the scene skill for native stages and film compositing and the blocks skill (`clearframe-blocks`) for block internals. Native diagnostics cannot replace visual, source and listening review.

Creative starting points: `directions [research|podcast] [--json]`; `new/start/ingest --direction ID`. Explicit playbook/treatment/theme overrides win. Shared custom profiles and their references travel with the project. Audio import styles pictures while preserving recorded source/timing.

Optional 3D assets: read `docs/sculptures.md`, inspect `sculptures`, then use `sculpture ID --draft --still --out NEW-DIR` before a draft motion pass or master. This is a separate Blender asset pass; normal rendering remains native (approved clips also play as stage `video` elements). Keep factual text editable, retain exact source/scene receipts, and reuse the approved clip for copy revisions. Review motion, contact and portrait framing before inclusion.

Native dimensional metrics use `canvas.props.kpi` (`pedestal`, `comparison`, `rail`, `seesaw`, `stack`), expanded by `film/kpis.mjs` into existing native primitives. Values, source, shared scale and bounded `none|reveal|stagger|emphasis` motion remain authored data. Headline values may be signed; other forms require nonnegative values. Rails and stacks require a positive total; seesaws require two comparable values and express qualitative balance. Changing figures never invokes Blender. See `docs/kpi-direction.md` and `examples/dimensional-kpis/`.

For educational video, `canvas.props.teaching` separates question and answer phases with native type and an explanation. Use `choice` or `gap`, readable holds and the source contract in `docs/teaching-sequences.md`. Optional quiz/gap sculptures are one-way clips: retain an unrevealed question poster, align the selected tile with the correct answer, then play the answer reveal once. Review an encoded question frame to ensure it does not leak the answer.
