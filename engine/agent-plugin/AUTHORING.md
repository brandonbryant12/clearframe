# Authoring a ClearFrame film quickly (studio agent)

Short reference for building a first cut without reading every guide. Look up exact props with
`clearframe_catalog` (topic `block`, name `…`): each block has a ready example to copy and adapt.

## The fastest path to a watchable first cut

1. `clearframe_state` once (add `full: true` only if you must see layers).
2. Read the brief and sources (`clearframe_files`). Before any scene, decide **what the audience
   should see** for this material: the thing the story is about (the pieces of a process, the parts
   of a system, a figure, a product, a place) and what happens to it — a hook, the mechanism or
   evidence in a few steps, a turn, a landing. Where that thing persists, keep it on screen and
   write each scene as a change to it ("the pieces line up", "a note lands and one changes"),
   rather than a new layout per line.
3. If a playbook fits the material better than the starter (`clearframe_catalog` topic `playbooks`:
   each says what it is for, who it is for and what it needs), start from it with
   `{"command":"playbook","id":"…"}` and rewrite its scenes; otherwise build on the starter.
   One `clearframe_edit` batch that replaces the starter: `delete` the sample scenes you will not
   reuse, `insert` new scenes (`block` or `sketch`, `after` an id, and your own `id` so the same
   batch can fill them), then `set` their `props`, `vo` (narration), `label` and, for numbers, the
   film's `sources` (`target: film`, `path: sources`). A failed batch writes nothing and tells you
   why; fix and resend. For example:
   `[{"command":"insert","block":"canvas","after":"title","id":"pile"},
     {"command":"set","target":"beat","beat":"pile","path":"props","value":{"cast":{…}}},
     {"command":"set","target":"beat","beat":"pile","path":"vo","value":"Reports arrive from everywhere."}]`
4. `clearframe_render` kind `draft` (the rough cut), then `clearframe_job` with `wait: 90` until it
   finishes. Fix any engine errors it lists and render again.
5. Report in a few lines: what the cut shows, which scenes are placeholders, what you need.

## Pictures that carry a story

Films made of a fresh layout for every line feel like slideshows. What fixes that is not one shape
but a picture chosen for this source, idea and audience, which changes rather than being replaced.
Pick from what the material actually contains:

- **Things that get sorted, chosen, transformed or replaced** (requests, files, sources, steps,
  features): a **cast**, `canvas` with `props.cast`. A few designed objects (drawn shapes such as
  `doc`, `bubble`, `phone`, `card`, `person`, `ticket` or `box`; icon tiles; or word pills) persist through consecutive scenes and re-form on spoken words: `scatter`, `line`, `ring`,
  `cluster`, `hero` (one steps forward, the rest recede), `swap` (one becomes another in place;
  `by` names what causes it), `merge` (copies fold into one, `into`), `split` (several burst out of
  one, `from`), `travel` (a journey along a drawn route, `to` another object, `via` waypoints), `wave` (a pulse runs through a sequence), `mark` (a pen circle,
  underline, cross or arrow), `camera` (a carried push in or pull back), `exit`. `look: "drawn"`
  draws the cast by hand for explainers and lessons, and `"print"` gives editorial films a press look.
  `fill` grows one object into the whole frame so the next scene — a chart, a figure, a card, a
  stage — plays on its colour, and `emerge` brings it back into the cast later: the cast and the
  film's other pictures share one continuous shot. Declare the objects
  in the first cast scene; later scenes list only formations. Insert a `canvas` scene and `set` its
  whole `props` (path `props`) so none of the sample drawing remains. Consecutive cast scenes cut
  invisibly, and one storyboard serves landscape and vertical. Icon names are in `clearframe_catalog`
  topic `canvas`; the full contract (looks, marks, every move) is `clearframe_guide` topic `cast`.
  ```json
  {"cast": {"objects": [{"id": "report", "icon": "file", "color": "accent", "enter": "none"},
                         {"id": "chart", "icon": "chart-bar", "color": "accent2"}],
            "formations": [{"form": "scatter", "at": 0.3}, {"form": "line", "say": "order", "thread": true}]}}
  ```
  Next scene: `{"cast": {"formations": [{"form": "hero", "hero": "chart", "say": "becomes", "word": "the moment"}]}}`.
- **A system, pipeline or code change**: a film stage, whose actors, links and packets keep their
  identity across scenes (`clearframe_guide` topic `scene`), or a `diagram` whose components morph.
- **A journey, a place or a map**: one world the camera travels (`props.world` shared by
  consecutive canvas scenes).
- **Numbers that move**: charts with the same ids across scenes, a `bridge` from one total to
  another, drivers cued to the words that name them.
- **A mechanism or metaphor**: a `sketch` (`route`, `pipeline`, `orbit`, `balance`, `versus`,
  `burst`, `network`…; `clearframe_catalog` topic `sketches`), then adjust its text elements.
- **A claim, a figure or a quote that deserves silence**: a `statement`, `stat` or `quote` card.
  A run of quiet evidence cards can be right for a sober audience; the problem is cards standing in
  for pictures the material has.

Mix mechanisms where the story turns, and let the audience decide the register: a briefing for
executives can hold steady figures; a walkthrough for new hires wants the thing itself on screen.

- Narration-led scenes take their length from `vo` (about 150 words a minute). Silent scenes need
  `duration` (seconds). Link scenes causally in the narration (but, so, because), not "and then".
- Card props: `title` `{ kicker, text, support }`; `statement` `{ text, emphasis: ["word"], support }`;
  `stat` `{ value, suffix, label, context, source }` — every number needs a matching film `sources`
  entry (`{ id, title, date?, url? }`) and its `source` line on screen; `endcard`
  `{ title, support, action }`; `kinetic` words follow the narration and need `vo`.
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

## Report what was made

Describe outputs from what the tools measured, not from the film's settings: a rough cut's size is
the `actual video` line of `clearframe_job` (half the project size), and its narration and music are
the "as made" lines of `clearframe_sound`. A draft take is the free operating-system voice named in
its record's `spokenBy` (older drafts did not note which); the Google voice and style are settings
for a paid take that has not been made. A file is often a few frames longer than the film it holds:
quote the film's length, and the file's when it matters. Say "draft voice" and
"a 960×540 rough cut"; never name the Google voice or the project size for something that was not
made with them.
