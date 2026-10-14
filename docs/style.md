# Type, color, motion and graphic variety

A consistent visual language can still contain many distinct forms. Start with the content: a comparison needs aligned bars; a process needs steps; speech needs readable timed words; a mechanism or metaphor needs a drawing. Pick from the 31-block catalog (`clearframe blocks`), draw with `canvas` (see [canvas.md](canvas.md)), then choose the treatment below.

```json
{
  "theme": { "base": "midnight", "accent": "#b4bcff" },
  "motion": { "preset": "gentle", "intensity": 0.65 },
  "transition": "cut",
  "backdrop": "none",
  "texture": { "grain": 0.2, "vignette": 0.3 }
}
```

## Avoid the deck

A film is not a slide deck with narration. The usual tells: every beat the same layout, a title top-left over a static graphic, the same fade between every scene, nothing moving once it has entered, no imagery. Counter them deliberately:

- **Vary the frame.** Alternate full-bleed moments (`plate`, `tone`, kinetic `stack`, a centred statement) with dense information scenes. Two data scenes in a row want different layouts; a split `plate` beside a `stat` is a different picture from a `stat` on a colour block.
- **Draw the mechanism.** When the narration explains how or why, use `canvas` (a route, a flow, a balance, a gate) instead of a list of words.
- **Carry motion across cuts.** Keep a subject on screen through the cut (a world the camera travels, a `cast`, a shared id that morphs). Use `push` or `panel` at a turn in the story (not every cut) and `cut` for rhythm.
- **Move with purpose.** The renderer has an automatic slow push, but business/technical films use `business` (film `camera: none`, no motion blur). Hold text still for reading; animate the change being explained. Never add shake to satisfy a score.
- **Punctuate.** One or two `tone` scenes per minute, on the numbers or verdicts that matter.

## Typography

Every face is shipped with the renderer and measured with the same shaper that draws it, so wrapping, centering and fitted sizes are exact. Inter is the default, and body copy, labels, sources, captions and counters always stay in it. The film's **type voice** (`"type"` in the storyboard, usually set by the treatment's `film.type`) chooses the display family and the emphasis for titles, statements, endcards, chapters, highlights, scene headers and kinetic text, so two treatments read as two films at thumbnail size. Run `clearframe types`.

| Voice | Display face | Emphasis | Character |
|---|---|---|---|
| `inter` (default) | Inter Display 700 / 600 | accent colour (or `emphasisStyle: serif`) | Neutral, reports and explainers |
| `geometric` | Space Grotesk Light headline, Bold emphasis | weight contrast | Workplace films, keynotes, product, friendly explainers |
| `bookish` | DM Serif Display | its own italic | Histories, lessons, editorial stories |

Voices are files in `library/types/` (see `library/README.md`): a face set, an emphasis kind, `case`, `tracking` and `leading`. A beat can set its own `type`; `inter` opts back out of the film voice. The renderer receives the resolved voice in the job, so a project renders without the library that defined it.

| Role | Face | Used for |
|---|---|---|
| Display | Inter Display Bold 700 | Titles, hero numbers, chapter numerals |
| Display | Inter Display SemiBold 600 | Statements, scene titles, labels in charts and diagrams |
| Display | Inter Display Light 300 | Quotations, equation expressions |
| Figures | Inter Display Figures 700 | Every counter: Inter's designed tabular digits, so values never jitter |
| Text | Inter 400 / 600 | Supporting lines, details, sources, captions |

Display sizes use Inter's 32 pt optical master (tighter spacing, finer details); text sizes use the 14 pt master. Headlines balance their lines (no orphaned final word) and rise line by line through masks. Kickers are small uppercase eyebrows with open tracking and an accent dash.

Keep copy short. Text that still does not fit its box at 14 px fails with a scene-specific error instead of overflowing. Divide long ideas into more beats; reserve extended speech for `kinetic`.

