# ClearFrame scorecard

A running, honest assessment. Since 2026-09-30, scores come from an independent reviewer judging the rendered benchmark (`scripts/bench.mjs`), following [review.md](review.md). The builder does not grade itself. The goal is 4.9. The standard is motion-design and film craft, not "a video file came out". Scores are out of 5. Update the scores, evidence and the "next" column whenever a loop lands something.

**Baseline:** 2026-09-30. The evidence is the default output of `new --playbook research-digest --treatment editorial` and `new --playbook data-story --treatment noir`, drafted and read as contact sheets, plus the films made so far.

## The verdict

ClearFrame is excellent plumbing with a slideshow at the end of the pipe. The engine is fast, deterministic, honest about numbers and precise about speech. Out of the box, though, it produces what the user called "a slideshow turned into a video". That is fair: the default structure is a card per line of narration, each card built from empty, held still and cut away.

Cinematic capability exists: worlds, a travelling camera, canvas, mosaic, morphs, 3D wireframes and particles. But all of it is opt-in and costly to author, so films fall back to the cards.

## Scores

"Base" is 2026-09-30 before the cinema loop; "Now" is after it. Scores are for what the defaults and the library produce, not what an expert could hand-build.

| # | Dimension | Base | Now | Evidence now | Next |
|---|---|---|---|---|---|
| 1 | **Continuity**: shots, not slides | 1.5 | 4 | Worlds, match cuts, flash cuts, moving cameras; canvas charts morph across cuts (a number into its bar, a stack into bars), now in the default data story. | Morphs between block types (stat → bars) without rebuilding them in canvas. |
| 2 | **Camera and depth** | 2 | 4.5 | `z` perspective and parallax, `dolly`, rack `focus`, motion blur on camera and element moves, handheld, and a push to a detail on a spoken word. | A camera on world beats that orbits (3D) rather than pans. |
| 3 | **Composition and scale** | 2 | 3.5 | Set pieces are full-bleed; `camera.to` turns any chart into a close-up on its finding. Charts still open as a band in a big room. | Push-ins on more report chart beats by default. |
| 4 | **Motion craft** | 3 | 4 | Set pieces keep moving; fast moves smear; number scenes push in; a silence gives the edit a breath. | Secondary motion on chart blocks during holds. |
| 5 | **Look**: light, lens and grade | 2 | 4 | `lens`: letterbox, grade, bloom, aberration, leaks. `shine`, glow and bokeh from depth of field. | A `lens` on the report treatments too (subtle grade and bloom). |
| 6 | **Imagery** | 2.5 | 4.5 | Generated depth plates (painted far layer, cut-out subject and foreground) put the camera inside painted places; vector set pieces cover abstract and data scenes; anonymous people (`desk`, `crowd`, plate subjects). | A library of reusable plates per brand. |
| 7 | **Editing grammar** | 3 | 3.5 | `flash`, match cuts, silence beats; critique measures rhythm. | Beat-synced cuts on the music. |
| 8 | **Typography** | 3.5 | 4 | Tracked title reveals with light sweeps, poster cards that wrap, type as image. | Masked reveals (type through a shape). |
| 9 | **Sound** | 2.5 | 4 | Cinema cues on picture events; composed music briefed from the edit; any bed gated through silences (−32 dB in the trailer final). | Beat-synced cuts. |
| 10 | **Voice and sync** | 4 | 4 | Unchanged. | Genre reads: trailer, documentary. |
| 11 | **Honesty and data** | 4.5 | 4.5 | Set pieces label sample values; routes say they are illustrative. | Keep it. |
| 12 | **Tooling and review** | 4 | 4.5 | Cinema score from the eight tells; letterbox and flat-depth checks; review strips; a fresh-model authoring test that found nine tool issues. | Run the fresh-model test after every loop. |
| 13 | **Speed and efficiency** | 4 | 4.5 | A 27 s graded final renders in about 85 s; drafts now predict the final (learned voice rates, continuous-take timing); lock-waiting builds no longer rebuild twice; `plan` no longer double-counts take voices. | Cache rendered beats between drafts. |
| 14 | **Library and scale** | 4 | 4.5 | 19 palettes, 15 treatments, 35 playbooks, 19 sketches, all files. | Characters and a sound library. |
| 15 | **Default outcome** | 2 | 4 | All 35 playbooks score 63–100; `ingest` and `new` start from films; a seeded `muse` keeps first drafts from looking alike; `checkpoints` puts a human where it matters. | Another fresh-model test on a report brief. |

