# Authoring a ClearFrame film quickly (studio agent)

Short reference for building a first cut without reading every guide. Look up exact props with
`clearframe_catalog` (topic `block`, name `…`): each block has a ready example to copy and adapt.

## The fastest path to a watchable first cut

1. `clearframe_state` once (add `full: true` only if you must see layers).
2. Read the brief and sources (`clearframe_files`). Decide 5–8 scenes: a hook, the mechanism or
   evidence in 3–5 steps, a turn, an ending that lands the takeaway.
3. One `clearframe_edit` batch that replaces the starter: `delete` the sample scenes you will not
   reuse, `insert` new scenes (`block` or `sketch`, `after` an id), then `set` their `props`, `vo`
   (narration), `label` and, for numbers, the film's `sources` (`target: film`, `path: sources`).
   A failed batch writes nothing and tells you why; fix and resend.
4. `clearframe_render` kind `draft` (the rough cut), then `clearframe_job` with `wait: 90` until it
   finishes. Fix any engine errors it lists and render again.
5. Report in a few lines: what the cut shows, which scenes are placeholders, what you need.

## Scene shapes that render well

- Narration-led scenes take their length from `vo` (about 150 words a minute). Silent scenes need
  `duration` (seconds).
- `title`: `{ kicker, text, support }`. `statement`: `{ text, emphasis: ["word"], support }`.
- `stat`: `{ value, suffix, label, context, source }` — every number needs a matching film `sources`
  entry (`{ id, title, date?, url? }`) and its `source` line on screen.
- `kinetic`: words follow the narration; needs `vo`.
- `endcard`: `{ title, support, action }`.
- Drawn mechanisms: insert a `sketch` (`route`, `pipeline`, `orbit`, `balance`, `versus`, `burst`,
  `network`…; `clearframe_catalog` topic `sketches`), then adjust its text elements.
- Mark anything not designed yet with `placeholder: "what it should become"`; the rough cut shows a
  labelled slate instead of sample art. Never leave sample text, numbers or sources.

## Look

Set the film's look in the same batch when it helps: `theme` (a palette id), `type` (a type voice),
`motion.preset`, `transition`; or a `treatment` command for all of them at once
(`clearframe_catalog` topics `palettes`, `types`, `treatments`, `transitions`).

## Sound

Rough cuts record a free local draft voice automatically; a music bed is separate (a free draft bed
with `clearframe_sound` action `draft-music`). Google narration
(Gemini TTS) and music (Lyria) are paid: use `clearframe_sound` to see their state and cost, and to
*request* generation; the person approves the spend in the studio. Never assume approval.
