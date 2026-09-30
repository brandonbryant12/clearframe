# ClearFrame scorecard

A running, honest assessment. The standard is motion-design and film craft, not "a video file came out". Scores are out of 5. Update the scores, evidence and the "next" column whenever a loop lands something.

**Baseline:** 2026-09-30. The evidence is the default output of `new --playbook research-digest --treatment editorial` and `new --playbook data-story --treatment noir`, drafted and read as contact sheets, plus the films made so far.

## The verdict

ClearFrame is excellent plumbing with a slideshow at the end of the pipe. The engine is fast, deterministic, honest about numbers and precise about speech. Out of the box, though, it produces what the user called "a slideshow turned into a video". That is fair: the default structure is a card per line of narration, each card built from empty, held still and cut away.

Cinematic capability exists: worlds, a travelling camera, canvas, mosaic, morphs, 3D wireframes and particles. But all of it is opt-in and costly to author, so films fall back to the cards.

## Scores

"Base" is 2026-09-30 before the cinema loop; "Now" is after it. Scores are for what the defaults and the library produce, not what an expert could hand-build.

| # | Dimension | Base | Now | Evidence now | Next |
|---|---|---|---|---|---|
| 1 | **Continuity**: shots, not slides | 1.5 | 3 | Genre playbooks connect shots with worlds, morph match cuts, flash cuts and cuts between moving cameras. The report playbooks still cut card to card. | Rework `data-story` and `research-digest` around continuity. |
| 2 | **Camera and depth** | 2 | 4 | `z` perspective with parallax, `dolly` fly-throughs, rack `focus`, motion blur on moves, handheld. | Motion blur on fast element moves, not just the camera. |
| 3 | **Composition and scale** | 2 | 3 | Set pieces are full-bleed with three planes. Chart blocks still sit small under a heading. | Close camera rects on charts, and full-bleed insert variants of the number blocks. |
| 4 | **Motion craft** | 3 | 3.5 | Set pieces keep moving: loops, particles, drift, beacons, swell. The default push-in is now visible. | Secondary motion on chart blocks during holds. |
| 5 | **Look**: light, lens and grade | 2 | 4 | `lens`: letterbox, grade, bloom, aberration, leaks. `shine`, glow and bokeh from depth of field. | A `lens` on the report treatments too (subtle grade and bloom). |
| 6 | **Imagery** | 2.5 | 3.5 | Horizon, skyline, ocean, tunnel, terrain, data landscape, globe, title, card. | People: simple, honest figures for human stories. |
| 7 | **Editing grammar** | 3 | 3.5 | `flash`, match cuts, silence beats; critique measures rhythm. | Beat-synced cuts on the music. |
| 8 | **Typography** | 3.5 | 4 | Tracked title reveals with light sweeps, poster cards that wrap, type as image. | Masked reveals (type through a shape). |
| 9 | **Sound** | 2.5 | 2.5 | Unchanged: a ducked bed and a few SFX. | Risers into reveals, a hit on flash and title, a drone under silences. |
| 10 | **Voice and sync** | 4 | 4 | Unchanged. | Genre reads: trailer, documentary. |
| 11 | **Honesty and data** | 4.5 | 4.5 | Set pieces label sample values; routes say they are illustrative. | Keep it. |
| 12 | **Tooling and review** | 4 | 4.5 | Cinema score from the eight tells; letterbox text check; review strips caught every fix this loop. | Motion-aware review (frame-to-frame change per beat). |
| 13 | **Speed** | 4 | 4 | A 28 s letterboxed, graded trailer renders in about 20 s. | Keep lens filters on the GPU path. |
| 14 | **Library and scale** | 4 | 4.5 | 19 palettes, 15 treatments, 35 playbooks, 19 sketches, all files. | Characters and a sound library. |
| 15 | **Default outcome** | 2 | 3 | Film looks start from genre playbooks (`ingest --treatment cinematic` → cinematic-explainer, cinema 100). The default report scaffolds still score 38–63. | Bring the report playbooks to 75+. |

**Overall: 2.8 → 3.7 / 5.** The engine can now make films. The remaining gap is the default report path and sound.

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
| 1 | **Report films without slides.** Rework `data-story` and `research-digest`: an establishing set piece, numbers as full-frame inserts, charts in camera rects, lower thirds, a silence before the finding. Aim for a cinema score of 75+ by default. | 1, 3, 15 |
| 2 | **Sound for cinema.** Risers into reveals, a hit on flash and title cuts, a drone under silences, whooshes matched to camera moves. | 9, 7 |
| 3 | **People.** Simple, honest figures (silhouettes, hands, crowds as dots) for human stories. | 6 |
| 4 | **Motion blur on elements** (fast keys and paths), not just the camera. | 2, 4 |

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
