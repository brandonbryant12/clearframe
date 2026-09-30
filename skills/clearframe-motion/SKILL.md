---
name: clearframe-motion
description: Design native FFFrames motion, color, typography and scene rhythm — the principles that make a ClearFrame video feel like motion graphics rather than narrated slides. Use for visual variety, pacing, transitions, camera, plates, tones, kinetic type, entrances and cue timing.
---

# Motion that serves the story

Read `docs/style.md` (vocabulary) and `docs/canvas.md` (drawing). The audience and subject set the mood: an energetic explainer, a quiet memory and an analytical report should not feel the same. Keep factual graphics legible and each scene about one visual idea.

## The principles

1. **Motion carries meaning.** Things that connect draw a line; things that grow grow; things that travel move along a path; things that stop being true leave. Pick the verb in the narration and animate that verb.
2. **Stage, then pay off.** Ground first (axis, rule, faint path), subject second, change third, landing on the stressed word (`say`). Viewers read motion before text.
3. **Rhythm is contrast.** Alternate dense and sparse, fast and slow, small and full-frame. Plan a pulse across the film: hook (fast, bold), build (steady), turn (a graphic transition, a `tone` scene), payoff (hold), exit. Three identical scenes in a row are a deck.
4. **The picture never waits for the voice.** Something must be on screen by the first spoken word of every scene: the setting, the ground line, the card a number will count on. Cue the first element to the opening words and save later cues for the payoff. The engine enforces this: a drawing left empty for more than 0.7 s is pulled forward to the first word, and a number card enters with the voice while its count still lands on its word. `check` reports each case. `pace: "hold"` keeps a deliberate wait.
5. **Nothing freezes.** Held frames breathe: the default camera push, a drifting plate, a loop on the subject, ambient `art.under`. Hold still only on purpose, for a hard truth or a quiet moment.
6. **Continuity across cuts.** `panel`, `iris` and `whip` carry one movement across a cut; a `panel` into an accent-`tone` scene becomes the background. Use them at turns in the story, and `cut`/`push` for sequence.
7. **Hierarchy through scale.** One hero per frame, drawn big (poster type, a large numeral, a single word). Supporting text at least a third smaller. Use `align: "center"` and full-frame compositions for statements that deserve the whole frame.
8. **Depth through layers.** Backdrop → plate (drifts) → art under → block → art over → texture. Parallax between plate and content reads as depth; grain and vignette hold dark palettes together.
9. **Type has a voice.** `textMotion` sets how display type arrives: `lines` is calm, `words` is conversational, `letters`/`cascade` shout. Pick one for the film and break it only at the loudest moment.
10. **Vary the frame, not just the content.** A title on top of every scene is a template. Move some titles to a lower third (`heading: bottom`), give some scenes no title at all, centre a few.
11. **Ease like physical things.** `gentle` for editorial calm, `snappy` for social energy, `spring` for friendly play. Values never overshoot; positions may.

## Choosing the treatment

| Moment | Treatment |
|---|---|
| Hook, verdict, turning point | kinetic `stack` with `emphasis`, `statement`/`title` centred with `textMotion: cascade`, `tone: accent`, `burst` sketch |
| A number that must land | `stat` on `tone` or beside a split `plate`; count in step with the voice |
| How something works | `canvas` (route, pipeline, network, balance, orbit) or `flow`/`cycle` |
| Evidence | chart blocks, annotated with `art.over` arrows and circles |
| Place, people, texture of the world | `plate` (full with scrim, or split) with a `duotone`/`tint` treatment so it belongs to the palette |
| Reflection | `quote`, `highlight`, quiet `statement` over `ambient` art, slower motion |

## Timing and cues

`land`, `growSay`, `drawSay`, item/node/pin/phrase `say`, bar `focus.say` and every canvas element's `say`/`keys[].say`/`exitSay` take an exact spoken word or phrase, or local seconds. Cues must exist. Start reveals about 0.1–0.2 s before the stressed word (the engine lands entrances on the word). `check` fails late cues and warns when a graphic transition has no room.

Kinetic modes (highlight, reveal, word, stack) use measured, audio-bound word intervals; final speech-following output rejects estimated or stale alignment. See `docs/speech.md`.

## Look before you render

- `sheet DIR --draft`: the whole film at three moments per beat. Look for runs of similar frames.
- `still DIR --beat ID --pos 0.5 --grid`: coordinates for art and canvas.
- `looks DIR --beat ID`: the same frame in every palette.
- `review DIR`: decoded frames around cuts and word boundaries of the rendered MP4.

Numeric diagnostics cannot establish readable composition or good taste: open the images.
