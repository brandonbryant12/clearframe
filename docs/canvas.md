# Canvas: draw what the blocks cannot

`canvas` is a beat you draw: shapes, paths, text, icons and images with entrances, keyframed moves, motion paths, ambient loops and exits, all cued to spoken words. Every beat can also carry an `art` layer (`under` or `over` its block) using the same elements, for an arrow onto a bar, a circle round a word or soft shapes behind a quote.

Start from a sketch, not a blank page: `clearframe sketch` lists starting compositions (route, orbit, pipeline, network, balance, versus, burst, ambient); `clearframe sketch route --vertical` prints props for that frame. Render every sketch with `clearframe gallery DIR --sketches [--vertical] [--theme NAME]`.

## Coordinates

Without `view`, coordinates are frame pixels of the normalized canvas: 1920×1080 landscape, 1080×1920 vertical, 1080×1080 square, 1080×1350 portrait. A title and kicker occupy roughly y < 300 (landscape), and the source line sits near the bottom. With `view: [w, h]`, your coordinates are fitted, centred, into the content area below the header, which is useful for art you want to reuse at any size. With `view: "auto"`, the drawing's own bounds (elements at rest) are fitted into the content area and enlarged up to 2×. Draw at any scale and it fills the space; this is the easiest choice for diagrams under a title.

`art` layers always use frame pixels. To place art on a block (a bar, a number, a word), render `clearframe still DIR --beat ID --grid` and read the coordinates off the labelled 100 px grid.

## Elements

| type | geometry |
|---|---|
| `rect` | `x, y, w, h, r` (corner radius) |
| `circle` | `cx, cy, r` |
| `ellipse` | `cx, cy, rx, ry` |
| `line` | `x1, y1, x2, y2`, `arrow: start|end|both`, `head` |
| `path` | `d` (SVG path data: M L H V C S Q T A Z), `arrow`, `head` |
| `poly` | `points: [[x, y], …]`, `closed` |
| `text` | `text, x, y` (first baseline), `size`, `font: display|semibold|bold|light|text|regular|strong|figures|serif|serif-italic|italic|mono|hand`, `anchor: start|middle|end`, `width` (wraps and fits), `leading`, `tracking` (em), `upper`, `count: {from, to, decimals, prefix, suffix, dur}` |
| `icon` | `name` (see `clearframe icons`), `x, y` (centre), `size`; colour from `stroke` or `fill` |
| `image` | `asset` or `file`, `x, y, w, h, r`, `fit: cover|contain`, `treatment` |
| `group` | `children`, `x, y` (offset), `stagger` (seconds between children) |
| `meter` | `x, y, w, h`, `style: bars|mirror|ring|wave`, `bars`, `step`: the narration's loudness, live |
| `spotlight` | `cx, cy, r` or `x, y, w, h`, `dim`: everything outside the window recedes |
| `particles` | `x, y, w, h` (the field), `kind: dust|embers|rain|snow|bubbles`, `count` (1–400), `seed`, `size`, `speed`; colour from `fill`. Seeded and deterministic; particles wrap and fade at the edges. Use sparingly under a scene (`art.under`) for atmosphere: embers over heat, rain over a flood, dust in a quiet hold. |

Paint: `fill` and `stroke` take palette tokens (`bg, surface, ink, muted, accent, accent2, positive, negative, line, wash, wash2, none`), `#rrggbb`, or a gradient `{gradient: [2–4 colours], angle, radial, fade}`. `fade` dissolves the last stop to transparent, which gives soft glows. Tokens follow the palette and a beat's `tone`, so art never clashes. Light and depth: `glow: true | {blur, opacity, color}` bleeds an element's light outward (lit windows, a sun, a hot roof); `shadow: true | {dx, dy, blur, opacity, color}` drops a soft shadow (on light palettes). Put `glow` on a group to light many shapes with one filter. Other paint fields: `width` (stroke), `opacity`, `dash: [on, off]`, `cap`, `join`, `rotate`, `origin: [x, y]` (for rotation and scale), `blend: multiply|screen|overlay|…`.

## Time

