# The ClearFrame library

Everything creative that is not engine code lives here, one file per item. To add an idea, add a file. There is no registry to edit.


| Folder | One file is | Used by |
|---|---|---|
| `palettes/` | eight colours with readable contrast | `theme` in a storyboard, `themes`, `looks` |
| `treatments/` | a complete art direction: look, motion, voice, sound and rules | `new --treatment`, `ingest --treatment`, `treatments` |
| `sketches/` | a starting canvas composition for a mechanism | `sketch NAME`, playbook beats, `gallery --sketches` |
| `playbooks/` | a narrative arc: beats with blocks, sample props and voice-over | `new --playbook`, `playbooks` |
| `directions/` | optional source-aware story, picture and pace guidance plus playbook/treatment defaults | `directions`, `new/start/ingest --direction` |
| `types/` | a type voice: the display family and emphasis for titles, statements, chapters, endcards and kinetic text | `type` in a storyboard or a treatment's `film`, `types` |
| `sculptures/` | trusted built-in JSON brief + Python scene recipe for an original offline 3D insert | `sculptures`, `sculpture ID --out NEW-DIR` |

The file name is the id (`library/palettes/noir.json` is `noir`). Files starting with `_` are ignored, so `_draft.json` stays out of listings. `order` sets the listing position. Items without it sort after the numbered ones, by id.

The native creative catalog is validated when the engine starts, so a bad file fails immediately and names itself. Run `node --test test/library.test.mjs` after adding one. Optional sculptures validate when listed or rendered and are deliberately outside shared/project JSON loading; external library data never executes Python. See [sculptures](../docs/sculptures.md).

`dimensional-kpis` is an editable native playbook, with no prepared media or Blender dependency. Its `canvas.props.kpi` values generate fixed-depth geometry and native type. See the [form, data and motion guide](../docs/kpi-direction.md) when choosing between flat graphics, native dimensional KPIs and true 3D inserts.

## Directions

Directions help choose a starting form; they never constrain what a storyboard may contain. The built-ins combine story and visual grammar for research and podcasts. The `materials` tags filter suggestions and can use your own terms. `--playbook`, `--treatment` and `--theme` override the suggested defaults independently. A brand kit retains its own palette/type rules.

Add `library/directions/my-idea.json` to a shared library, then use `--library DIR --direction my-idea`:

```json
{
  "title": "A new way to see the system",
  "when": "The source has a hidden connection worth revealing.",
  "materials": ["research", "podcast"],
  "playbook": "concept-explainer",
  "treatment": "blueprint",
  "story": "Start at the consequence, follow the cause, return with a changed understanding.",
  "picture": "Draw a new spatial mechanism around the source's actual objects.",
  "pace": "Open quickly, slow down to inspect, reveal the connection at the turn.",
  "rules": ["Keep uncertainty visible; never invent a causal relationship."]
}
```

`title`, `when`, `materials`, `playbook`, `treatment`, `story`, `picture`, `pace` and `rules` are required. `order` is optional. References are validated against the active library. Custom direction dependencies are copied with the project, even when a default is overridden. There is no engine registry or finite set of direction IDs to edit.

`DIRECTION.md` records the guidance for the agent. The agent still reads the source, chooses the argument and authors the actual pictures. Recording imports begin with kinetic captions and preserve audio and timing; the profile's playbook is a visual reference. A profile does not automatically map source nouns to unrelated stock scenes. Draw original native canvas elements or add JSON sketches when a preset does not fit. See [source adaptation](../docs/source-playbooks.md).

## Palettes

```json
{
  "order": 16,
  "notes": "One line: what it looks like and what it suits.",
  "colors": { "bg": "#0b1f33", "surface": "#14304d", "ink": "#f5f7fa", "muted": "#a9b8c9",
              "accent": "#ffb000", "accent2": "#4fd1c5", "positive": "#6ee7a8", "negative": "#ff8a80" }
}
```

- All eight colours are required, as `#rrggbb`.
- The loader rejects poor contrast against `bg`:
  - `ink`, `muted` and `accent` need at least 4.5:1;
  - `accent2` needs at least 3:1.
- This folder is the only copy of the palettes. The renderer receives resolved colours in each job and keeps only a paper fallback.

## Treatments

