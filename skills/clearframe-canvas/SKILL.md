---
name: clearframe-canvas
description: Draw original animated graphics in ClearFrame with the canvas block and beat art layers — metaphors, routes, systems, flows, custom diagrams, typographic moments and annotations on charts — cued to narration. Use whenever a scene explains how or why something works, when a fixed block would be a list of words, or when a film looks like a slide deck.
---

# Draw the idea

Read [docs/canvas.md](../../docs/canvas.md) for the element reference. The fixed blocks carry evidence; canvas carries explanation. If the narration says *how*, *why*, *through*, *between*, *around*, *until* or *instead*, there is probably a drawing to make.

When the idea is how one quantity behaves (a relationship, an accumulation, noisy evidence, a flow), the `graph`, `accumulate`, `estimate` and `field` props draw it from a formula or a labelled simulation: see `clearframe-explain`.

## Workflow

1. **Find the picture in the sentence.** Name the mechanism in five words ("demand overflows a fixed pipe"). Choose a metaphor the viewer already knows: a route, a pipe, a scale, a funnel, a ladder, a bridge, orbits, a network, a gap, a wave, a split.
2. **Start from a sketch.** `pnpm cf sketch` lists compositions; `sketch NAME [--vertical]` prints props. Adapt labels, counts, colours and cues. Keep its staging (ground → subject → change).
3. **Cue to the voice.** Put `say` on the element that answers the stressed word. Let the ground appear first, before the voice needs it.
4. **Look.** `still DIR --beat ID --pos 0.4 --grid`, then `--pos 0.95`. Read coordinates off the grid to fix placement. Check the vertical cut too if you deliver one.
5. **Annotate blocks with art.** An arrow onto the bar that matters, soft shapes under a quote: `art.over` / `art.under` on any beat, placed from a `--grid` still. To point at words (ring the button to press, strike the old label, highlight the clause), put `marks` on the text element itself (`{words, style: highlight|underline|circle|box|strike|cross|stamp, say}`; a stamp takes `label`): the renderer finds the words, so nothing is placed by coordinates and the mark follows the text through moves and edits. For a policy, plan summary or client letter, a `document` shows a page of its real text and `scroll`s to the section being read; for a step in an app, a `pointer` presses controls by id (`examples/fsa-deadline`).

## Composition rules

- One hero element per frame, clearly larger or brighter than the rest. Supporting labels 36–44 px, nothing under 28 px at 1080p.
- Draw on a grid: align centres and baselines, keep equal gaps, respect the 90 px margins and the header area.
- `accent` for the subject, `accent2` for the result or contrast, `ink` for structure, `line`/`muted` for scaffolding. Palette tokens follow `tone` and the theme; avoid raw hex unless it is brand colour.
- Declare `fill` on stroked shapes. Wireframe orbits, contour rings, pulse rectangles and helmet outlines need `fill: "none"`; a stroke alone leaves rect/circle/ellipse solid accent-filled. Choose an explicit colour for intentional fills.
- Motion explains: `draw` for paths and connections, `along` for things that travel, `grow-y` for quantities, `pop` for arrivals, `keys` for change, `exit` for things that stop being true. Use fades only for background layers.
- Keep reading holds still for business and technical films. Use ambient loops only when they serve the brief; never add wobble to clear a held-frame warning.
- Build, then transform: draw the problem, `exit` part of it on a cue, draw the fix in the same frame. One canvas beat can carry two or three ideas if the voice walks through them.
- Plan a world on its map: `pnpm cf world DIR` draws everything with each beat's camera rect numbered. Stations in story order, with no camera move re-crossing earlier material.
- Keep a cast. When the story sorts, chooses or changes a set of things, `props.cast` keeps the same designed objects on screen through consecutive beats and re-forms them on spoken words (`scatter`, `line`, `hero`, `swap` with `by`, `wave`, `exit`); the cuts are invisible (docs/cast.md).
- Travel instead of cutting. When the story is a journey, a process or a map, make consecutive canvas beats one `world` with camera `view: [x, y, w, h]` per beat: each draws only what is new, the camera glides between, and the last beat pulls out to show the whole (docs/canvas.md, Worlds).
- Handmade looks: `rough` for pencil and whiteboard (the `sketchbook` treatment sets the whole film up for it). `mosaic` lays a shape in tiles (docs/canvas.md, Mosaic); keep it for a subject that is itself made of pieces.
- Printed looks: `print` makes a shape look made by a press, not a filter: `halftone` dots, `engraving` lines that swell with the tone, `letterpress` (two plates apart, ink dropping out). On an image, or a plate with `treatment: "halftone"`, the screen follows the photo's own darkness. Use it where the subject is printed matter (a statement, a certificate, a clipping); keep charts and anything read precisely clean (`print: false`). See docs/canvas.md, Print.
- Depth makes a place: `z` on the far, middle and near layers, then a camera that moves for a reason: `dolly` to go in, a world truck for parallax, `focus` keys for a rack focus on the word that shifts attention. Draw every layer as it should look before the camera moves (docs/canvas.md, Depth). `examples/night-city` is one world the camera travels.
- Light things that give light: `glow` on lit windows (on the group), suns, screens, hot surfaces; `shadow` for cards on light palettes. It is the cheapest way from flat vector to depth.
- Turn flat things in space: `tilt: [x, y]` on a group (a window, a phone, a ticket, a box face with type on it), flipped in with `tiltY` keys from edge-on and kept alive with `loop: {type: "rock"}`, plus a `shadow` so it floats. Start from `sketch chat`.
- One word can be a material: `material: "chrome" | "gold" | "thermal"` (or your own `map`) paints display type by its own depth. At most one hero word in a product film, rarely in a workplace one; never body text, never figures that need reading.
- Atmosphere is cheap: a `particles` field (`embers`, `rain`, `snow`, `dust`, `bubbles`) under a scene keeps a hold alive. One field per scene, low count, palette colour.
- Draw the real thing from what is on it, not from shapes: a `document` for a policy's own words, a `receipt` for the paper a claim turns on (its total is checked against its lines), an `app` for the screen the step happens on (tabs, fields that fill in, a button that becomes its confirmation). Each names its parts, so `marks` and a `pointer` find them by id; a receipt drawn too small to read prints its lines as bars.
- Keep the picture off the caption band (the bottom quarter of a wide frame, fifth of a tall one): a sketch with room above is framed lower for you, but a drawing you place yourself has to stay above it.
- Text inside canvas is display text: short labels, not sentences. Long thoughts belong in narration or a `statement`.

## Honesty

Drawings are illustrations. If a shape's size encodes a quantity, compute it from the real values and say so; otherwise use `bars`, `magnitude` or `waffle`. Counted numbers (`count`) need a visible `source` and a storyboard `sources` entry. Do not draw logos, real people or maps implying precise geography you have not verified.

For technical systems use `props.diagram` ([system diagrams](../../docs/system-diagrams.md)); `clearframe sketch architecture|state-machine|component-change` prints an editable starting diagram. Declare the components once with stable ids and explain with `steps` (`add`, `remove`, `replace` … `with`, `set` a status, `send` a request along the connections) cued to narration, instead of redrawing each beat. Consecutive beats that share node ids morph. Custom `elements` and `art.over` add hand-authored drawing around it.
