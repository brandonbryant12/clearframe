---
name: clearframe-engine
description: Author, validate and render ClearFrame storyboard.json projects through the FFFrames CLI. Use for timing, native block props, importing speech, media assets, captions, diagnostics and delivery.
---

# Engine contract

Read `README.md`, `docs/style.md` and the schema at `schema/storyboard.schema.json`. The shared Node layer owns project loading, media generation, timing and audio. `fframes/production.mjs` prepares a version 2 native job and runs the reusable Rust renderer.

A project needs `storyboard.json` with a nonempty `beats` array. Each beat has a unique slug `id`, supported `block`, validated `props`, optional `vo`, `chapter`, `transition`, `exit` (default `auto`: mirror the next entrance), duration/pacing and sfx, plus the layer fields `plate`, `tone`, `camera` and `art` (see `docs/canvas.md`). The film may set `texture`. Generated assets have slug IDs; local image/clip assets can use `file`. Numeric blocks require a visible `props.source` and `sources` entry. See `clearframe blocks NAME` for current props.

By default, beat length follows lead + recorded/estimated voice + block tail. Forced duration must not clip narration. Cues (`land`, `growSay`, `drawSay`, item `say`, bar `focus.say`, and canvas/art `say`, `exitSay`, `keys[].say`, `along.say`) use exact words/phrases or local seconds. Missing spoken cues fail. Recorded audio does not imply measured word times: see `docs/speech.md`.

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

`preview` (or `render --draft`) produces a review MP4 at the authored size with a fast encoder (x264 veryfast, CRF 21, about 3× faster than the final medium/CRF 16 encode). `--rough` is a draft for the first review: beats with `placeholder` (and generated assets not made yet) render as labelled slates, canvas/art elements marked `unfinished` render as drawn, and only frame-audit findings about that declared text are listed as craft instead of failing; every other check still fails, and outside `--rough` both are errors. `preview --beats|--range|--note|--chapter` renders a stretch of the full prepared timeline with the full mix's audio and checks its clock against frames drawn directly. `qa` decodes the finished MP4 and fails on a one-frame pop; it warns where the picture barely changes for 2.5 s or more under the voice, where a world's invisible cut jumps, where the export is untagged or off its loudness, and where the drop is not heard where `music.drop` placed it (`--loop` also measures a loop's seam). The final mux tags BT.709 primaries and transfer, the BT.601 matrix the encoder uses, TV range and square pixels, losslessly. `music.drop: {beat, at, song}` starts the track so its drop (measured by `beatmap`, or `song` seconds) plays at that beat's start or cue; a negative offset delays the song. `captions` writes SRT/VTT. `plan` estimates generation and cache state. `voice`, `music`, `images`, `clips` perform explicit generation; use `--only`, `--budget` and `--force` deliberately. `speech` imports an audio/transcript pair; `align --words` imports measured offsets; `align --transcribe` calls Gemini transcription.

Only compiling the native renderer takes the machine-wide `codex-heavy` lock (one Cargo job); renders, checks, voice and `npm test` run directly. While another job holds the lock, the build names it and waits. Warm builds need 10 GiB free and cold builds 25 GiB (`doctor` warns below 20 GiB). No browser or npm runtime dependencies are required.

Outputs: `build/native/job.json`, prepared media/manifest, `build/timing.json`, SRT/VTT, review PNGs, `build/video.mp4` and its provenance JSON. Final rendering verifies dimensions, FPS, decoded frames and unchanged inputs. Original media remains in `assets/`. An explicit existing `--out` requires `--force` to overwrite.

Custom visuals belong in the native catalog and Rust renderer; update validation, tests and examples together. There is no legacy JavaScript scene fallback. See the FFFrames skill for extending rendering. Native diagnostics cannot replace visual, source and listening review.