**Builder's own estimate: 4.3. Independent review, round 1: 3.1 / 5.** The independent score is the one that counts (see the review log below); the builder's estimate was inflated.

## Why the films read as slides

These are the signatures a viewer notices, in order of damage. `critique` should flag each one.

1. **Card per line.** Each beat is a self-contained layout, and nothing carries over the cut.
2. **Build, then freeze.** Each scene starts empty, assembles in about a second, then sits still while the voice talks.
3. **A heading on every scene.** The top-left title is the deck's slide title.
4. **A locked camera and a flat plane.** No depth, focus or parallax outside worlds.
5. **Small subject, big room.** Content occupies a band in the middle, with no close-ups and no full-bleed.
6. **Same grammar every beat.** The same layout, the same entrance and the same fade.
7. **Screen-flat image.** No light, lens or grade, so it reads as UI rather than film.
8. **Edit set only by the voice.** Every cut sits on a sentence boundary, and there are no montage or hit cuts.

## What industry practice says (the rules this loop adopts)

- **Transitions are the story** (motion design). An object's identity survives the cut: it transforms, it is followed, or the camera moves to it. Material motion calls these container transform and shared axis. Title designers call them match cuts.
- **Three planes** (film and animation staging). Foreground, midground and background, each moving at its own rate. Depth is the cheapest cinematic signal there is.
- **Motivated camera.** Push in on a revelation, pull out for context, and track with motion. Use a slow drift, never a dead lock-off, except as a deliberate beat.
- **Shot-scale variety.** Establishing, then medium, then close-up or insert, then a return. Never five mediums in a row.
- **Hold with life.** Secondary motion, drift, light and particles keep a held frame alive (the 12 principles: follow-through, overlap, secondary action).
- **Light and lens sell reality.** Rim light, bloom, light sweeps, grain, a grade, letterbox and a 180° shutter for motion blur.
- **Rhythm.** Contrast fast against slow. Silence before an impact, a hit on the title, a button at the end. Trailers are built on this.
- **Type as image.** Big, masked, lit and placed in space (Saul Bass, Kyle Cooper, Apple keynotes).

## Next loop

| Priority | Work | Moves |
|---|---|---|
| 1 | **Charts that transform.** A report's headline number morphs into its chart, and one chart into the next, across the cut (shared ids between blocks, not just canvas). | 1, 4 |
| 2 | **A music bed that builds.** Local draft beds that follow the edit: sparse under the setup, building through a montage, cut dead for a silence. | 9, 7 |
| 3 | **Orbiting 3D camera** for worlds and solids, not just pans and dollies. | 2 |
| 4 | **The model's first draft.** A worked example per genre and skill guidance so a model's first storyboard scores 90+ without revision. | 15, 12 |

## Independent review log

Each round, a fresh reviewer scores the benchmark (`scripts/bench.mjs`) against [review.md](review.md). The goal is 4.9.

| Round | Date | Continuity | Camera | Composition | Motion | Look | Imagery | Editing | Type | Sound | Voice | Honesty | Tooling | Speed | Library | Default | **Mean** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 2026-09-30 | 3 | 3 | 2.5 | 3 | 3 | 3 | 3 | 2.5 | 3.5 | 3.5 | 3 | 3.5 | 4 | 3 | 2.5 | **3.1** |
| 2 | 2026-10-01 | 3 | 3 | 2.5 | 3 | 3 | 2.5 | 3 | 2.5 | 3 | 3.5 | 4 | 3.5 | 4.5 | 3.5 | 2.5 | **3.13** |

**Round 1, the five blockers:**
1. **Report defaults read as slides.** A heading on every beat, small charts, dips through empty frames at cuts, one repeated iris, and web pill buttons on end cards.
2. **Broken frames pass every check.**
   - The cold-open title is clipped ("E NIGHT SHI").
   - Letterbox bars slice world labels.
   - Labels sit outside the camera ("OAST").
   - Type is printed over the product.
   - Credits have no names.
