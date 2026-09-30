# Type, color, motion and graphic variety

A consistent visual language can still contain many distinct forms. Start with the content: a comparison needs aligned bars; a process needs steps; speech needs readable timed words; a mechanism or metaphor needs a drawing. Pick from the 33-block catalog (`clearframe blocks`), draw with `canvas` (see [canvas.md](canvas.md)), then choose the treatment below.

```json
{
  "theme": { "base": "midnight", "accent": "#b4bcff" },
  "motion": { "preset": "gentle", "intensity": 0.65 },
  "transition": "fade",
  "backdrop": "glow",
  "texture": { "grain": 0.4, "vignette": 0.5 },
  "captions": false
}
```

## Avoid the deck

A film is not a slide deck with narration. The usual tells: every beat the same layout, a title top-left over a static graphic, the same fade between every scene, nothing moving once it has entered, no imagery. Counter them deliberately:

- **Vary the frame.** Alternate full-bleed moments (`plate`, `tone`, kinetic `stack`, a centred statement) with dense information scenes. Two data scenes in a row want different layouts; a split `plate` beside a `stat` is a different picture from a `stat` on a colour block.
- **Draw the mechanism.** When the narration explains how or why, use `canvas` (a route, a flow, a balance, a network) instead of a list of words.
- **Carry motion across cuts.** Use `panel`, `iris` or `whip` at a turn in the story (not every cut); `cut` for rhythm; `push` for sequence.
- **Never freeze.** Every scene has a slow camera by default; add a loop to the subject, a drifting plate, or ambient art under held text.
- **Punctuate.** One or two `tone` scenes per minute, on the numbers or verdicts that matter.

## Typography

Everything is set in Inter, shipped with the renderer and measured with the same shaper that draws it, so wrapping, centering and fitted sizes are exact.

| Role | Face | Used for |
|---|---|---|
| Display | Inter Display Bold 700 | Titles, hero numbers, chapter numerals |
| Display | Inter Display SemiBold 600 | Statements, scene titles, labels in charts and diagrams |
| Display | Inter Display Light 300 | Quotations, equation expressions |
| Figures | Inter Display Figures 700 | Every counter: Inter's designed tabular digits, so values never jitter |
| Text | Inter 400 / 600 | Supporting lines, details, sources, captions |

Display sizes use Inter's 32 pt optical master (tighter spacing, finer details); text sizes use the 14 pt master. Headlines balance their lines (no orphaned final word) and rise line by line through masks. Kickers are small uppercase eyebrows with open tracking and an accent dash.

Keep copy short. Text that still does not fit its box at 14 px fails with a scene-specific error instead of overflowing. Divide long ideas into more beats; reserve extended speech for `kinetic`.

**Emphasis.** `title`, `statement`, `chapter`, `quote`, `callout` and `endcard` accept `emphasis`: up to four whole-word phrases drawn in the accent color. `highlight` sweeps a marker behind its `phrases`, each on its own cue. Phrases must be exact whole words of the text; validation rejects partial matches so a later edit cannot silently lose the emphasis.

The bundled fonts cover Latin, Greek, Cyrillic, arrows, math and currency symbols. `check` fails text that contains other scripts (for example CJK) and names the character and prop, rather than rendering empty boxes.

## Color

Sixteen palettes, each with `bg`, `surface`, `ink`, `muted`, `accent`, `accent2`, `positive` and `negative`. Run `clearframe themes` for swatches.