| Field | Meaning |
|---|---|
| `say` / `at` | When the element enters: a spoken word or phrase, or scene seconds. Without either, elements follow the scene cue plus `stagger`. |
| `enter` | `fade, pop, rise, drop, left, right, grow, grow-x, grow-y, draw, wipe, wipe-up, type, scramble, blur, assemble (mosaic), none`. Default: strokes `draw`, text `rise`, icons and circles `pop`, others `fade`. |
| `dur`, `dist` | Entrance seconds; travel distance. |
| `keys` | `[{say|at, dur, ease: inOut|in|out|linear|spring, x, y, scale, scaleX, scaleY, rotate, opacity}]`: each key starts at its time and eases from the previous state. `x, y` are offsets; `scaleX`/`scaleY` stretch one axis about `origin` (a level rising or falling, a gap widening). |
| `along` | `{d, say|at, dur, ease, rotate}`: the element's origin travels along a path (a marker on a route, a packet through a pipe). |
| `loop` | `{type: spin|pulse|float|sway|orbit|dash|blink, period, amount}`: ambient motion after the entrance, eased in. `dash` marches a dashed stroke. `spin` with an `origin` orbits a centre. |
| `exit`, `exitSay` / `exitAt`, `exitDur` | Leave mid-scene: `fade, shrink, fall, lift, undraw, wipe, blur, scatter (mosaic), none`. Use it to build, then transform: draw a problem, clear it, draw the fix. |

`check` resolves every spoken cue against the narration and fails if one is missing or lands after the beat. `settle` (when the exit may begin) waits for every entrance, count, key and path move. Loops continue. A `count` is a displayed figure: it needs a visible `source` and a `sources` entry, like any chart.

## Mosaic: shapes laid in tesserae

Give a shape `mosaic: true` (or set `mosaic` on the canvas to lay every shape) and it is drawn in small square tiles instead of a flat fill:

- **Fills** (rect, circle, ellipse, closed path or poly) are laid in hand-cut tiles (slanted corners, varied widths, a slight turn, a few pale pieces, a bevel lit from the upper left) on one dark grout bed shared by the whole film. Tiles run in `rows` (running bond, fitted to the shape's height; the default for most shapes) or `rings` (wedge rings fitted to each circumference; the default for circles and ellipses), under an outline row laid half a tile inside the contour in the stroke colour. A gradient fill is sampled per tile along `axis` (degrees; 90 = top to bottom), which gives mosaic skies and seas.
- **Strokes** (a line, open path, or a shape with `fill: none`) become a beaded line of tiles along the path. With `enter: draw` the tiles are laid in drawing order.
- **Motion.** `enter: assemble` builds the shape tile by tile: tiles drop into their beds in `build` order (`sweep`, `radial`, `random`), or with `build: fly` they swarm in from `from: [x, y]` (default below the shape), each on its own arc, starting in a loose cloud of `spread` px. `exit: scatter` throws the tiles loose; they spin, fall and fade.
- **Options:** `tile` (size, default 16), `gap` (grout), `jitter` (0–1), `flow`, `outline` (true/false), `build`, `shade` (per-tile light/dark range), `shine` (glassy highlight), `glint` (0–1: tiles catch the light in turn, so a held mosaic shimmers; water 0.6, gold 0.4, walls 0.15), `grout` (colour), `axis`, `seed`.

Pair it with the `mosaic` treatment (palette, `backdrop: "mosaic"`, gentle motion, iris at chapter turns). Put `glow` on gold tiles (a moon, a lamp, stars). Draw hero shapes big enough for a dozen tiles across. Layouts are cached and tiles are batched by colour, so a frame of a few thousand tiles costs a handful of paths.

## Worlds: one drawing, a travelling camera

Slides cut from one picture to the next. A world keeps one picture and moves the camera. Give consecutive canvas beats the same `world` name and a camera rect `view: [x, y, w, h]` in world coordinates:

```json
{ "id": "source", "block": "canvas", "props": { "world": "water", "view": [0, 0, 1920, 1080], "elements": [ …mountains, rain… ] } },
{ "id": "plant",  "block": "canvas", "props": { "world": "water", "view": [1500, 0, 1920, 1080], "elements": [ …the pipe, the plant… ] } },
{ "id": "whole",  "block": "canvas", "props": { "world": "water", "view": [-100, -560, 5200, 2925], "elements": [ …one line of type… ] } }
```

Each beat draws only what is new, cued to its own narration; everything drawn earlier stays, still looping, on its original clock. The cut between world beats is invisible (`cut`, no exit, camera moves off), and the camera travels from the previous view to the new one over `viewDur` (1.2 s) starting at `viewAt` (0 s): pan by moving `x, y`, push in or pull out by changing `w, h`. A camera rect fills the whole frame (keep it 16:9 for landscape, 9:16 for vertical). Finish on a wide view of the whole world for the payoff. Titles, where used, sit over the world.

Camera moves land on the words: the move to a new beat's view starts in the outgoing beat's tail (once it has settled, up to 1 s early), so the camera arrives by the new line's first word or first new drawing. Both beats evaluate the same move across the cut. A graphic transition (`iris`, `panel`, `whip`) between two world beats cuts to the new view under its cover instead. For depth, give far layers `depth` below 1 (a distant skyline at 0.5): they follow the camera by only part of its travel, which gives parallax.

While the camera holds, it drifts in slowly (`viewDrift`, default 3% of the view), and the next move starts from there, so a world never freezes. To change the world's state under what is already drawn, such as a sky that lights up by day or a glow under the city, give the new element `behind: true`. Labels that would clutter a later wide shot can leave while the camera is elsewhere: set an `exitAt` after the beat ends. Lay stations out in story order (up for the sky, down for a plan view, onward for the next stop) so the camera never re-crosses old material. `examples/night-city` shows all of this.

**Other frame shapes.** A camera rect authored for landscape is re-framed automatically for a vertical or square cut, on the beat's own foreground (ignoring backdrops, parallax and `behind` layers). That works for a single subject, like a roof or a machine part. A side-by-side composition (a map beside its labels) cannot survive the crop: give that beat `viewTall: [x, y, w, h]` (9:16), or lay the vertical cut out differently. Check with `world DIR` on the vertical project.

`clearframe world DIR` renders the whole world at its final state with every beat's camera rect outlined and numbered. Use it to lay out stations and choose views before rendering the film, and again after any change of layout.

Good worlds: a journey (source → process → destination), a timeline laid out left to right, a map zooming from region to street, a machine explored part by part, one diagram built up and then revealed whole.

## Design the frame

- **One idea, drawn.** Draw the mechanism the narration explains, not the words it says. A route for a journey, orbits for an ecosystem, a balance for a trade-off, a pipe for a flow, a network for spread.
- **Stage it.** Establish the ground first (a rule, an axis, a faint path in `line`), then the subject, then the change. Cue the change to the stressed word with `say`.
- **Draw, don't fade.** Strokes that draw on, arrows that ride their tip and markers that travel along paths read as explanation. A fade is a pause, not an idea.
- **Scale contrast.** One large element, several small ones. Big numbers and words in `bold`, labels at 36–44 px, nothing smaller than 28 px at 1080p.
- **Colour with intent.** `ink` for structure, `accent` for the subject, `accent2` for the contrast or result, `line`/`muted` for scaffolding. Two accents per frame is plenty.
- **Keep it alive.** After everything lands, something should still breathe: a `pulse` on the subject, a `dash` loop on a connector, `float` on ambient shapes, or the scene camera.
- **Leave the text layer clear.** Keep art away from the header and source line and within 90 px of the frame edge. Check with `still --grid`.
- **Be honest.** Illustrative shapes must not imply data they do not have. Proportions that encode quantities (bar heights, areas) must be computed from the real values, or use a chart block.

## Plates, tone and camera (beat-level)

These combine with any block, including `canvas`:

```json
{ "id": "why", "block": "stat", "transition": "iris", "tone": "accent", "camera": { "move": "in", "amount": 0.6 },
  "plate": { "asset": "coast", "side": "left", "treatment": "duotone", "drift": "left", "focus": [0.3, 0.5] },
  "art": { "over": [{ "type": "path", "d": "M 1500 320 C 1380 300 1200 330 1075 440", "stroke": "accent2", "width": 6, "arrow": "end", "say": "here" }] },
  "props": { "value": 72, "suffix": "%", "label": "…", "source": "…" } }
```

- `plate`: an image or clip `side: full|left|right|top|bottom` (tall frames stack left/right as top/bottom). `treatment: duotone|tint|mono|blur|soft|none` recolours any photo or generated still into the palette; `drift: in|out|left|right|up|down|none`; `scrim` 0–1 keeps text readable on full plates; `focus: [x, y]` chooses the crop.
- `tone: accent|accent2|invert|surface` floods the frame with a colour and re-derives readable text colours. Use it to punctuate. A `panel` transition into an accent-tone scene reads as the panel becoming the background.
- `camera: in|out|left|right|up|down|none` or `{move, amount}`. The default `auto` pushes in gently everywhere except kinetic text and footage.