3. **Numbers contradict each other** across beats; a figure is captioned as the wrong unit; a "SOURCES ON SCREEN" placeholder appears; a multiplier has no comparator.
4. **Imagery is generic and reused across genres.** Plates are absent from the defaults, and the plated boat floats with no waterline.
5. **Trailer type is timid.** It is small, holds still, has illegible taglines, and films open on near-black frames.

**Round 2: what moved and what did not.**
- **Rose:**
  - Honesty, to 4: one dataset per film, the queueing curve computed from its formula.
  - Library, to 3.5.
  - Speed, to 4.5.
- **Fell:**
  - Imagery, to 2.5: clip-art cars, pentagon houses, blob continents, an icon-like operator, visible artifacts.
  - Sound, to 3: no true drop before the title, sparse generic cues.
- **The five blockers now:**
  1. The report defaults are still one slide skeleton (stat → chart → chart → iris → "X, not Y" card → CTA). Charts should be born from each film's mechanism, and the film should end on a picture.
  2. Kinetic type pages break sentences mid-phrase. Display type is generic; flares and aberration damage it.
  3. Imagery is clip-art level, with artifacts.
  4. Composition, and a vertical cut that is the landscape cut reflowed (type at the frame edges).
  5. Sound and cutting don't drive the film: no real silence, cuts on sentence ends, flash overused.
- **The critique still scored these films 100.** Its score is not evidence of quality.

## Log

- **2026-09-30:** baseline written (2.8 / 5).
- **2026-09-30, loop 1 (cinema):**
  - **Lens:** letterbox, grade, bloom, aberration, leak, handheld and motion blur, film-wide or per beat.
  - **Depth:** `z` perspective with pan parallax, `dolly` fly-throughs, `focus` rack focus, keyed `blur`, and `shine` light sweeps.
  - **Cuts:** a `flash` cut.
  - **Library:**
    - five palettes and treatments for film looks (cinematic, trailer, documentary, keynote, cut paper);
    - five genre playbooks (trailer, cold-open, product-reveal, cinematic-explainer, title-sequence);
    - nine set pieces (void, tunnel, skyline, horizon, title, terrain, landscape, ocean).
  - **Defaults:** treatments name the playbook they suit, so `ingest --treatment cinematic` no longer starts from a deck, and the automatic push-in is now visible.
  - **Critique:** a cinema score from the eight tells. The default data story scores 38; the trailer and cinematic-explainer playbooks score 100.
- **2026-09-30, loop 2 (defaults and sound):**
  - **Report playbooks:** reworked (`research-digest`, `data-story`, `concept-explainer` to 100), with film grammar across the other 21.
  - **Sound:** cinema sound design.
  - **Camera:** a push to a detail on a spoken word, and motion blur on moving elements.
  - **Library:** a `crowd` set piece.
  - **Fix:** `view: "auto"` was read as a camera rect.
  - **Build:** a lock-waiting build now records the hash it actually compiled.
- **2026-09-30, loop 3 (a fresh model's first film):**
  - **Test:** a new session made "The Last Mile" (57 s, one world, a dolly, a panel turn, a silence, a pull-back) from the docs alone. Its verdict: "reads mostly as a film, not slides". Its complaints became fixes:
    - film looks strip pencil strokes;
    - filled shapes lose default outlines;
    - camera-only world beats;
    - honest warnings;
    - documented world timing, parallax and beat lengths.
  - **Library:** lit `shade` solids (product reveals), a `road` set piece, a trailer `pulse` bed that follows the edit, and a `clearframe-cinema` skill.
  - **Critique:** it flags a lens over flat drawings.
- **2026-09-30, loop 4 (a real final, image generation, data continuity):**
  - **First real final:** a Gemini voice measured by Whisper. It exposed drafts timed 1.5× too fast with padding between lines; drafts now learn voice rates and time as continuous takes.
  - **Depth plates:** image generation as a regular tool, about $0.20 a scene.
  - **Charts:** canvas charts that morph across cuts.
  - **Sound:** music briefed from the edit, and silences gated in the mix.
  - **People:** a `desk` set piece and anonymous plate subjects.
  - **Creativity:** a seeded `muse` for unique films.
  - **Collaboration:** one-shot and guided modes with `checkpoints`.