**Emphasis.** `title`, `statement`, `chapter`, `quote`, `callout` and `endcard` accept `emphasis`: up to four whole-word phrases. How they are drawn comes from the voice (accent colour, a weight change or the family's italic); a beat's `emphasisStyle: serif | accent` overrides it. `highlight` sweeps a marker behind its `phrases`, each on its own cue. Phrases must be exact whole words of the text; validation rejects partial matches so a later edit cannot silently lose the emphasis.

Inter covers Latin, Greek, Cyrillic, arrows, math and currency symbols; the voice faces cover less, so display text is checked against the face that will draw it. `check` fails text that contains other scripts (for example CJK) and names the character, prop and face, rather than rendering empty boxes.

## Color

Fifteen palettes, each with `bg`, `surface`, `ink`, `muted`, `accent`, `accent2`, `positive` and `negative`. Run `clearframe themes` for swatches.

| Palette | Character |
|---|---|
| `meridian` | Warm paper white, deep navy type, a brick-coral accent and a sea teal. Financial services and client films. |
| `meadow` | Oat cream with a forest green accent and a soft plum. Benefits, health and wellbeing films. |
| `briefing` | Cool light grey, near-black type, a confident blue and an amber warning. Training, security and policy films. |
| `daylight` | Cool porcelain with deep teal and violet. Airy professional films. |
| `paper` | Warm off-white, ink blue accent. Calm reports and explainers. |
| `porcelain` | Porcelain paper, near-black ink, an oxblood rose and a slate teal. Editorial features, craft and culture. |
| `research-paper` | White field, charcoal observations, a burnt-orange comparison and a restrained violet second series. Research films. |
| `mono` | Black on white with a single red. Stark data and myth-busting. |
| `ink` | Deep slate with mint and amber. Night-time, technical and reflective films. |
| `midnight` | Indigo night with periwinkle and apricot. Launches, science and big ideas. |
| `blueprint` | Drafting blue with sky and amber lines. Engineering, how-it-works and diagrams. |
| `noir` | Deep black with gold and vermilion. Serious stories and premium reveals. |
| `stage` | A near-black keynote stage, white type and one electric blue: the object is lit, everything else falls away. |
| `sketchbook` | Drawing paper with graphite, red and blue pencil. Hand-drawn explainers with rough strokes and the paper backdrop. |
| `bass` | Cut paper: cream stock, black, a hot red and a deep navy. Title sequences and openers. |

**Tone** colour-blocks one scene: `"tone": "accent" | "accent2" | "invert" | "surface"` fills the frame and re-derives readable ink and accent colours for it (a test checks every palette × tone). A `panel` keeps the film's own accent on both sides of the cut.

Every preset keeps `ink`, `muted` and `accent` at ≥ 4.5:1 against `bg`, and `accent2` at ≥ 3:1 (a renderer test enforces this). Override any token with six-digit hex under `theme`; `check` warns when an override drops below those ratios. `accent2` colors a genuinely second series and donut segments; `positive`/`negative` appear only when a block states direction (`delta.better`). Color never carries meaning alone.

`looks DIR --beat ID --draft` renders the exact same frame in every palette (left to right, top to bottom; the sidecar records the order). Real and generated images keep their own colors unless a `plate` or canvas `image` sets a `treatment`: `duotone` maps luminance from the palette's darkest colour to its accent (dark palettes) or ink to paper (light), `tint` multiplies by the accent, `mono` removes colour, `blur`/`soft` defocus, and `halftone`/`engraving` print it as a dot or line screen in the palette's ink (docs/canvas.md, Print).

**Texture:** film-level `texture` adds a vignette under the scenes and fine grain over everything: `"film"`, `"grain"`, `"vignette"` or `{grain: 0–1, vignette: 0–1, animate}`. Static grain is nearly free to encode; `animate` changes it eight times a second, which looks filmic but costs bitrate.

**Backdrops:** `none`, `grid` (a faint drafting grid, as on `blueprint`) or `paper` (a fine paper texture, as on `sketchbook`). The `glow`, `dots` and `mosaic` backdrops were retired; a storyboard that names one is refused with a replacement.

## Motion

`motion.preset` sets the curve family; `intensity` (0–1) scales travel distance, so 0 keeps fades only.

| Preset | Element entrance | Character |
|---|---|---|
| `gentle` | 0.55 s, quartic ease-out | Calm, editorial |
| `snappy` | 0.30 s, exponential ease-out | Energetic, social |
| `spring` | 0.72 s, damped spring (about 7% overshoot on travel only; a `pop` never passes full size) | Friendly |

Opacity never overshoots, and values never do: counters, bars, rings and fills use non-overshooting curves and always settle on the exact authored number. `check` fails a final render when a beat ends before its numbers finish counting.

**Transitions** (`transition`, global or per beat). A film **cuts** unless told otherwise: a dip between every line is a deck of slides, and professional films cut between most shots, carrying something across (an element with the same id morphs into the next scene; a `world` lets the camera travel). For a story's turns: **`into`** (set `into: "id"` on the beat) takes the camera forward through that element of the previous canvas scene, an app screen, a page, one tile of a share, until it overfills the frame, and the new scene comes up inside it; **`push`** moves the old scene and the new one as one strip, for the next step in a sequence; **`fade`** dips briefly through the ground, for a change of chapter or of time; **`wipe`** crosses the old scene with an edge; **`panel`** sweeps an accent panel across (never in a workplace film, where it reads as a fault). `auto` fades where the chapter changes and cuts elsewhere. Captions and the source line hold still across every transition; only the pictures move. Exits mirror the next entrance (a scene before a push, a wipe or an into stays whole until the next one takes it). Override with a beat's `exit`: `auto`, `none`, `fade`, `push`, `wipe`, `panel`. Exits never start before the last spoken word of the beat or before its entrance has finished. Scenes are never cross-dissolved over each other. Retired and refused by name: `iris`, `whip`, `flash`, `dissolve`, `rise` and `zoom` (each with its replacement).

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
- **Structure:** `steps`, `timeline`, `flow`, `cycle`, `checklist` (boxes tick on cue), `matrix` (optional highlighted column), `compare`, `equation`. A set of things that persists across cuts is a canvas `cast` (`docs/cast.md`), not a list.
- **Media:** `image`/`video` plates keep their own aspect ratio in rounded masks (`fit: cover` to fill, `drift: true` for a slow push-in); `annotate` adds numbered pins, a legend and an optional focus region to a screenshot.
- **Speech:** `kinetic` highlight/reveal/word modes, and `stack`: poster type that builds word by word as spoken, `emphasis` words larger in the accent, phrases breaking at sentences. Captions (on by default) are broadcast-standard: two lines at most, white on a translucent dark box, timed to the words (`docs/speech.md`).
- **Drawing:** `canvas` for anything else: routes, systems, metaphors, custom diagrams and typographic moments; `art` layers to annotate any block. Start from `clearframe sketch`.

`flow`, `cycle`, `callout`, `waffle` and canvas `icon` elements use the 132 bundled MIT Tabler icons (`clearframe icons`). Portrait flows stack vertically. `breathing` uses explicit `{label, seconds, scale}` phases with cross-faded labels; adapt the pace to the viewer and do not infer health benefits.

## Review

`gallery DIR --theme NAME [--vertical]` renders every block for a quick vocabulary review. `still --beat ID --pos 0.6` checks one moment in detail; `sheet` gives the whole film; `review DIR` decodes the encoded MP4 around every cut and word boundary. Scene counters never appear in film output; optional `chrome` adds only a title and progress rail.
