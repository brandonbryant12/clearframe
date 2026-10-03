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
| `text` | `text, x, y` (first baseline), `size`, `font: display|semibold|bold|light|text|regular|strong|figures|serif|serif-italic|italic|mono|hand|poster|serif-display|serif-display-italic` (`poster` is Bebas Neue condensed capitals for trailer cards; `serif-display` is DM Serif Display for documentary and editorial titles), `anchor: start|middle|end`, `width` (wraps and fits), `leading`, `tracking` (em), `upper`, `count: {from, to, decimals, prefix, suffix, dur}`, `fit` (the widest a single line may be: a long title shrinks instead of running off the frame) |
| `icon` | `name` (see `clearframe icons`), `x, y` (centre), `size`; colour from `stroke` or `fill` |
| `image` | `asset` or `file`, `x, y, w, h, r`, `fit: cover|contain`, `treatment` |
| `group` | `children`, `x, y` (offset), `stagger` (seconds between children) |
| `meter` | `x, y, w, h`, `style: bars|mirror|ring|wave`, `bars`, `step`: the narration's loudness, live |
| `spotlight` | `cx, cy, r` or `x, y, w, h`, `dim`: everything outside the window recedes |
| `solid` | `shape: tetra|cube|octa|icosa|dodeca`, `cx, cy`, `size` (radius), `spin: [x, y, z]` degrees per second, `tilt: [x, y, z]`, `perspective` (0–0.9), `nodes`, `stroke`, `width`: a 3D wireframe turning in space, back edges dimmer, drawn on edge by edge. Add `glow` for the neon look. |
| `particles` | `x, y, w, h` (the field), `kind: dust|embers|rain|snow|bubbles|stars|warp` (`stars` twinkle in place; `warp` streaks radiate from the centre, a tunnel of light), `count` (1–400), `seed`, `size`, `speed`; colour from `fill`. Seeded and deterministic; particles wrap and fade at the edges. Use sparingly under a scene (`art.under`) for atmosphere: embers over heat, rain over a flood, dust in a quiet hold. |

Planes in space: `tilt: [x, y]` (degrees) turns any element or group about its horizontal and vertical axes, drawn as an orthographic projection with its far edge falling into shade. Key it with `tiltX`/`tiltY` (a card flipping in from edge-on: `keys: [{at: 0, tiltY: 80, dur: 0}, {at: 0, tiltY: -18, dur: 1.1, ease: "out"}]`) and keep it alive with `loop: {type: "rock", period, amount}`. Use it for device windows, phones, tickets, cards and box faces with type printed on them; give the group a `shadow` so it floats.

Materials: `material: "thermal" | "chrome" | "gold" | "neon"` or `{map: preset | [2–8 colours from rim to core], depth, soften, flow, stripe, angle, grain, gain}` paints a shape by its own depth (how far each point lies inside its outline) through a gradient map. Thermal is a heat image with stripes flowing through it; chrome and gold read as polished metal; neon is the palette's accent with a white-hot core. The element's `fill` is ignored. It suits one word of display type (a product name, PRO, a title) at 150 px or more, not body text.

Paint: `fill` and `stroke` take palette tokens (`bg, surface, ink, muted, accent, accent2, positive, negative, line, wash, wash2, none`), `#rrggbb`, or a gradient `{gradient: [2–4 colours], angle, radial, fade}`. `fade` dissolves the last stop to transparent, which gives soft glows. Tokens follow the palette and a beat's `tone`, so art never clashes. Light and depth: `glow: true | {blur, opacity, color}` bleeds an element's light outward (lit windows, a sun, a hot roof); `shadow: true | {dx, dy, blur, opacity, color}` drops a soft shadow (on light palettes). Put `glow` on a group to light many shapes with one filter. Other paint fields: `width` (stroke), `opacity`, `dash: [on, off]`, `cap`, `join`, `rotate`, `origin: [x, y]` (for rotation and scale), `blend: multiply|screen|overlay|…`.

