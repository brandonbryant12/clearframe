# Type, color, motion and graphic variety

A consistent visual language can still contain many distinct forms. Start with the content: a comparison needs aligned bars; a process needs steps; speech needs readable timed words. Pick from the 32-block catalog (`clearframe blocks`), then choose the treatment below.

```json
{
  "theme": { "base": "midnight", "accent": "#b4bcff" },
  "motion": { "preset": "gentle", "intensity": 0.65 },
  "transition": "fade",
  "backdrop": "glow",
  "captions": false
}
```

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

Eight palettes, each with `bg`, `surface`, `ink`, `muted`, `accent`, `accent2`, `positive` and `negative`. Run `clearframe themes` for swatches.

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

Every preset keeps `ink`, `muted` and `accent` at ≥ 4.5:1 against `bg`, and `accent2` at ≥ 3:1 (a renderer test enforces this). Override any token with six-digit hex under `theme`; `check` warns when an override drops below those ratios. `accent2` colors a genuinely second series and donut segments; `positive`/`negative` appear only when a block states direction (`delta.better`). Color never carries meaning alone.

`looks DIR --beat ID --draft` renders the exact same frame in all eight palettes (4 × 2, left to right, top to bottom; the sidecar records the order). Real and generated images keep their own colors.

**Backdrops:** `none`, `dots`, `grid`, or `glow` — two broad accent light pools that drift very slowly across the whole film. Glow suits the dark palettes especially; it is a pure function of time, so it never flickers between frames.

## Motion

`motion.preset` sets the curve family; `intensity` (0–1) scales travel distance, so 0 keeps fades only.

| Preset | Element entrance | Character |
|---|---|---|
| `gentle` | 0.55 s, quartic ease-out | Calm, editorial |
| `snappy` | 0.30 s, exponential ease-out | Energetic, social |
| `spring` | 0.72 s, damped spring (≈ 8% overshoot on position only) | Playful, friendly |

Opacity never overshoots, and values never do: counters, bars, rings and fills use non-overshooting curves and always settle on the exact authored number. `check` fails a final render when a beat ends before its numbers finish counting.

**Entrances** (`transition`, global or per beat): `cut`, `fade`, `rise`, `wipe`, `push`, `zoom`. **Exits** mirror the next scene's entrance automatically — a scene before a push slides away, one before a wipe wipes off, one before a cut simply cuts — and the final scene fades out. Override with a beat's `exit`: `auto`, `none`, `fade`, `push`, `zoom`, `wipe`. Exits never start before the last spoken word of the beat or before its entrance has finished. Scenes are never cross-dissolved over each other; each enters over the persistent backdrop.

Inside a scene, elements are choreographed: headlines rise line by line, accent bars draw, cards and badges pop, rails and connectors draw between arrivals, count-ups run in step with the bars or arcs they describe, and held hero text drifts in by 1–2% so a long hold never looks frozen.

**Cues.** `land`, `growSay`, `drawSay`, item/node/pin/phrase `say` and bar `focus.say` take an exact spoken word or phrase, or local seconds. A missing spoken cue fails. Automatic spacing of staged items compresses to finish inside the beat; an authored cue too late to finish its entrance fails with an actionable message rather than being hidden.

## Graphic variety

- **Openers and dividers:** `title`, `chapter` (oversized numeral, sweeping rule), `statement`.
- **Words that matter:** `highlight` (marker sweeps), `emphasis` on hero text, `quote`, `callout` (card with optional icon badge).
- **Numbers:** `stat`, `kpis` (cards), `delta` (counts from the old value; change chip), `bars`, `line`, `waffle` (optionally `icon: "user"` pictograms), `ring`, `donut`, `funnel` (derived step rates), `magnitude` (area-true squares).
- **Structure:** `steps`, `timeline`, `flow`, `cycle`, `icon-grid`, `checklist` (boxes tick on cue), `matrix` (optional highlighted column), `compare`, `list`, `equation`.
- **Media:** `image`/`video` plates keep their own aspect ratio in rounded masks (`fit: cover` to fill, `drift: true` for a slow push-in); `annotate` adds numbered pins, a legend and an optional focus region to a screenshot.
- **Speech:** `kinetic` highlight/reveal/word modes; burned captions sit on a soft plate for legibility.

`icon-grid`, `flow`, `cycle`, `callout` and `waffle` use the 95 bundled MIT Tabler icons (`clearframe icons`). Portrait flows stack vertically. `breathing` uses explicit `{label, seconds, scale}` phases with cross-faded labels; adapt the pace to the viewer and do not infer health benefits.

## Review

`gallery DIR --theme NAME [--vertical]` renders every block for a quick vocabulary review. `still --beat ID --pos 0.6` checks one moment in detail; `sheet` gives the whole film; `review DIR` decodes the encoded MP4 around every cut and word boundary. Scene counters never appear in film output; optional `chrome` adds only a title and progress rail.