| Palette | Character |
|---|---|
| `paper` | Warm off-white, ink blue accent. Calm reports and explainers. |
| `ink` | Deep slate with mint and amber. Night-time, technical and reflective films. |
| `editorial` | Newsprint cream with brick red and teal. Stories, essays and culture. |
| `signal` | Cool paper with strong blue. Product, data and operational updates. |
| `midnight` | Indigo night with periwinkle and apricot. Launches, science and big ideas. |
| `forest` | Deep green with lime and gold. Nature, food, travel and sustainability. |
| `ember` | Charred brown with coral and saffron. Warm personal stories and culture. |
| `mono` | Black on white with a single red. Stark data, manifestos and myth-busting. |
| `pop` | Poster yellow with crimson and cobalt. Loud social cuts, launches and bold claims. |
| `electric` | Near-black with neon mint and magenta. Tech, culture, nightlife and energy. |
| `blueprint` | Drafting blue with sky and amber lines. Engineering, how-it-works and diagrams. |
| `clay` | Terracotta paper with rust and teal. Craft, history, food and warm documentary. |
| `noir` | Cinema black with gold and vermilion. Drama, true stories, premium reveals. |
| `sketchbook` | Drawing paper with graphite, red and blue pencil. Hand-drawn explainers with rough strokes and the paper backdrop. |
| `mosaic` | Ultramarine ground with ivory, gold, coral and turquoise tesserae. Films laid in tiles, with the mosaic backdrop. |
| `neon` | Near-black with lime and mint. Tech brands, launches and sizzle reels: wireframe solids, starfields and glow. |

**Tone** colour-blocks one scene: `"tone": "accent" | "accent2" | "invert" | "surface"` fills the frame and re-derives readable ink and accent colours for it (a test checks every palette × tone). Graphic transitions keep the film's own accent on both sides of the cut.

Every preset keeps `ink`, `muted` and `accent` at ≥ 4.5:1 against `bg`, and `accent2` at ≥ 3:1 (a renderer test enforces this). Override any token with six-digit hex under `theme`; `check` warns when an override drops below those ratios. `accent2` colors a genuinely second series and donut segments; `positive`/`negative` appear only when a block states direction (`delta.better`). Color never carries meaning alone.

`looks DIR --beat ID --draft` renders the exact same frame in every palette (left to right, top to bottom; the sidecar records the order). Real and generated images keep their own colors unless a `plate` or canvas `image` sets a `treatment`: `duotone` maps luminance from the palette's darkest colour to its accent (dark palettes) or ink to paper (light), `tint` multiplies by the accent, `mono` removes colour, `blur`/`soft` defocus.

**Texture:** film-level `texture` adds a vignette under the scenes and fine grain over everything: `"film"`, `"grain"`, `"vignette"` or `{grain: 0–1, vignette: 0–1, animate}`. Static grain is nearly free to encode; `animate` changes it eight times a second, which looks filmic but costs bitrate.

**Backdrops:** `none`, `dots`, `grid`, or `glow` — two broad accent light pools that drift very slowly across the whole film. Glow suits the dark palettes especially; it is a pure function of time, so it never flickers between frames.

## Motion

`motion.preset` sets the curve family; `intensity` (0–1) scales travel distance, so 0 keeps fades only.

| Preset | Element entrance | Character |
|---|---|---|
| `gentle` | 0.55 s, quartic ease-out | Calm, editorial |
| `snappy` | 0.30 s, exponential ease-out | Energetic, social |
| `spring` | 0.72 s, damped spring (≈ 8% overshoot on position only) | Playful, friendly |

Opacity never overshoots, and values never do: counters, bars, rings and fills use non-overshooting curves and always settle on the exact authored number. `check` fails a final render when a beat ends before its numbers finish counting.

**Entrances** (`transition`, global or per beat): `auto` (a `rise` where the chapter changes, a `fade` elsewhere), `cut`, `fade`, `rise`, `wipe`, `push`, `zoom`, and three graphic transitions that carry one movement across the cut: `panel` (an accent panel with a second-accent edge sweeps across and off), `iris` (an accent circle closes the scene and opens the next) and `whip` (a fast horizontal move with motion blur). **Exits** mirror the next scene's entrance automatically: a scene before a push slides away, one before a wipe wipes off, one before a cut simply cuts, one before a panel is covered by it. The final scene fades out. Override with a beat's `exit`: `auto`, `none`, `fade`, `push`, `zoom`, `wipe`, `panel`, `iris`, `whip`. Exits never start before the last spoken word of the beat or before its entrance has finished; when the outgoing scene has no room to finish a graphic cover, `check` warns and uses a fade. Scenes are never cross-dissolved over each other.

**Camera:** every scene gets a slow move (`camera: auto` pushes in gently, except kinetic text and footage). Set `camera` per beat to `in`, `out`, `left`, `right`, `up`, `down` or `none`, or `{move, amount: 0–1}`. Plates drift independently of the content, which gives parallax.

