---
name: clearframe-motion
description: Design native motion, color, typography and scene rhythm — the principles that make a ClearFrame video a film rather than narrated slides. Use for visual variety, pacing, a subject that stays on screen, shot scale, camera, continuity across cuts, transitions, plates, tones, kinetic type, entrances and cue timing, and when a film "looks like slides" or critique reports slideshow tells.
---

# Motion that serves the story

Read `docs/style.md` (vocabulary) and `docs/canvas.md` (drawing). The audience and subject set the mood: an energetic explainer, a quiet memory and an analytical report should not feel the same. Keep factual graphics legible and each scene about one visual idea. These films are sent by companies to employees and clients: they stop being slides because the picture changes with the voice, not because they borrow a film look (there are no letterbox bars, grades, flash cuts or swells in the library).

## Not a slideshow

`critique DIR` names the tells of a slideshow and scores the storyboard out of 100. The score is structural and can be gamed; the real measure is the encoded film (`draft`'s motion verdict: seconds still under the voice) and looking at it. The tells, in the order to fix them:

1. **A card per line.** Nothing carries over the cut. Keep a subject on screen: a `cast` of the film's objects that re-forms beat to beat (`docs/cast.md`), one `world` the camera travels, a film stage, or shared ids that morph.
2. **Build, then freeze.** The scene assembles in a second, then sits while the voice talks. Land each change on its word.
3. **A heading on every scene.** The top-left title is a slide title. Headings mark chapters only.
4. **A locked, flat camera on every beat.** Push to the detail that matters (`camera: {to: [x, y, w, h], say}`), truck through a world.
5. **A small subject in a big room.** A band of content in the middle, never close, never full-bleed.
6. **The same grammar every beat.** The same layout, entrance and cut.
7. **A screen-flat image.** No light on the subject, no texture.
8. **An edit set by the voice alone.** Every cut on a sentence boundary.

Write a shot list in `DIRECTION.md` before the blocks: one line per beat with its **scale** (wide, medium, close, insert), its **camera** (what moves and why) and **the cut** into the next shot. Never three identical scales in a row.

## The principles

1. **Motion carries meaning.** Things that connect draw a line; things that grow grow; things that travel move along a path; things that stop being true leave. Pick the verb in the narration and animate that verb.
2. **Stage, then pay off.** Ground first (axis, rule, faint path), subject second, change third, landing on the stressed word (`say`). Viewers read motion before text.
3. **Rhythm is contrast.** Alternate dense and sparse, fast and slow, small and full-frame. Plan a pulse across the film: hook (fast, bold), build (steady), turn (a `push` or a `tone` scene), payoff (hold), exit. Three identical scenes in a row are a deck.
4. **The picture never waits for the voice.** Something must be on screen by the first spoken word of every scene: the setting, the ground line, the card a number will count on. The engine pulls an empty drawing forward to the first word and reports it in `check`. `pace: "hold"` keeps a deliberate wait.
5. **Motion has a purpose.** Business and technical films use locked cameras while people read (`business` sets the film `camera: "none"`). Reveal nodes, draw connections and remove obsolete components on cues. Deliberate reading holds are valid. Never add wobble or ambient loops to satisfy a score.
6. **Continuity across cuts.** A world move, a cast that re-forms or a match on a shared id cuts invisibly. Mark a chapter with `push` or `panel`; a `panel` into an accent-`tone` scene becomes the background. `cut` and `fade` within a sequence.
7. **Hierarchy through scale.** One hero per frame, drawn big (poster type, a large numeral, a single word). Supporting text at least a third smaller.
8. **Point at the words.** To show what matters in a form, a policy or a screen, put `marks` on the text itself (`highlight`, `underline`, `circle`, `box`, `strike`, `cross`, each on its word); they stay attached through every move.
9. **Type has a voice.** `textMotion` sets how display type arrives: `lines` is calm, `words` is conversational. Pick one for the film.
10. **Vary the frame, not just the content.** Move some titles to a lower third (`heading: bottom`), give some scenes no title at all, centre a few.
11. **Arrive like information, not toys.** `gentle` for editorial calm, `snappy` for brisk energy. A `pop` settles in from slightly smaller and never bounces past its size; values never overshoot. Arrivals are silent unless an element names a `sound`.

## Choosing the picture

| Moment | Picture |
|---|---|
| Hook, verdict, turning point | kinetic `stack` with `emphasis`, `statement` centred, `tone: accent` |
| A number that must land | `stat` on `tone` or beside a split `plate`; count in step with the voice |
| How something works | `canvas` (route, pipeline, network, balance, the workplace sketches) or `flow`/`cycle` |
| Evidence | chart blocks, annotated with `art.over` arrows and circles |
| A document, form or screen | draw it once; `marks` on its words; change it in place |
| Place, people, texture of the world | `plate` (full with scrim, or split) with a `duotone`/`tint` treatment so it belongs to the palette |

## Timing and cues

`land`, `growSay`, `drawSay`, item/node/pin/phrase `say`, bar `focus.say` and every canvas element's `say`/`keys[].say`/`exitSay`/`marks[].say` take an exact spoken word or phrase, or local seconds. Cues must exist. Start reveals about 0.1–0.2 s before the stressed word (the engine lands entrances on the word). `check` fails late cues and warns when a transition has no room.

Kinetic modes (highlight, reveal, word, stack) and captions use measured, audio-bound word intervals; final speech-following output rejects estimated or stale alignment. See `docs/speech.md`.

## Look before you render

- `sheet DIR --draft`: the whole film at three moments per beat. Look for runs of similar frames.
- `still DIR --beat ID --pos 0.5 --grid`: coordinates for art and canvas.
- `review DIR`: decoded frames around cuts and word boundaries of the rendered MP4.
- `qa DIR`: change per second across the whole film (under 2 reads as a held slide), held stretches, one-frame pops, world seams; `timeline.png` (one frame per second) and `phone.png` (360 px).

Numeric diagnostics cannot establish readable composition or good taste: open the images.
