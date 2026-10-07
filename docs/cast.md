# Casts: objects that carry the story across cuts

A film made of one layout per line reads as a slideshow, however well each layout moves: nothing on screen survives the cut. A **cast** is a handful of designed objects (icon tiles or word pills) that stay on screen through consecutive canvas beats and re-form as the idea develops. They scatter as raw material, line up into a sequence, let one step forward, turn one into another, and play. The beats become moves of one picture.

```json
{ "id": "pile", "block": "canvas", "vo": "Every film starts as a pile of material.",
  "props": { "cast": {
    "objects": [
      { "id": "report", "icon": "file", "color": "accent", "enter": "none" },
      { "id": "chart", "icon": "chart-bar", "color": "accent2", "enter": "none" },
      { "id": "quote", "icon": "message", "color": "positive", "enter": "drop" }
    ],
    "formations": [{ "form": "scatter", "at": 0.3, "stagger": 0.22 }] } } },
{ "id": "order", "block": "canvas", "vo": "So the agent pulls what matters into an order.",
  "props": { "cast": { "formations": [{ "form": "line", "say": "pulls", "thread": true }] } } },
{ "id": "moment", "block": "canvas", "vo": "One piece becomes the moment on screen.",
  "props": { "cast": { "formations": [{ "form": "hero", "hero": "chart", "say": "becomes", "word": "the moment" }] } } }
```

## Contract

`props.cast` is `{look?, objects?, formations, seed?}`.

- **Objects** are declared in the first beat that uses the cast; later beats may add more. Each is `{id, icon | word, color, label?, size?, float?, enter?}`:
  - `icon` is any icon name (`clearframe catalog canvas`), drawn on a rounded tile. `word` (up to 14 characters) is drawn on a pill.
  - `color` is a palette role (`accent`, `accent2`, `positive`, `negative`, `ink`, `muted`, `surface`).
  - `label` is a small caption under the tile.
  - `float` (default on) gives a slow idle drift.
  - `enter` is how a new object arrives on its first formation: `pop`, `drop`, `rise`, `left`, `right` or `fade`. Use `none` to have it stand on frame one, as part of the establishing picture.
- **Look** is set once, in the cast's first beat, and the cast keeps it:
  - `tiles` (default): flat rounded tiles with a soft shadow, for clean product and business films.
  - `drawn`: pen on paper. A hand-drawn ink outline, the colour hatched in, icons in ink, and type and threads by hand. It suits explainers, onboarding and lessons.
  - `print`: a two-colour press, with the colour laid in a dot screen slightly off register and worn, and poster type. It suits editorial and campaign films.
  Choose by the audience and the rest of the film's treatment, not for variety's sake.
- **Formations** (1–12 per beat) each move some objects, on a spoken word (`say`) or at seconds (`at`). An uncued formation follows the previous one by 1.6 s. `ids` limits a formation to those objects; without it, every object still on screen takes part.

| `form` | What happens |
|---|---|
| `scatter` | A loose, even spread over the frame, seeded by the ids (the same cast always scatters the same way). |
| `line` | A row on wide frames, a column on tall ones (`row` and `column` force one). `thread: true` draws a line through the pieces once they settle: they are now one sequence. |
| `ring`, `cluster` | A ring with the frame's proportions (`spread`), or a touching hexagonal pile. `on: id` centres it on an object where it stands (copies gathered around the original); `beside: id` sets it next to an object, on the side facing the middle of the frame. |
| `hero` | `hero: id` steps forward at 2.3× (`scale`) while the rest recede into a quiet ring. `word` types a line under it. |
| `swap` | `out` becomes `in` in place: the old shrinks away where it stood, the new grows into its pose. `by: [ids]` names what causes the change: those objects travel onto it and work at it, it gives under each stroke, and the change lands on the cue. |
| `wave` | A pulse runs through `ids` in order where they stand (each lifts and settles): a sequence playing, a signal travelling. Nothing moves for good, and threads stay. |
| `merge` | Copies fold into one: each of `ids` flies into `into` and is absorbed, and `into` gives a pulse as each lands (duplicates merged, sources folded into a summary). The absorbed objects are gone until a later move names them. |
| `split` | The reverse: `ids` burst out of `from` into a ring around it, either objects it absorbed earlier or new ones (one request fanning out to three services, a fix reaching everyone who reported the bug). `spread` sets the ring. |
| `camera` | `zoom` (0.6–2.5) pushes in or pulls back on the whole cast, about the middle of the frame and most of the way toward `on: id` if given. The camera carries across cuts like the objects; `zoom: 1` returns it. Use it for a reason: closing in on the moment that matters, stepping back for the resolution. |
| `fill` | The object travels to the middle and grows past the edges. Its face fades and its colour floods the frame. The next scene, of any block (a chart, a figure, a card, a stage), plays on that colour as its `tone`, with a cut on one flat colour. It must be the beat's last move, and the object must be `accent`, `accent2`, `surface` or `ink` (the colours a scene can take as a tone). |
| `emerge` | The way back: the first move of a later cast beat. The object starts as the whole frame, in the colour of the scene before (which takes it as its tone), and shrinks back to where it stood before it filled, its face returning. |
| `exit` | Objects leave along the line from the centre through where they stand, and stay gone unless a later formation names them (they come back from where they left). |
| `mark` | A pen mark drawn on the cast where it stands, cued like any move. `mark: circle` loops what matters, `underline` puts a line under it, and `cross` strikes through what is set aside. `arrow` with `to: id` or `to: [ids]` draws a bowed arrow from each of `ids` to each target. `color` overrides the pen (accent2; negative for a cross). A mark on one object belongs to it: it moves and scales with the object and leaves with it. Otherwise marks fade when the cast next moves, or before the cut. |

