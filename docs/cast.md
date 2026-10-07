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

`props.cast` is `{objects?, formations, seed?}`.

- **Objects** are declared in the first beat that uses the cast; later beats may add more. Each is `{id, icon | word, color, label?, size?, float?, enter?}`:
  - `icon` is any icon name (`clearframe catalog canvas`), drawn on a rounded tile. `word` (up to 14 characters) is drawn on a pill.
  - `color` is a palette role (`accent`, `accent2`, `positive`, `negative`, `ink`, `muted`, `surface`).
  - `label` is a small caption under the tile.
  - `float` (default on) gives a slow idle drift.
  - `enter` is how a new object arrives on its first formation: `pop`, `drop`, `rise`, `left`, `right` or `fade`. Use `none` to have it stand on frame one, as part of the establishing picture.
- **Formations** (1–12 per beat) each move some objects, on a spoken word (`say`) or at seconds (`at`). An uncued formation follows the previous one by 1.6 s. `ids` limits a formation to those objects; without it, every object still on screen takes part.

| `form` | What happens |
|---|---|
| `scatter` | A loose, even spread over the frame, seeded by the ids (the same cast always scatters the same way). |
| `line` | A row on wide frames, a column on tall ones (`row` and `column` force one). `thread: true` draws a line through the pieces once they settle: they are now one sequence. |
| `ring`, `cluster` | A circle (`spread`) or a touching hexagonal pile. `beside: id` sets the formation next to an object where it stands. |
| `hero` | `hero: id` steps forward at 2.3× (`scale`) while the rest recede into a quiet ring. `word` types a line under it. |
| `swap` | `out` becomes `in` in place: the old shrinks away where it stood, the new grows into its pose. `by: [ids]` names what causes the change: those objects travel onto it and work at it, it gives under each stroke, and the change lands on the cue. |
| `wave` | A pulse runs through `ids` in order where they stand (each lifts and settles): a sequence playing, a signal travelling. Nothing moves for good, and threads stay. |
| `exit` | Objects leave along the line from the centre through where they stand, and stay gone unless a later formation names them. |

`dur`, `stagger` and `ease` tune a formation's motion; `center: [x, y]` and `spread` override its placement. Positions come from the frame, so one storyboard serves landscape and vertical; check both.

## Continuity

Each beat ends with every object's pose (place, scale, rotation, opacity), its depth and any settled thread. The next cast beat starts from exactly that, so nothing jumps at the cut:

- Objects no formation names are drawn where they were.
- A thread stays until the next move.
- What acts on another (`by`) is drawn over it, and keeps that depth afterwards.

Consecutive cast beats are joined with a cut, no exit, and a still camera (unless the beat sets one). A non-cut transition between them is warned about, because it would hide the continuity. A hero's `word` fades before the cut when nothing replaces it.

Frames remain a pure function of time: the formations compile once into keys on stable groups.

## When to use it

- An explainer whose subject is a set of things that get sorted, chosen, transformed or replaced: inputs to a process, features in a release, sources in a report, steps of a workflow.
- A product or PR film where one piece changes and the rest stay. Use `swap` with `by` for the cause.
- A turn in the story. Keep the cast for the setup and cut to a chart, a stage or a card at the turn. The cut means more when the picture has held until then.

Not for evidence: numbers, charts and quotes stay in their own native forms with sources. A cast can carry the objects that stand for them (a chart tile becomes the chart beat that follows).

Reference: `examples/cast-study` (one cast, five moves, 17 s, landscape and vertical). Tests: `test/cast.test.mjs`.