**Outline shapes must declare `fill: "none"`.** A `stroke` does not remove the default solid accent fill on `rect`, `circle` or `ellipse`; glowing rings can otherwise cover the scene behind them. `check` and `critique` warn about this omission, including nested canvas and art layers. Set an explicit colour for a filled shape. Paths and polylines default to no fill, but declaring it makes the intent clear.

```json
{ "type": "ellipse", "cx": 960, "cy": 540, "rx": 400, "ry": 180, "fill": "none", "stroke": "accent", "width": 3, "glow": true, "at": 0, "enter": "none" }
```

## Time

| Field | Meaning |
|---|---|
| `say` / `at` | When the element enters: a spoken word or phrase, or scene seconds. Without either, elements follow the scene cue plus `stagger`. |
| `enter` | `fade, pop, rise, drop, left, right, grow, grow-x, grow-y, draw, wipe, wipe-up, type, scramble, blur, assemble (mosaic), none`. Default: strokes `draw`, text `rise`, icons and circles `pop`, others `fade`. |
| `dur`, `dist` | Entrance seconds; travel distance. |
| `subject` | `true` on a drawn product or hero object: the frame audit refuses type printed over it, as it does for 3D solids. |
| `keys` | `[{say|at, dur, ease: inOut|in|out|linear|spring, x, y, scale, scaleX, scaleY, rotate, opacity, tiltX, tiltY, hold}]`: each key starts at its time and eases from the previous state. `x, y` are offsets; `scaleX`/`scaleY` stretch one axis about `origin` (a level rising or falling, a gap widening). A key with `hold: false` is ambient motion (traffic, drifting cloud) that runs on past the cut instead of holding the beat. |
| `along` | `{d, say|at, dur, ease, rotate}`: the element's origin travels along a path (a marker on a route, a packet through a pipe). |
| `loop` | `{type: spin|pulse|float|sway|orbit|dash|blink|rock, period, amount}`: ambient motion after the entrance, eased in. `dash` marches a dashed stroke. `spin` with an `origin` orbits a centre. |
| `exit`, `exitSay` / `exitAt`, `exitDur` | Leave mid-scene: `fade, shrink, fall, lift, undraw, wipe, blur, scatter (mosaic), none`. Use it to build, then transform: draw a problem, clear it, draw the fix. |