```json
{
  "order": 10,
  "title": "Quiet lesson",
  "when": "Wellbeing, reflective stories, gentle tutorials",
  "film": { "theme": "forest", "type": "bookish", "backdrop": "glow", "motion": { "preset": "gentle", "intensity": 0.35 },
            "transition": "fade", "sfx": "off", "voice": { "style": "soft, slow, reassuring" } },
  "beats": { "graphic": "fade", "emphasisStyle": "serif", "rough": 0.6, "kinetic": "words", "font": "mono", "fps": 12, "mosaic": {} },
  "rules": ["Short imperative rules the author should follow."]
}
```

- `film` holds storyboard-level settings, copied onto the storyboard. `film.theme` must name a palette; `film.type` (optional) names a type voice, and is what keeps two treatments from reading as the same brand.
- `beats` holds defaults applied only where the author has not set them. `rough: false` strips pencil strokes that an arc was scaffolded with; the film looks use it. Every key is optional:
  - `graphic`: the transition used at chapter starts;
  - `emphasisStyle`: `serif` or `accent` for title, statement and endcard, an explicit choice that overrides the voice's emphasis;
  - `rough`, `mosaic`, `print`, `font` and `fps`: for canvas;
  - `kinetic`: the kinetic mode.
- `rules` end up in the project's `DIRECTION.md`.
- `playbook` (optional) names the arc this look is made for. `new --treatment ID` and `ingest --treatment ID` start from it when no `--playbook` is given; for example, `cinematic` starts from `cinematic-explainer`.

## Types

```json
{
  "order": 2,
  "title": "Didone editorial",
  "when": "Keynotes, premieres, fashion, culture and brand films that want magazine authority",
  "display": "playfair", "emphasis": "italic", "case": "mixed", "tracking": -0.01, "leading": 0.98
}
```

