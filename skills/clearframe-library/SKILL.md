---
name: clearframe-library
description: Choose and combine 31 blocks plus native GPU stages, canvas sketches, beat layers (plate, tone, camera, art) and adaptable narrative playbooks. Use for graphic selection, palette and motion variation, charts, diagrams, drawings, media plates, kinetic text and native library extensions.
---

# Native visual library

Search everything in plain words first: `node engine/cli.mjs find "what you want to show"` returns a short mixed shortlist (blocks, sketches, playbooks, looks, cast shapes and moves, mechanisms, examples), and `find --id KIND:NAME` the exact authoring; `docs/library-index.md` is the whole index, and the `clearframe-inspiration` skill turns a brief into concepts with it. Then run `node engine/cli.mjs blocks`, `blocks NAME`, `sketch`, `playbooks`, `themes`, `motions` and `icons`. The exact prop reference is [references/blocks.md](references/blocks.md), generated from `film/catalog.mjs`. Starter storyboards live in `recipes/` and are generated from the playbooks.

Palettes, treatments, type voices, sketches and playbooks are files in `library/`, one per item. Read [library/README.md](../../library/README.md) before adding one: a new look, arc or composition is a new file, not engine code. A project's own `library/` overrides built-ins by id. So does a shared brand kit passed with `--library DIR`. Those layers are JSON only.

Choose the visual by the task:

| Task | Blocks |
|---|---|
| Establish an idea | title, statement, chapter, callout, quote, endcard |
| Make key words land | highlight (marker sweeps), `emphasis` on hero text |
| Show a number/change | stat, kpis, delta |
| Explain a change through its drivers (revenue, cost or profit bridge) | canvas `props.bridge` (docs/bridge.md) |
| Compare quantities/shares/trends | bars, waffle (or icon pictogram), ring, donut, line, funnel |
| Compare orders of magnitude | magnitude |
| Explain a process/relation | steps, timeline, equation, flow, cycle |
| A paced visual (breathing) | breathing |
| Walk through a routine, or summarize | checklist |
| Compare choices | compare, matrix |
| Ground a story in imagery | a beat `plate` (full or split, palette `treatment`), image, video, annotate |
| Follow spoken words | kinetic (highlight, reveal, word; `stack` for poster type) |
| Explain a mechanism, metaphor or system | canvas (start from `sketch`: route, pipeline, balance, versus, architecture) |
| A workplace or money fact (a match, vesting, a deadline, a yearly limit, use-it-or-lose-it, an app step, a phishing tell, two plans, a paycheck split) | the workplace sketches `match`, `vesting`, `deadline`, `limit`, `expire`, `portal`, `inspect`, `choose`, `split`, plus `hold`, `growth`, `week`, `lookback`, `compose`, `drawdown`; see `clearframe-workplace` |
| A document, form or screen people must act on | canvas `document` (the policy's own words, scrolled to the clause), `marks` on its words (highlight, underline, circle, box, strike, cross; `stamp` with a `label` for a verdict such as PAID), `pointer` pressing controls by id; `examples/fsa-deadline` |
| Explain how or why something behaves | canvas `graph` (an input changes an output), `accumulate` (small amounts add up), `estimate` (noisy evidence settles; simulated), `field` (where things flow); the `explanation` treatment; `clearframe-explain` |
| A story move in one composition, cued to the voice (`sketchText` and `sketchSay`) | `searchlight` (discovery, a hidden cause), `untangle` (simplification), `shortcut` (fewer steps, faster), `bridge` (integration), `maze` (guidance), `vault` (security), `cut-paper` (built from pieces) |
| Point at something in any scene | beat `art.over` (arrows, circles, labels placed with `still --grid`) |
| Punctuate a turn or a number | `tone: accent`, a `push` or `panel` transition, centred `align` |
| Product and launch pieces | canvas `sketch`: `chat` (a conversation on a floating phone), `device` (a window swinging in over a sky); the `product-reveal` playbook and `keynote` treatment |
| A distinct typographic voice | the treatment's `film.type` (or storyboard `type`): `inter` (the default), `geometric`, `bookish`; `types` lists them. Emphasis follows the voice (accent colour, weight, italic); `emphasisStyle: serif` on a beat still wins |
| Hand-drawn or printed matter | `rough` strokes (the `sketchbook` treatment), the `cutpaper` treatment; `print` (halftone, engraving, letterpress) where the subject is printed matter, and plate `treatment: halftone` |

Playbooks have different narrative arcs, audiences and required evidence. Adapt and combine them rather than stretching a mismatched structure. The sample claims/quotations are labelled illustrative; replace them before publishing. For real UI demonstrations use approved screenshots or recordings: `annotate` pins the reading order onto a screenshot; the `portal` sketch or a canvas `pointer` draws the step in the app when no capture exists.

Financial explanations have dedicated arcs: `cash-flow` follows payment availability into a reconciled sample cash balance; `scenario-lab` compares possible outcomes on one explicit basis; `client-update` tells clients the quarter calmly. Their native sketches are `cash-lock` (a clearing gate), `scenario-fork` (labelled possible paths, also split into `scenario-origin` and `scenario-outcomes` for a camera world). They adapt to landscape and vertical scaffolds; the drawings are qualitative and do not encode amounts or probabilities. Keep the sample's `sources`, narration and visible figures consistent when replacing the data. Read [financial-playbooks.md](../../docs/financial-playbooks.md) for evidence requirements and demo commands.

Research and podcast sources do not imply one style. `research-digest` explores evidence inside a continuous illustrated world; the `research-evidence` direction stays on the report's own page (a canvas `document` with `marks` on the words that make each claim). The `podcast-picture` direction gives each idea its own small drawing; the `podcast-clip` playbook has a faster typographic arc. Treat these as editable examples: invent new scenes, combine arcs and change the picture, edit and pace to fit the source. Keep exact claims and citations for research, and exact recorded words, speaker identity and measured timing for podcasts. Never assign the sample script to a real speaker. Read [source-playbooks.md](../../docs/source-playbooks.md).

Layers combine with any block: `plate` (image/clip behind or beside), `tone` (colour-blocked scene), `camera` (slow move, on by default) and `art` (canvas elements under/over). A film-level `texture` adds grain and vignette. Read `docs/canvas.md` and the `clearframe-canvas` skill before drawing.

For multiple comparable time series, use `canvas.props.plot`: explicit shared domains and ticks, linear or dated x, linear or logarithmic y, null gaps, source/as-of and synchronized linear reveals. See [quantitative-plots.md](../../docs/quantitative-plots.md). Keep a two-second final-value hold and review portrait composition; source compilation does not establish visual acceptance.

Colors, motion intensity, entrances, sources and reading time are authored choices. Read `docs/style.md`. Kinetic modes are highlight/reveal/word; follow `docs/speech.md` for the measured-timestamp requirement. For generated plates, use `docs/continuity.md` and inspect both joins.

Use `gallery` to review all blocks in a theme/aspect ratio. A new block touches four places: authoring metadata and example in `film/catalog.mjs`; prop validation in `film/validators.mjs`; runtime rules in `film/registry.mjs` (cue delay, staged items, when values settle, sound events, critique family); and the renderer in `scene/native/src/blocks/` (`story.rs`, `speech.rs`, `charts.rs`, `diagrams.rs`, `media.rs` or `canvas.rs`, registered in `mod.rs` `BLOCKS` and dispatched in `compositor.rs`). Shared timing values live only in `film/constants.json`. A parity test fails if the renderer and catalog block lists diverge. Do not copy archived browser components into the active path.

New GitHub imports must be MIT at the pinned revision. The 132 bundled Tabler aliases inherit the scene accent and use local SVG geometry; see `film/assets/icons/tabler/manifest.json` and `LICENSE`. Add icons with `scene/native/tools/fetch-icons.py` (pinned revision, path-only shapes, hashes) then `generate-icons.py`. Use no runtime CDN or unreviewed icon path. Use `looks DIR --beat ID` for palette comparisons and `review DIR` for encoded boundary review.

Technical/PR films: `new DIR --playbook pr-walkthrough --treatment business`. `canvas.props.diagram` is the system-diagram primitive: components with identities (user, service, database, queue, state, external), connectors (dashed, flowing), groups, and `steps` that add, remove, replace, re-status and send requests over time; shared ids morph across beats. `clearframe sketch architecture|state-machine|component-change` prints an editable starting diagram. See [system diagrams](../../docs/system-diagrams.md).
