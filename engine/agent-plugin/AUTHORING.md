# Authoring a ClearFrame film quickly (studio agent)

Short reference for building a first cut without reading every guide. To find what to build with,
ask the library in plain words: `clearframe_catalog` topic `find`, `query` = the idea, the audience
and the feeling ("explain our faster checkout to sales", "a playful teaser for a retro game"). It
returns a short shortlist across blocks, sketches, playbooks, looks, cast shapes and moves, stage
mechanisms and examples, each saying what it is and when it fits; topic `item` (name `KIND:NAME`)
gives one entry's exact authoring and a copyable example (for a sketch: its `sketchText` slots and `sketchSay` moments to fill from the brief and the narration). When the picture itself must change (other objects, fewer pieces), topic `sketch` (name, with `sketchText` and `sketchSay`) returns its drawn elements for this film's frame shape. Put them in `props.elements` (without `props.sketch`) and edit only what the brief needs; guide topic `inspiration` lists what can change. One search usually replaces a tour of every
topic. When the person wants ideas or the brief leaves the picture open, offer two or three concepts that
differ in the picture's idea (a metaphor, a place, the mechanism, the words, the number), each with a
line on why it suits them, then pick one and build it; guide topic `inspiration` has the method. Exact block props: topic `block`, name `…`.

## The fastest path to a watchable first cut

1. `clearframe_state` once (add `full: true` only if you must see layers).
2. Read the brief and sources (`clearframe_files`). Before any scene, decide **what the audience
   should see** for this material: the thing the story is about (the pieces of a process, the parts
   of a system, a figure, a product, a place) and what happens to it — a hook, the mechanism or
   evidence in a few steps, a turn, a landing. Where that thing persists, keep it on screen and
   write each scene as a change to it ("the pieces line up", "a note lands and one changes"),
   rather than a new layout per line.
3. If a playbook fits the material better than the starter (the `find` shortlist names fitting ones;
   topic `playbooks` lists them all, each with what it is for and who it is for), start from it with
   `{"command":"playbook","id":"…"}` and rewrite its scenes; otherwise build on the starter.
   One `clearframe_edit` batch that replaces the starter: `delete` the sample scenes you will not
   reuse, `insert` new scenes (`block` or `sketch`, `after` an id, and your own `id` so the same
   batch can fill them), then `set` their `props`, `vo` (narration), `label` and, for numbers, the
   film's `sources` (`target: film`, `path: sources`). A failed batch writes nothing and tells you
   why; fix and resend. For example:
   `[{"command":"insert","block":"canvas","after":"title","id":"pile"},
     {"command":"set","target":"beat","beat":"pile","path":"props","value":{"cast":{…}}},
     {"command":"set","target":"beat","beat":"pile","path":"vo","value":"Reports arrive from everywhere."}]`
   Get to the first cut quickly and in small steps: one edit for the outline (delete the starter's
   scenes; insert yours with ids, blocks and narration), then one edit per scene to fill its
   picture, then the draft. Small edits arrive intact; one huge edit full of code or quoted text is
   the likeliest to break. Write direction notes after the cut, if at all: the cut is the plan.
4. `clearframe_render` kind `draft` (the rough cut), then `clearframe_job` with `wait: 90` until it
   finishes. Fix any engine errors it lists and render again. Then `clearframe_look` at it: one
   motion sheet of the whole cut, then single scenes (`beat`) where something looks wrong, and
   `phone: true` for a vertical film. Fix what you see (a hierarchy that does not read, a held frame,
   words too small, a picture that does not change on its line) before you report.
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
  in the first cast scene; later scenes list only formations. Time the moves by what the line says:
  each step the narration describes (they merge, it goes first, it reaches the customer) gets its
  move on the word that names it (`say`, one word); a figure, a quote or a moment that needs reading
  or feeling can hold still. What to fix is a picture that never shows the step being described. Insert a `canvas` scene and `set` its
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
  The code itself takes one scene: a `stage` with only `code` shows the change as an editor that
  fills the picture, the changed lines lighting up on the word given by `say`:
  `{"block":"stage","props":{"title":"The fix","code":{"title":"tools.mjs","before":"…old lines…","after":"…new lines…","say":"scanner"}}}`.
  Show only the few lines that changed (two to six), copied as plain text. To read the change from
  git instead, give `commit`, `file` and `window: [first, last]` (line numbers in the new file);
  without a window, a large change is refused as too long to read. Pair it with the
  mechanism (a diagram or cast before and after) and the evidence (a `stat` with its source).
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

- Narration-led scenes take their length from `vo` (about 150 words a minute); an inserted scene has
  no duration of its own, so its narration sets it. Hold a scene longer with `hold`
  (seconds after its last word) or `tail`, not `duration`; `min` cannot stretch a scene inside one
  continuous narration take. Silent scenes need `duration` (seconds). Link scenes causally in the narration (but, so, because), not "and then".
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