- `display` names a bundled face set: `inter` (the default), `playfair` (Playfair Display Bold + italic, lining figures), `archivo-wide` (Archivo Expanded ExtraBold), `space-grotesk` (Bold + Light), `big-shoulders` (Big Shoulders Display ExtraBold), `bebas`, `dm-serif` (+ italic), `instrument-serif` (+ italic), `plex-mono`, `architects`.
- `emphasis` says how `emphasis` phrases are drawn: `accent` (colour), `serif` (italic Instrument Serif, the editorial feeling word), `italic` (the family's own italic; the loader rejects it for a family without one), `weight` (a light headline with the phrase in bold; needs a light weight), `marker` (an accent block behind the phrase, ink in the background colour) or `underline` (an accent rule). A beat's own `emphasisStyle: serif | accent` still wins.
- `case: upper` sets titles, statements, endcards, chapter titles and kinetic stacks in capitals (scene headers stay mixed). `tracking` is letter-spacing in em (−0.1 to 0.3); `leading` multiplies each block's line height (0.8 to 1.3).
- The voice reaches titles, statements, endcards, chapters, highlights, scene headers and kinetic text. Body copy, labels, sources, captions and counters stay in Inter (counters need its tabular figures). Display text is glyph-checked against the voice's face before rendering.
- Built-ins: `inter`, `didone`, `wide`, `geometric`, `condensed`, `bookish`, `typewriter`. Run `clearframe types`. A storyboard sets `"type": "didone"`; a beat can set its own `type` (`inter` opts back out). The job carries the resolved voice, so a project renders without the library that defined it, and `new` copies a shared voice into the project like a palette.

## Sketches

A sketch is canvas props (`elements`, and optionally `world`). There are two ways to write one:

- **JSON (any library).** Give fixed `elements`, or one variant per frame shape:
  ```json
  { "order": 9, "summary": "Logo with orbiting marks", "use": "brand openers",
    "formats": { "landscape": { "elements": [ … ] }, "vertical": { "elements": [ … ] } } }
  ```
  - The shape keys are `landscape`, `vertical`, `square` and `portrait`.
  - A missing shape falls back to `vertical` or `landscape`, whichever matches the frame's orientation.
- **Module (built-ins only).** A `.mjs` file exports `{ name, order, summary, use, build(w, h) }` and lays out from the frame size. The helpers in `fframes/sketch-kit.mjs` are:
  - `body`: the safe content box;
  - `round`;
  - `tall`;
  - `smoothPath`;
  - `frames`.

A sketch should draw a mechanism, a place or a purposeful material composition, not a slide. Background sketches declare `layer: "under"` and can be used in any storyboard as `art: {sketch: "paper-fold", seed: 17, opacity: 0.8, drift: 0.5}`. Authored `under` additions and `over` layers are preserved. A material sketch reads `seed` from `build(w, h, {seed})` through `jitter(seed)` in `_material-kit.mjs`: zero without a seed, so the reference layout never changes, and small enough to keep the copy region clear. Scene cameras/worlds belong in `props.sketch`, not background art. Built-in parametric art redraws at the actual frame dimensions; project JSON art uses its authored coordinates. See `docs/image-direction.md` for imagegen-inspired deterministic design and `docs/design/material-studies/index.html` for the atlas. Read `skills/clearframe-canvas/SKILL.md` before writing one.

## Playbooks

```json
{
  "order": 29,
  "title": "What the film does, in one line",
  "audience": "Who it is for",
  "inputs": "What the author must bring",
  "theme": "paper", "motion": "gentle", "backdrop": "glow", "format": "landscape",
  "beats": [
    { "id": "hook", "block": "statement", "vo": "…", "props": { "text": "…" } },
    { "id": "how", "block": "canvas", "vo": "…", "props": { "sketch": "pipeline", "elements": [ … ] } }
  ],
  "note": "Optional advice written into BRIEF.md."
}
```

- Each beat is a storyboard beat. Its `props` are checked against the block when a project is made.
- A canvas beat can name a sketch instead of listing elements: `"props": {"sketch": "tunnel"}` draws it when the project is made, together with the sketch's own camera (`view`, `viewFrom`, `dolly`, `focus`). Any of those set on the beat win. `"sketchText": {"TITLE": "SIGNAL"}` replaces a sketch's placeholder type. Vertical films redraw every sketch beat for the tall frame.
- A playbook can set the film's look: `theme`, `motion`, `backdrop`, `texture`, `lens`, `camera` (the default for beats without their own; `none` for a steady film), `heading`, `textMotion` and `transition`. A treatment applied on top still wins.
- Optional `sources` holds `claim`/`source` entries (with `asOf` when useful), or `id`/`title` entries. They are copied intact into a scaffold, so a playbook can preserve its illustrative assumptions and arithmetic.
- Sample figures must be marked as illustrative, with `source: "Illustrative sample data · replace before publishing"`.
- A playbook is a starting structure, not a template to fill in. Keep it to the arc and let the author adapt it.

## Layers: project and shared libraries

The engine looks for items in three places. A later layer wins by id.

1. **Built-ins:** this folder.
2. **Shared libraries:** folders named in `CLEARFRAME_LIBRARY`, separated by `:`, or given with `--library DIR`. Use these for a brand kit, a team's templates, or an agent workspace's house style. Each folder has the same `palettes/`, `treatments/`, `sketches/`, `playbooks/`, `types/` and `directions/` layout.
3. **The project:** `library/` inside a video project. Commands load it automatically with the storyboard.

Rules for layers:

- Items outside this folder must be JSON. A shared or project library is data and never runs code.
- `clearframe new` (and `ingest --markdown`) copies any shared palette, treatment or `art.sketch` it uses into the new project's `library/`, so the project renders without the shared library. A playbook's `art: {sketch, seed, opacity, drift}` stays as shorthand in the new storyboard and expands when the job compiles, at the final frame size and beat duration.
- To change a built-in for one project, drop a file with the same id into the project's `library/`. To change it for everyone, edit it here.

## Library or engine?

| Put it in the library | Put it in the engine |
|---|---|
| A new colour scheme, a house style, a new narrative arc | A new element type, effect or block (`fframes/native/src`, `fframes/catalog.mjs`) |
| A composition of existing elements (a sketch) | A new validation or timing rule (`fframes/job.mjs`, `engine/lib/critique.mjs`) |
| Defaults and rules that express a look | Behaviour every film needs |

If an idea needs code only to arrange existing elements, write a built-in sketch module. If it needs the renderer to draw something new, it belongs in the engine. After that, add a library item that shows it off.

The `business` treatment sets the film camera to `none` (a default for every beat without its own) while preserving authored moves. `pr-walkthrough` carries editable `props.diagram` sources whose shared node ids morph from beat to beat; the `architecture`, `component-change` and `state-machine` sketches expose their `diagram` so `clearframe sketch NAME` prints it, and a playbook beat that names one keeps the diagram declarative. See [system diagrams](../docs/system-diagrams.md).
