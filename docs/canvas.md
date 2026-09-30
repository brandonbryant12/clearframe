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
| `text` | `text, x, y` (first baseline), `size`, `font: display|bold|light|text|strong|figures`, `anchor: start|middle|end`, `width` (wraps and fits), `leading`, `tracking` (em), `upper`, `count: {from, to, decimals, prefix, suffix, dur}` |
| `icon` | `name` (see `clearframe icons`), `x, y` (centre), `size`; colour from `stroke` or `fill` |
| `image` | `asset` or `file`, `x, y, w, h, r`, `fit: cover|contain`, `treatment` |
| `group` | `children`, `x, y` (offset), `stagger` (seconds between children) |

Paint: `fill` and `stroke` take palette tokens (`bg, surface, ink, muted, accent, accent2, positive, negative, line, wash, wash2, none`), `#rrggbb`, or a gradient `{gradient: [2–4 colours], angle, radial, fade}`. `fade` dissolves the last stop to transparent, which gives soft glows. Tokens follow the palette and a beat's `tone`, so art never clashes. Other paint fields: `width` (stroke), `opacity`, `dash: [on, off]`, `cap`, `join`, `rotate`, `origin: [x, y]` (for rotation and scale), `blend: multiply|screen|overlay|…`.

## Time

| Field | Meaning |
|---|---|
| `say` / `at` | When the element enters: a spoken word or phrase, or scene seconds. Without either, elements follow the scene cue plus `stagger`. |
| `enter` | `fade, pop, rise, drop, left, right, grow, grow-x, grow-y, draw, wipe, wipe-up, type, blur, none`. Default: strokes `draw`, text `rise`, icons and circles `pop`, others `fade`. |
| `dur`, `dist` | Entrance seconds; travel distance. |
| `keys` | `[{say|at, dur, ease: inOut|in|out|linear|spring, x, y, scale, rotate, opacity}]`: each key starts at its time and eases from the previous state. `x, y` are offsets. |
| `along` | `{d, say|at, dur, ease, rotate}`: the element's origin travels along a path (a marker on a route, a packet through a pipe). |
| `loop` | `{type: spin|pulse|float|sway|orbit|dash|blink, period, amount}`: ambient motion after the entrance, eased in. `dash` marches a dashed stroke. `spin` with an `origin` orbits a centre. |
| `exit`, `exitSay` / `exitAt`, `exitDur` | Leave mid-scene: `fade, shrink, fall, lift, undraw, wipe, blur, none`. Use it to build, then transform: draw a problem, clear it, draw the fix. |

`check` resolves every spoken cue against the narration and fails if one is missing or lands after the beat. `settle` (when the exit may begin) waits for every entrance, count, key and path move. Loops continue. A `count` is a displayed figure: it needs a visible `source` and a `sources` entry, like any chart.

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