`dur`, `stagger` and `ease` tune a formation's motion; `center: [x, y]` and `spread` override its placement. Every placed object stays whole inside the title-safe area (only `exit` leaves it), so a formation beside an object near an edge, or a wide ring, is pulled back in. Positions come from the frame, so one storyboard serves landscape and vertical; check both.

## Continuity

Each beat ends with every object's pose (place, scale, rotation, opacity), its depth and any settled thread. The next cast beat starts from exactly that, so nothing jumps at the cut:

- Objects no formation names are drawn where they were.
- A thread stays until the next move.
- What acts on another (`by`) is drawn over it, and keeps that depth afterwards.

Threads keep cause before effect: each segment draws once both of its ends have arrived. If a formation is cued so late that it cannot settle before the beat ends, its thread is left out (and not carried), and `check` names the cue to move or the tail to add.

A cast lays itself out for the frame, so it cannot be combined with `view`, `viewFrom` or `world`. It keeps clear of the scene's heading, whether at the top or the bottom. Word pills are as long as their words, and every object, pill or tile, is kept whole inside the title-safe area; a scatter pushes apart objects that would land on each other. Elements you add to a cast beat (a panel, a label, a route) are scenery and are drawn beneath the cast.

Consecutive cast beats are joined with a cut, no exit, and a still camera (unless the beat sets one). A non-cut transition between them is warned about, because it would hide the continuity. A hero's `word` fades before the cut when nothing replaces it.

Frames remain a pure function of time: the formations compile once into keys on stable groups.

## Handing off to other scenes

A cast need not carry the whole film. `fill` hands one object's colour to the next scene, so a chart tile becomes the chart, a figure or a card, and `emerge` brings it back into the cast afterwards. The job sets the in-between scene's `tone` and the cuts on both sides; a tone the author already set that differs is warned about, and so is a non-cut transition. This is how a cast meets the film's other mechanisms without a slideshow cut. `examples/cast-study` fills the chart into a sourced figure and brings it back.

## When to use it

- An explainer whose subject is a set of things that get sorted, chosen, transformed or replaced: inputs to a process, features in a release, sources in a report, steps of a workflow.
- A product or PR film where one piece changes and the rest stay. Use `swap` with `by` for the cause.
- A turn in the story. Keep the cast for the setup and cut to a chart, a stage or a card at the turn. The cut means more when the picture has held until then.

Not for evidence: numbers, charts and quotes stay in their own native forms with sources. A cast can carry the objects that stand for them (a chart tile becomes the chart beat that follows).

Start from the playbook: `new DIR --playbook process-cast [--vertical]` scaffolds five cast beats (arrive, sort, focus, change, result) to rewrite with your own objects and moves. References:
- `examples/cast-study`: tiles. One cast, five moves, 17 s.
- `examples/cast-drawn`: the drawn look with marks. Bug triage in 24 s: copies ringed and crossed out, the first underlined, replies drawn back.

Tests: `test/cast.test.mjs`.