**Plates:** a beat's `plate` puts an image or clip full-bleed behind the block (`side: full`, with a readability `scrim`) or on one side of a split frame (`left`/`right`; tall frames stack them as `top`/`bottom`), opening from the seam as the scene enters. See [canvas.md](canvas.md).

**Headings** (`heading`, film default or per beat): `top` puts a scene's kicker and title above the picture; `bottom` sets them as a lower third under it, with a short accent rule, the way documentaries caption a shot. Alternate the two, and drop the title entirely where the picture speaks, so scenes do not all share one template. Drawings in frame pixels must stay above the lower third (use `view: "auto"`); `critique` warns when they do not.

**Text motion** (`textMotion`, film default or per beat) sets how display type arrives: `lines` (default, each line rises through a mask), `words` (word by word), `letters` (letter by letter) or `cascade` (letters drop in with a small alternating tilt). The whole reveal is capped near 0.9 s. Body copy, labels and list items keep the line rise. Use `words` for editorial energy, `letters`/`cascade` for a hook or a single loud word; keep one mode per film and override it for one or two moments.

Inside a scene, elements are choreographed: headlines rise line by line, accent bars draw, cards and badges pop, rails and connectors draw between arrivals, and count-ups run in step with the bars or arcs they describe. `title`, `statement`, `endcard`, `chapter`, `highlight` and `stat` take `align: "center"` for a centred composition.

**Pacing.** The picture never waits for the voice: something lands by the first spoken word of every scene. When every drawing in a scene is cued to late words, the engine pulls the first one forward to the first word. Number blocks (`stat`, `delta`, `ring`, `waffle`) enter with the voice while their count still lands on its word. `check` reports each case; set `pace: "hold"` on a beat for a deliberate wait.

**Cues.** `land`, `growSay`, `drawSay`, item/node/pin/phrase `say` and bar `focus.say` take an exact spoken word or phrase, or local seconds. A missing spoken cue fails. Automatic spacing of staged items compresses to finish inside the beat; an authored cue too late to finish its entrance fails with an actionable message rather than being hidden.

## Graphic variety

- **Openers and dividers:** `title`, `chapter` (oversized numeral, sweeping rule), `statement`.
- **Words that matter:** `highlight` (marker sweeps), `emphasis` on hero text, `quote`, `callout` (card with optional icon badge).
- **Numbers:** `stat`, `kpis` (cards), `delta` (counts from the old value; change chip), `bars`, `line`, `waffle` (optionally `icon: "user"` pictograms), `ring`, `donut`, `funnel` (derived step rates), `magnitude` (area-true squares).
- **Structure:** `steps`, `timeline`, `flow`, `cycle`, `icon-grid`, `checklist` (boxes tick on cue), `matrix` (optional highlighted column), `compare`, `list`, `equation`.
- **Media:** `image`/`video` plates keep their own aspect ratio in rounded masks (`fit: cover` to fill, `drift: true` for a slow push-in); `annotate` adds numbered pins, a legend and an optional focus region to a screenshot.
- **Speech:** `kinetic` highlight/reveal/word modes, and `stack`: poster type that builds word by word as spoken, `emphasis` words larger in the accent, phrases breaking at sentences. Burned captions sit on a soft plate for legibility.
- **Drawing:** `canvas` for anything else: routes, systems, metaphors, custom diagrams and typographic moments; `art` layers to annotate any block. Start from `clearframe sketch`.

`icon-grid`, `flow`, `cycle`, `callout` and `waffle` use the 95 bundled MIT Tabler icons (`clearframe icons`). Portrait flows stack vertically. `breathing` uses explicit `{label, seconds, scale}` phases with cross-faded labels; adapt the pace to the viewer and do not infer health benefits.

## Review

`gallery DIR --theme NAME [--vertical]` renders every block for a quick vocabulary review. `still --beat ID --pos 0.6` checks one moment in detail; `sheet` gives the whole film; `review DIR` decodes the encoded MP4 around every cut and word boundary. Scene counters never appear in film output; optional `chrome` adds only a title and progress rail.