All element times are **scene seconds** (from the beat's start). The `timing DIR` output lists words in **film seconds**; subtract the beat's `start` to cue by time. A key can only cue to its own beat's words.

**How long a beat lasts.** A beat with narration lasts lead + voice + `tail` + `hold`. A beat without narration lasts `pacing.silentBeat` (2.5 s) plus `hold`. Set `duration` for an exact length, for example a 1.2 s silence.

`check` resolves every spoken cue against the narration and fails if one is missing or lands after the beat. `settle` (when the exit may begin) waits for every entrance, count, key and path move. Loops continue. A `count` is a displayed figure: it needs a visible `source` and a `sources` entry, like any chart.

## Mosaic: shapes laid in tesserae

Give a shape `mosaic: true` (or set `mosaic` on the canvas to lay every shape) and it is drawn in small square tiles instead of a flat fill:

- **Fills** (rect, circle, ellipse, closed path or poly) are laid in hand-cut tiles (slanted corners, varied widths, a slight turn, a few pale pieces, a bevel lit from the upper left) on one dark grout bed shared by the whole film. Tiles run in `rows` (running bond, fitted to the shape's height; the default for most shapes), `rings` (wedge rings fitted to each circumference; the default for circles and ellipses) or `contour` (rows parallel to the outline at whole-tile depths, each tile turned along the nearest edge: the hand-laid andamento, best for tapered or irregular shapes), under an outline row laid half a tile inside the contour in the stroke colour. A gradient fill is sampled per tile along `axis` (degrees; 90 = top to bottom), which gives mosaic skies and seas.
- **Strokes** (a line, open path, or a shape with `fill: none`) become a beaded line of tiles along the path. With `enter: draw` the tiles are laid in drawing order.
- **Motion.** `enter: assemble` builds the shape tile by tile: tiles drop into their beds in `build` order (`sweep`, `radial`, `random`), or with `build: fly` they swarm in from `from: [x, y]` (default below the shape), each on its own arc, starting in a loose cloud of `spread` px. `exit: scatter` throws the tiles loose; they spin, fall and fade.
- **Recolour fronts.** `recolor: [{say | at, dur, fill, axis, share}]` sweeps a front across the shape (along `axis` in degrees; 90 is top to bottom). The tiles it passes flip edge-on and come back in the new `fill` (a colour, token or gradient), which is how a mosaic sky turns from dusk to night. `share` flips only that seeded fraction of the tiles: a mosaic can show "12% of streets" by turning 12% of its tiles red.
- **Knockout and halo.** A filled mosaic shape drawn later (the moon, the tower) removes the earlier mosaic's tiles beneath it from the moment it enters, leaving a grout line. The nearest `halo` rows (default 2) then bend around its outline, the way a mosaicist lays the sky around a figure. `knockout: false` on the later shape opts out.
- **Scale.** A single shape is capped at about 12,000 tiles (its tile size grows instead). A canvas-level `mosaic` leaves backdrop-sized shapes flat for the mosaic backdrop to cover.
- **Options:** `tile` (size, default 16), `gap` (grout), `jitter` (0–1), `flow`, `outline` (true/false), `build`, `shade` (per-tile light/dark range), `shine` (glassy highlight), `glint` (0–1: tiles catch the light in turn, so a held mosaic shimmers; water 0.6, gold 0.4, walls 0.15), `grout` (colour), `axis`, `seed`, `style`.
- **Styles.** `style: "tesserae"` (the default) is hand-cut stone on grout. `"pixel"` lays square LCD cells and `"stitch"` lays cross-stitches (two legs, the top one catching the light) on one square grid anchored at the canvas origin, so neighbouring shapes share it, with no grout bed: the screen or the cloth shows between cells. A shape takes the cells whose centres fall inside it; with a `stroke` (or `outline: true`) its edge cells take the stroke colour, the way pixel art and samplers outline a figure. A stroke becomes a one-cell line (pixel-perfect: no doubled corners). A shape laid later takes exactly the cells it covers, with no halo. Pair `pixel` with the `handheld` treatment (`lcd` palette, stepped motion) and `stitch` with `sampler`.

Pair it with the `mosaic` treatment (palette, `backdrop: "mosaic"`, gentle motion, iris at chapter turns). Put `glow` on gold tiles (a moon, a lamp, stars). Draw hero shapes big enough for a dozen tiles across. Layouts are cached and tiles are batched by colour, so a frame of a few thousand tiles costs a handful of paths.

## Print: halftone, engraving, register and wear

Give a shape or picture `print` and it is printed the way posters, comics and newspapers were, by a process rather than a filter. Presets:

| preset | the process | settings |
|---|---|---|
| `benday` | comic tints: a fine flat dot screen | dots, cell 10, angle 15°, tone 0.3 |
| `halftone` | a newspaper screen, light at the top, dark at the bottom | dots, cell 12, angle 45°, tone 0.12 → 0.62 |
| `engraving` | banknote and woodcut lines that swell with the tone | lines, cell 7, angle −28°, tone 0.12 → 0.62 |
| `newsprint` | the 1938 comic cover: Ben-Day tint, colour off register, worn paper | dots, cell 9, angle 15°, tone 0.28, register [5, 3.5], wear 0.22 |
| `letterpress` | wood type and two-colour bills: no screen, plates apart, ink dropping out | register [7, −4.5], wear 0.35 |

Or write it out: `{screen: dots | lines | none, cell, angle, tone, axis, register: [dx, dy], wear, ink}`.

- **The screen.** The shape's `fill` is the paper or flat colour under the screen; the screen is printed on top in `ink` (default the `ink` token). `tone` is the ink coverage, 0–1: one number for a flat tint, or `[from, to]` ramped along `axis` (degrees; 90 runs top to bottom). Dots grow by area until they touch and then merge; lines thicken. The lattice is anchored at the canvas origin, so shapes printed with one screen share it, and it is clipped to the outline. A pale sky is paper with `accent2` dots (`{screen: "dots", ink: "accent2", tone: 0.25}`); a sea is a fill combed with lines (`{screen: "lines", ink: "accent", tone: [0.2, 0.7]}`).
- **Pictures.** On an `image` the screen follows the picture: each dot or line piece takes the darkness of the pixels beneath it, so a photograph or generated still becomes a newspaper halftone or an engraving in the palette's ink (the image's `fill` is the paper; `treatment: "halftone" | "engraving"` is the same with paper `bg`). Plates take the same two treatments: `plate: {asset, treatment: "halftone"}`. Footage plates are screened frame by frame.
- **Register.** `register: [dx, dy]` (pixels, up to 60) prints the colour plate (fill and screen) that far from the key plate (the `stroke`, on register): paper shows on one side of each key line and colour runs under it on the other. Give printed shapes an ink `stroke` (width 5–7) or the offset has nothing to be off from.
- **Wear.** `wear` (0–1) lets the paper through: fine specks where the grain runs high, gathered into patches where the press ran dry. Static per element, like a real impression. Text takes `print: {wear}` alone (worn wood type).
- **Canvas-wide.** `print` on the canvas (or a treatment's `beats.print`) prints every shape that has no finish of its own; frame-sized shapes (a sky, a ground) stay flat so no register shift opens an edge, and `print: false` opts a shape out (keep charts and anything people must read precisely clean).
- **Cost.** Screens are vector geometry laid once per element and cached (at most about 36,000 marks; a huge shape gets a coarser screen), so a printed scene costs about as much per frame as a flat one.

Start from `sketch benday-burst`, `woodblock-wave` or `manifesto`; the `pulp`, `woodblock` and `constructivist` treatments set a film up for them. The look comes from the *Superman in Flight* poster film (one figure through twenty art processes): see `docs/research/2026-10-superman-in-flight.md`.

## Worlds: one drawing, a travelling camera

Slides cut from one picture to the next. A world keeps one picture and moves the camera. Give consecutive canvas beats the same `world` name and a camera rect `view: [x, y, w, h]` in world coordinates:

```json
{ "id": "source", "block": "canvas", "props": { "world": "water", "view": [0, 0, 1920, 1080], "elements": [ …mountains, rain… ] } },
{ "id": "plant",  "block": "canvas", "props": { "world": "water", "view": [1500, 0, 1920, 1080], "elements": [ …the pipe, the plant… ] } },
{ "id": "whole",  "block": "canvas", "props": { "world": "water", "view": [-100, -560, 5200, 2925], "elements": [ …one line of type… ] } }
```

A world beat may draw nothing new (`elements: []`) and only move the camera over what is already there. Each beat draws only what is new, cued to its own narration; everything drawn earlier stays, still looping, on its original clock. The cut between world beats is invisible (`cut`, no exit, camera moves off), and the camera travels from the previous view to the new one over `viewDur` (1.2 s) starting at `viewAt` (0 s): pan by moving `x, y`, push in or pull out by changing `w, h`. A camera rect fills the whole frame (keep it 16:9 for landscape, 9:16 for vertical). Finish on a wide view of the whole world for the payoff. Titles, where used, sit over the world.

Camera moves land on the words: the move to a new beat's view starts in the outgoing beat's tail (once it has settled, up to 1 s early), so the camera arrives by the new line's first word or first new drawing. **When `viewAt` is omitted, `viewDur` is shortened as needed to arrive in time.** For a long, slow tracking shot (a 6 s move along a road), set `viewAt: 0` and `viewDur` explicitly. Both beats evaluate the same move across the cut. A graphic transition (`iris`, `panel`, `whip`) between two world beats cuts to the new view under its cover instead. For depth, give far layers `depth` below 1 (a distant skyline at 0.5): they follow the camera by only part of its travel, which gives parallax.

While the camera holds, it drifts in slowly (`viewDrift`, default 3% of the view), and the next move starts from there, so a world never freezes. To change the world's state under what is already drawn, such as a sky that lights up by day or a glow under the city, give the new element `behind: true`. It goes under *everything* already drawn, including an opaque sky rect. So a glow behind a solid sky is invisible: change the sky itself instead, by fading a second sky over it or by giving the sky a gradient with the glow in it. Labels that would clutter a later wide shot can leave while the camera is elsewhere: set an `exitAt` after the beat ends. Lay stations out in story order (up for the sky, down for a plan view, onward for the next stop) so the camera never re-crosses old material. `examples/night-city` shows all of this.

**Other frame shapes.** A camera rect authored for landscape is re-framed automatically for a vertical or square cut, on the beat's own foreground (ignoring backdrops, parallax and `behind` layers). That works for a single subject, like a roof or a machine part. A side-by-side composition (a map beside its labels) cannot survive the crop: give that beat `viewTall: [x, y, w, h]` (9:16), or lay the vertical cut out differently. Check with `world DIR` on the vertical project.

`clearframe world DIR` renders the whole world at its final state with every beat's camera rect outlined and numbered. Use it to lay out stations and choose views before rendering the film, and again after any change of layout.

Good worlds: a journey (source → process → destination), a timeline laid out left to right, a map zooming from region to street, a machine explored part by part, one diagram built up and then revealed whole.

## Depth: z, dolly and focus

Worlds move the camera across a plane. Depth moves it *into* the picture.

- **`z` on an element or group** sets its distance: 0 is the picture plane, 1 is twice as far, 8 is far away, and −0.5 is close to the lens. Draw every layer as it should look before the camera moves: `z` changes nothing until the camera does. When a world camera pans, far layers move less and near layers (z < 0) move more, which is real parallax without `depth` factors. When the camera dollies forward, near layers grow faster than far ones. Put `z` on top-level layers or groups: a far skyline, a midground city, foreground dust.
- **Parallax in worlds is measured from the view that drew the layer.** A `z` layer sits where it was drawn when the camera frames its own beat's view. As the camera travels, the layer slides by (camera centre − that view's centre) × z / (1 + z), vertically too. So a far layer drawn for one station drifts across a later wide shot: give it an `exitAt` before the pull-back, or draw the wide shot's background in the wide beat.
- **`dolly`** (canvas prop) flies the camera through `z`, with keys `[{say|at, z, dur, ease}]`. As the camera's z approaches an element's, the element grows past the frame and is gone once passed. Rings at z 1, 2, 3… make a tunnel, and layers of cloud make a descent. Dolly keys never hold the beat.
- **`focus`** (canvas prop) is a lens with depth of field: `{z, aperture, keys}`. Elements with `z` blur by their distance from the focus plane, where `aperture` 1 is natural and 2–3 is a long lens. Keys give a rack focus, `{"say": "gate", "z": 0}`, pulling focus from the far light to the near gate on a word. Elements without `z` are overlays and stay sharp, which is right for titles and labels.
- **`blur`** (px, 0–60) on any element, keyable (`keys: [{at, blur}]`), for hand-set focus.
- **Lit solids:** `shade: true` or `{light: [x, y, z], ambient, edges}` on a `solid` (tetra, cube, octa, icosa or dodeca) draws lit faces instead of a wireframe: a key light (toward the viewer is +z, up is −y), ambient fill, a specular glint and thin highlighted edges, in the element's `fill` colour. It suits product reveals and hero objects.
- **Charts that become each other:** `chart: {kind: "number" | "stack" | "bars", values: [{label, value, highlight, id}], box, max, suffix}` on a canvas draws the chart as shapes with ids computed from the labels. In consecutive canvas beats, the same value morphs across the cut. A headline number's bar becomes its segment of a stacked bar, and the segments stand up as bars. Heights and widths are computed from the values. Figures still need a visible `source`.
- **Generated depth plates:** declare an image asset with `layers: true` (plus `prompt` for the setting, `subject` and `foreground` as objects), run `images`, then set `"plates": "ID"` on a canvas. The far painting, the cut-out subject and the cut-out foreground stand at z 6, 1.2 and −0.35 under your drawing, with a slow push. Use `focus` to choose which plane is sharp. The subject is staged from its cut-out (base at three quarters of the frame height, with a contact shadow); add `ground: "water"` to the asset for a reflection and a waterline haze. See the `gemini-image` skill.
- **A globe:** `{"type": "solid", "shape": "globe", "size", "spin": [0, 9, 0], "tilt": [-22, 0, 0], "fill": "bg", "stroke": "muted", "marks": [[lat, lon], …], "arcs": [[lat, lon, lat, lon], …]}`. It turns about its own pole, marks appear once the graticule has drawn, and routes lift off the surface and draw on one after another. Coordinates are real places; say when the routes are illustrative.
- **`shine`** on any element: a light sweep masked to its shape, like a title catching the light. Use `true` or `{at|say, dur, color, width, angle, opacity, every}`. It shows on mid-tone or metallic fills (a `muted`→`ink` gradient); on pure white type, pair it with lens bloom instead.

```json
{ "block": "canvas", "props": {
  "dolly": [{ "at": 0.4, "z": 6, "dur": 5 }],
  "focus": { "z": 7, "aperture": 1.2, "keys": [{ "say": "home", "z": 0.5 }] },
  "elements": [
    { "type": "particles", "kind": "dust", "x": 0, "y": 0, "w": 1920, "h": 1080, "z": -0.3 },
    { "type": "group", "z": 3, "children": [ …the city… ] },
    { "type": "group", "z": 7, "children": [ …the far light… ] } ] } }
```

## Design the frame

For quantities over time, use [`props.plot`](quantitative-plots.md): comparable native lines share explicit axes, real elapsed-date spacing and one reveal clock; null observations leave gaps. Raw line/path/poly elements can set `enter: "draw", drawEase: "linear"` when a stroke must track time uniformly. Other drawing entrances retain their existing eased motion. Final values and source labels need an authored reading hold.

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

- `plate`: an image or clip `side: full|left|right|top|bottom` (tall frames stack left/right as top/bottom). `treatment: duotone|tint|mono|blur|soft|none` recolours any photo or generated still into the palette, and `halftone|engraving` prints it as a dot or line screen in the palette's ink; `drift: in|out|left|right|up|down|none`; `scrim` 0–1 keeps text readable on full plates; `focus: [x, y]` chooses the crop.
- `tone: accent|accent2|invert|surface` floods the frame with a colour and re-derives readable text colours. Use it to punctuate. A `panel` transition into an accent-tone scene reads as the panel becoming the background.
- `camera: in|out|left|right|up|down|none` or `{move, amount}`. The default `auto` pushes in gently everywhere except kinetic text and footage.
- `camera: {to: [x, y, w, h], say|at, dur}` pushes the picture from the full frame into a frame-pixel rect: a close-up on the bar, the word or the part that matters, starting on a spoken word. The heading fades as the camera moves in; the source line stays. Read coordinates off `still --beat ID --grid`.

## Reusable material art

Use `art: {sketch: "glass-orbits", seed: 17, opacity: 0.8, drift: 0.5}` beneath any block. Extra `under` elements are drawn above the generated group (outside its `opacity` and `drift`); `over` stays above the block. `seed` gives each material a different, reproducible arrangement (lens angles, petal count, fold corners, lobe direction) that keeps the copy region as clear as the reference layout; without a seed you get the atlas layout. `drift` (0–1) pushes the art in by up to 8% about the frame centre over the beat, with a small sideways travel whose direction the seed picks: a parallax move under steady copy that never holds the beat. Use about 0.5 for professional films and 0.8 for playful or arena work. Only `layer: "under"` sketches without a camera/world are eligible. For a complete canvas scene use `props.sketch`. The new materials reserve the left half or portrait top for short native copy; centred blocks may need manual placement. See [image direction](image-direction.md) and the [material atlas](design/material-studies/index.html).

For readable canvas attribution, `sourceSize` accepts 14–72 native pixels and reserves up to three lines at that size. Plots set this from frame width; other canvases keep the existing footer unless they opt in. Reserve that space in the drawing and inspect phone-size output.
