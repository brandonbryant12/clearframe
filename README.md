# ClearFrame

Agent-directed motion graphics rendered natively with **FFFrames**. A film is one `storyboard.json`, recorded speech and optional media. A Rust/SVG renderer draws the type, numbers, charts, diagrams and captions frame by frame; Google models supply speech, music, images and the occasional footage insert.

![Every native block, paper palette](docs/media/blocks.jpg)

## What it makes

- **Motion graphics, not slides.** Every scene can:
  - draw its own art (`canvas`: paths that draw on, markers travelling along routes, echo trails, morphs across cuts, spotlights, meters, hand-drawn pencil strokes);
  - sit on imagery (full or split `plate` with duotone and tint treatments);
  - flood the frame with colour (`tone`) and drift with a slow `camera`;
  - cut with `panel`, `iris` or `whip` transitions that carry one movement across the cut.

  Films take an editorial `frame`, grain and a vignette. See [canvas.md](docs/canvas.md) and [ideas.md](docs/ideas.md).
- **33 native blocks** for evidence and structure: hero type, counters, KPI cards, deltas, bars, lines, waffles, rings, donuts, funnels, area-true magnitudes, steps, timelines, flows, cycles, checklists, annotated screenshots, kinetic type (including poster `stack` type that builds as spoken). `clearframe blocks NAME` prints props and an example.
- **A creative system:**
  - `treatments`: eight art directions (editorial, noir, kinetic, sketchbook, blueprint, audiogram, brand, calm).
  - `sketch`: eight canvas starting compositions.
  - `reference VIDEO`: the cut rhythm, keyframes, palette and motion of a film to borrow from.
  - `critique`: flags deck-like runs, stillness, text density, weak hooks and "and then" story chains.
  - 28 playbooks as starting arcs, including `journey` (one drawing, a travelling camera).
- **From material to film:**
  - `ingest --markdown` turns a research report (or HTML/DOCX/PDF) into an evidence brief of figures, sources, tensions and chart-ready tables.
  - `ingest --audio` turns a podcast or talk into gapless beats with measured word timings, speakers and live meters.
  - The `clearframe-direction` skill walks from brief to story to look to pictures to review.
- **Type:** Inter, Inter Display and tabular figures; Instrument Serif for the italic accent word; IBM Plex Mono for labels and code; Architects Daughter for hand lettering. All are measured with the same shaper that draws them. **14 palettes**, each contrast-checked in every tone.
- **Voice that performs:** continuous chapter takes with a per-beat energy map, two-voice conversations, and word timings measured for free with local Whisper (`align --whisper`). Sound design (`sfx`) lands on visual peaks.
- **Honest numbers:** every figure needs a visible source; counters land on the exact value; `check` refuses what would mislead. See [speech timing](docs/speech.md) and the integrity skill.

## Start

Requires Node 20.10+, Rust 1.88+, FFmpeg/ffprobe and native codecs. Follow [native setup](fframes/SETUP.md) before the first build. There are no npm runtime dependencies and no browser.

```sh
node engine/cli.mjs doctor
node engine/cli.mjs new my-film --playbook data-story --treatment editorial
node engine/cli.mjs critique my-film              # rhythm, density, hook and story links, instantly
node engine/cli.mjs draft my-film                 # draft voice + check + sheet + draft MP4 in one pass
# Replace the illustrative claims in my-film/storyboard.json, then:
node engine/cli.mjs sheet my-film --draft      # contact sheet
node engine/cli.mjs voice my-film --draft      # free local narration
node engine/cli.mjs check my-film --draft      # validation + native diagnostics
node engine/cli.mjs render my-film --draft     # fast review MP4
node engine/cli.mjs render my-film             # final encode
```

Open the contact sheet, then watch and listen to the MP4. `build/video.mp4.json` records input hashes, renderer revision, encoder, audio provenance, output hash and color space. Drafts keep the authored canvas and frame rate, allow provisional voice timing, and use a fast encoder (about 3× faster than the final encode).

## From a document or recording

```sh
node engine/cli.mjs ingest digest --markdown report.md        # BRIEF.md: figures, sources, tensions, tables
node engine/cli.mjs ingest clip --audio episode.wav --words words.json --script script.txt --from 312 --to 358 --vertical
node engine/cli.mjs reference inspiration.mp4                 # REFERENCE.md + keyframe sheet
node engine/cli.mjs align clip --whisper                      # free, local, measured word timings
```

Then follow `skills/clearframe-direction/SKILL.md`: find the question and the turn, pick a treatment, plan a picture per beat, critique, and have a fresh reviewer read the sheet.

## Authoring and review

`storyboard.json` is the single source for scenes, data, palette, motion and cues; the [engine skill](skills/clearframe-engine/SKILL.md) describes the contract and [the style guide](docs/style.md) the design system. Canvases are landscape, vertical, square and portrait at 24/25/30/50/60 fps.

Cue anything to speech: `land`, `growSay`, `drawSay` and per-item `say` take an exact spoken word or phrase. `check` refuses what would mislead or break a film instead of rendering it quietly wrong:

- numbers without a visible source and a `sources` entry, negative bars or scales that do not cover the data;
- beats that end before their counters and bars reach the true values;
- items cued too late to finish entering, text that overflows its box at 14 px;
- speech-following text on estimated timing, or characters the bundled fonts cannot draw.

`looks DIR --beat ID` renders one frame in all eight palettes. `still --beat ID` inspects a moment; `review DIR` decodes the encoded MP4 around every cut and word boundary. Paid commands are explicit: `plan` estimates spend, then `voice`, `music`, `images`, `clips` or `align --transcribe` call Google. Existing recordings and imported timestamps need no API key.

## Development

```sh
/Users/brandon/.local/bin/codex-heavy -- npm test                   # Node contract tests
node engine/cli.mjs build                                            # native renderer (warm cache)
node engine/cli.mjs gallery build/gallery-paper --theme paper
node engine/cli.mjs gallery build/gallery-ink --vertical --theme ink
/Users/brandon/.local/bin/codex-heavy -- node scripts/verify-native.mjs build/native-verification-new
```

`engine/` owns orchestration, timing, generation and audio. `fframes/catalog.mjs` owns block metadata, `validators.mjs` prop validation, `registry.mjs` per-block runtime rules, `constants.json` shared timing, `playbooks.mjs`/`treatments.mjs`/`sketches.mjs` starting points, `job.mjs` storyboard → job, `prepare.mjs`/`render.mjs` media and outputs (re-exported by `production.mjs`). The Rust renderer in `fframes/native/src/` is split into `text` (shaping and fitting), `design` (palettes, tones, backdrops, texture), `motion` (curves, exits), `constants` (shared timing), `scenes` (layout grid and helpers), `story`, `speech`, `compositor` (camera, plates, transitions), `canvas` (author-drawn elements), `charts`, `diagrams` and `media`. `npm run catalog:sync` regenerates the schema, block reference and recipes. The CLI gates expensive work through `codex-heavy` with one Cargo job and bounded workers; keep 20 GiB free with a warm cache, 30 GiB before a cold build.

Fonts are static instances derived from the pinned OFL Inter source (`fframes/native/tools/generate-fonts.py`); icons are 95 MIT Tabler outlines at a pinned revision (`fetch-icons.py`, `generate-icons.py`). The retired HTML/GSAP engine is preserved in [archive/](archive/README.md) for recovery only.

[Changelog](CHANGELOG.md) · [Verification evidence](docs/verification.md) · [GitHub research and reuse policy](docs/research/2026-github-video-patterns.md) · [Migration notes](docs/fframes-migration.md)
