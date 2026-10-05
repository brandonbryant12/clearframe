---
name: clearframe-canvas
description: Draw original animated graphics in ClearFrame with the canvas block and beat art layers — metaphors, routes, systems, flows, custom diagrams, typographic moments and annotations on charts — cued to narration. Use whenever a scene explains how or why something works, when a fixed block would be a list of words, or when a film looks like a slide deck.
---

# Draw the idea

Read [docs/canvas.md](../../docs/canvas.md) for the element reference. The fixed blocks carry evidence; canvas carries explanation. If the narration says *how*, *why*, *through*, *between*, *around*, *until* or *instead*, there is probably a drawing to make.

## Workflow

1. **Find the picture in the sentence.** Name the mechanism in five words ("demand overflows a fixed pipe"). Choose a metaphor the viewer already knows: a route, a pipe, a scale, a funnel, a ladder, a bridge, orbits, a network, a gap, a wave, a split.
2. **Start from a sketch.** `node engine/cli.mjs sketch` lists compositions; `sketch NAME [--vertical]` prints props. Adapt labels, counts, colours and cues. Keep its staging (ground → subject → change).
3. **Cue to the voice.** Put `say` on the element that answers the stressed word. Let the ground appear first, before the voice needs it.
4. **Look.** `still DIR --beat ID --pos 0.4 --grid`, then `--pos 0.95`. Read coordinates off the grid to fix placement. Check the vertical cut too if you deliver one.
5. **Annotate blocks with art.** An arrow onto the bar that matters, a circle round a number, soft shapes under a quote: `art.over` / `art.under` on any beat, placed from a `--grid` still.

## Composition rules

- One hero element per frame, clearly larger or brighter than the rest. Supporting labels 36–44 px, nothing under 28 px at 1080p.
- Draw on a grid: align centres and baselines, keep equal gaps, respect the 90 px margins and the header area.
- `accent` for the subject, `accent2` for the result or contrast, `ink` for structure, `line`/`muted` for scaffolding. Palette tokens follow `tone` and the theme; avoid raw hex unless it is brand colour.
- Declare `fill` on stroked shapes. Wireframe orbits, contour rings, pulse rectangles and helmet outlines need `fill: "none"`; a stroke alone leaves rect/circle/ellipse solid accent-filled. Choose an explicit colour for intentional fills.
- Motion explains: `draw` for paths and connections, `along` for things that travel, `grow-y` for quantities, `pop` for arrivals, `keys` for change, `exit` for things that stop being true. Use fades only for background layers.
- Keep reading holds still for business and technical films. Use ambient loops only when they serve the brief; never add wobble to clear a held-frame warning.
- Build, then transform: draw the problem, `exit` part of it on a cue, draw the fix in the same frame. One canvas beat can carry two or three ideas if the voice walks through them.
- Plan a world on its map: `node engine/cli.mjs world DIR` draws everything with each beat's camera rect numbered. Stations in story order, with no camera move re-crossing earlier material.
- Travel instead of cutting. When the story is a journey, a process or a map, make consecutive canvas beats one `world` with camera `view: [x, y, w, h]` per beat: each draws only what is new, the camera glides between, and the last beat pulls out to show the whole (docs/canvas.md, Worlds).
- Handmade looks: `rough` for pencil and whiteboard, `mosaic` for tesserae (fills in rows or rings on grout, beaded outlines, `enter: assemble` / `exit: scatter`), `mosaic: {style: "pixel" | "stitch"}` for LCD cells or cross-stitch on one grid; the `sketchbook`, `mosaic`, `handheld` and `sampler` treatments set the whole film up for them.
- Printed looks: `print` makes a shape look made by a press, not a filter. `benday` and `halftone` dots, `engraving` lines that swell with the tone, `newsprint` (colour off register under an ink `stroke`, worn paper), `letterpress` (two plates apart, ink dropping out). On an image, or a plate with `treatment: "halftone"`, the screen follows the photo's own darkness. A tint is paper plus dots, never opacity. Keep charts clean (`print: false`). The `pulp`, `woodblock`, `constructivist` and `gallery` treatments, the `benday-burst`, `woodblock-wave` and `manifesto` sketches, and the `style-relay` playbook (one subject, a different process per plate) show it (docs/canvas.md, Print).
- Depth makes a place: `z` on the far, middle and near layers (the near one soft and at the frame edge), then a camera that moves: `dolly` to fly in, a world truck for parallax, `focus` keys for a rack focus on the word that shifts attention. Draw every layer as it should look before the camera moves. The set pieces `void`, `tunnel`, `skyline`, `horizon` and `title` show the pattern (docs/canvas.md, Depth).
- Light things that give light: `glow` on lit windows (on the group), suns, screens, hot surfaces; `shadow` for cards on light palettes. It is the cheapest way from flat vector to depth.
- Turn flat things in space: `tilt: [x, y]` on a group (a window, a phone, a ticket, a box face with type on it), flipped in with `tiltY` keys from edge-on and kept alive with `loop: {type: "rock"}`, plus a `shadow` so it floats. Start from `sketch device` or `sketch chat`.
- One word can be a material: `material: "thermal" | "chrome" | "gold" | "neon"` (or your own `map`) paints display type by its own depth. One hero word per film; never body text, never figures that need reading.
- Atmosphere is cheap: a `particles` field (`embers`, `rain`, `snow`, `dust`, `bubbles`) under a scene keeps a hold alive. One field per scene, low count, palette colour.
- Text inside canvas is display text: short labels, not sentences. Long thoughts belong in narration or a `statement`.

## Honesty

Drawings are illustrations. If a shape's size encodes a quantity, compute it from the real values and say so; otherwise use `bars`, `magnitude` or `waffle`. Counted numbers (`count`) need a visible `source` and a storyboard `sources` entry. Do not draw logos, real people or maps implying precise geography you have not verified.

For technical systems, start with `props.diagram` or `sketch architecture|state-machine|component-change`; see [system diagrams](../../docs/system-diagrams.md). Use native user, service, database, queue and state nodes with drawn connectors and timed additions/removals. Custom `elements` and `art.over` add user-authored drawings.
