# ClearFrame scorecard

A running, honest assessment. The standard is motion-design and film craft, not "a video file came out". Scores are out of 5. Update the scores, evidence and the "next" column whenever a loop lands something.

**Baseline:** 2026-09-30. The evidence is the default output of `new --playbook research-digest --treatment editorial` and `new --playbook data-story --treatment noir`, drafted and read as contact sheets, plus the films made so far.

## The verdict

ClearFrame is excellent plumbing with a slideshow at the end of the pipe. The engine is fast, deterministic, honest about numbers and precise about speech. Out of the box, though, it produces what the user called "a slideshow turned into a video". That is fair: the default structure is a card per line of narration, each card built from empty, held still and cut away.

Cinematic capability exists: worlds, a travelling camera, canvas, mosaic, morphs, 3D wireframes and particles. But all of it is opt-in and costly to author, so films fall back to the cards.

## Scores

| # | Dimension | Now | Evidence | What a 5 looks like |
|---|---|---|---|---|
| 1 | **Continuity**: shots, not slides | 1.5 | Every beat is a fresh card that starts empty. Nothing survives a cut except inside canvas worlds. | Elements carry across cuts: a number becomes a bar, which becomes a city. Cuts are motivated: match cuts, cuts on action, camera moves. |
| 2 | **Camera and depth** | 2 | Block scenes are locked off. Worlds travel in 2D. Parallax is one `depth` factor, with no perspective, focus or dolly. | Foreground, midground and background layers. Dolly through space, rack focus to the subject, a handheld drift for intimacy, motivated push-ins on revelations. |
| 3 | **Composition and scale** | 2 | Small subjects in big empty frames (the process chart fills about 15% of the frame). A heading at the top left of every scene. The same grammar every beat. | Shot-scale variety: wide, medium, close and insert. Full-bleed type and objects. Negative space used on purpose, not left over. |
| 4 | **Motion craft** | 3 | Good easing and staggered entrances, and counts land on words. But everything stops after it enters: the second and third frames of most beats are identical. | Overlap, follow-through and secondary motion. Holds keep breathing. Anticipation before big moments. Contrast between fast and slow. |
| 5 | **Look**: light, lens and grade | 2 | Palettes, grain and a vignette. The image is screen-flat: no light, no lens, no grade. | Motivated light (rim, sweep, glow), bloom on highlights, a film grade, letterbox where the genre calls for it, motion blur on fast moves. |
| 6 | **Imagery** | 2.5 | Code-drawn vector shapes, 95 UI icons, mosaic and wireframe solids. No illustration kit, so mechanisms become boxes and arrows. | A kit of set pieces (skylines, horizons, tunnels, terrains, 3D objects, data landscapes) that make worlds quick to build. |
| 7 | **Editing grammar** | 3 | Graphic transitions (panel, iris, whip) and world camera moves. Mostly fades by default. The rhythm is set by the voice only. | Varied shot lengths, montage and smash cuts, J and L cuts, silence before an impact, cuts on the music. |
| 8 | **Typography** | 3.5 | Strong type system (Inter Display, Instrument Serif accent, tabular figures), kinetic modes and cascade. Type is mostly captions and labels. | Type as image: huge, masked, in space, with light passing over it. |
| 9 | **Sound** | 2.5 | A ducked music bed and a few SFX on visual peaks. No risers, hits or silence design, and no beat-synced edits. | A sound design that shapes tension: risers into reveals, a hit on the title, room tone, a button at the end. |
| 10 | **Voice and sync** | 4 | One continuous Gemini take, measured word timings, cues that land on words, and a pacing guard. | Already close. Performance direction per genre (a trailer read versus a documentary read). |
| 11 | **Honesty and data** | 4.5 | A source on every number, check and critique, sample data labelled as such. | Keep it. |
| 12 | **Tooling and review** | 4 | check, critique, sheets, review filmstrips and the fresh-reviewer loop. Review is still of stills, so motion quality is under-judged. | Critique catches slideshow signatures (see below) and scores cinema as well as correctness. |
| 13 | **Speed** | 4 | A 40 s reel renders in about 10 s. A mosaic film takes about 20 s. | Keep it while adding lens effects: budget them per frame. |
| 14 | **Library and scale** | 4 | One file per palette, treatment, sketch and playbook. Project and shared layers. | Cinematic genres represented, not just report formats. |
| 15 | **Default outcome**: what a model makes on the first try | 2 | Playbooks encode report structure (title, stat, chart, callout, endcard), so first drafts are decks. | Genre playbooks that start from shots and set pieces. The easy path produces a film. |

**Overall: 2.8 / 5.** Great bones; the picture layer is the gap.

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

## Plan for this loop (2026-09-30)

| Step | Lands | Moves |
|---|---|---|
| A | **Lens**: film and beat `lens` with letterbox, grade, bloom, aberration, light leak, handheld drift and motion blur on camera moves | 5, 2 |
| B | **Depth**: canvas `z` with true perspective, a camera dolly (fly-through) and rack focus (depth of field on a cue) | 2, 1 |
| C | **Cinematic library**: treatments, genre playbooks (trailer, product reveal, title sequence, cold open, zoom journey) and set-piece sketches | 6, 15, 14 |
| D | **Critique**: slideshow signatures and a cinema score | 12, 15 |
| E | **Showcase films**: built with A to C and reviewed by a fresh reviewer | all |
| F | **3D fills**: lit solids and boxes for product and data scenes | 6, 3 |

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
