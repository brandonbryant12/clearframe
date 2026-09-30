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
- Motion explains: `draw` for paths and connections, `along` for things that travel, `grow-y` for quantities, `pop` for arrivals, `keys` for change, `exit` for things that stop being true. Use fades only for background layers.
- Something breathes after everything lands: `pulse` the subject, `dash` loop the connector, `float` ambient shapes.
- Build, then transform: draw the problem, `exit` part of it on a cue, draw the fix in the same frame. One canvas beat can carry two or three ideas if the voice walks through them.
- Travel instead of cutting. When the story is a journey, a process or a map, make consecutive canvas beats one `world` with camera `view: [x, y, w, h]` per beat: each draws only what is new, the camera glides between, and the last beat pulls out to show the whole (docs/canvas.md, Worlds).
- Atmosphere is cheap: a `particles` field (`embers`, `rain`, `snow`, `dust`, `bubbles`) under a scene keeps a hold alive. One field per scene, low count, palette colour.
- Text inside canvas is display text: short labels, not sentences. Long thoughts belong in narration or a `statement`.

## Honesty

Drawings are illustrations. If a shape's size encodes a quantity, compute it from the real values and say so; otherwise use `bars`, `magnitude` or `waffle`. Counted numbers (`count`) need a visible `source` and a storyboard `sources` entry. Do not draw logos, real people or maps implying precise geography you have not verified.
