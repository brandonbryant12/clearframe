# Authoring a ClearFrame film quickly (studio agent)

Short reference for building a first cut without reading every guide. Look up exact props with
`clearframe_catalog` (topic `block`, name `…`): each block has a ready example to copy and adapt.

## The fastest path to a watchable first cut

1. `clearframe_state` once (add `full: true` only if you must see layers).
2. Read the brief and sources (`clearframe_files`). Before any scene, decide **what stays on screen**:
   the subject that persists and changes (the materials of a process, the parts of a system, the
   figure being explained, the product), and the moves that happen to it — a hook, the mechanism or
   evidence in a few steps, a turn, a landing. Write each scene as a move of that picture ("the
   pieces line up", "one steps forward", "a note lands and it changes"), not as a new slide.
3. One `clearframe_edit` batch that replaces the starter: `delete` the sample scenes you will not
   reuse, `insert` new scenes (`block` or `sketch`, `after` an id), then `set` their `props`, `vo`
   (narration), `label` and, for numbers, the film's `sources` (`target: film`, `path: sources`).
   A failed batch writes nothing and tells you why; fix and resend.
4. `clearframe_render` kind `draft` (the rough cut), then `clearframe_job` with `wait: 90` until it
   finishes. Fix any engine errors it lists and render again.
5. Report in a few lines: what the cut shows, which scenes are placeholders, what you need.

## Pictures that carry a story

Films made of one card per line feel like slideshows. Pick the spine from these, in this order of
preference, and keep the same objects on screen across cuts:

- **A cast** (`canvas` with `props.cast`): a few designed objects (icon tiles or word pills) that
  persist through consecutive scenes and re-form on spoken words — `scatter`, `line`, `ring`,
  `cluster`, `hero` (one steps forward, the rest recede), `swap` (one becomes another in place;
  `by` names what causes it), `wave` (a pulse runs through a sequence), `exit`. Declare the objects
  in the first cast scene; later scenes list only formations. Insert a `canvas` scene and `set`
  its whole `props` (path `props`) so none of the sample drawing remains. Consecutive cast scenes cut
  invisibly, and positions come from the frame, so one storyboard serves landscape and vertical.
  ```json
  {"cast": {"objects": [{"id": "report", "icon": "file", "color": "accent", "enter": "none"},
                         {"id": "chart", "icon": "chart-bar", "color": "accent2"}],
            "formations": [{"form": "scatter", "at": 0.3}, {"form": "line", "say": "order", "thread": true}]}}
  ```
  Next scene: `{"cast": {"formations": [{"form": "hero", "hero": "chart", "say": "becomes", "word": "the moment"}]}}`.
- **A film stage** for systems, pipelines and code changes: actors, links and packets that keep
  their identity across scenes (`clearframe_guide` topic `scene`).
- **One world** the camera travels (`props.world` shared by consecutive canvas scenes) for a
  journey, a process or a map.
- **Charts that morph**: consecutive canvas `chart`s with the same ids, a `bridge` that walks from
  one total to another, drivers cued to the words that name them.
- Drawn mechanisms: insert a `sketch` (`route`, `pipeline`, `orbit`, `balance`, `versus`, `burst`,
  `network`…; `clearframe_catalog` topic `sketches`), then adjust its text elements.

Cards are punctuation, not the spine: a `title` or `statement` to open or turn, a `stat` for the
one figure that matters, an `endcard` to close; never three cards in a row.

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
