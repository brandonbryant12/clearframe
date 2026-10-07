---
name: clearframe-library
description: Choose and combine 33 blocks plus native GPU stages, canvas sketches, beat layers (plate, tone, camera, art) and adaptable narrative playbooks. Use for graphic selection, palette and motion variation, charts, diagrams, drawings, media plates, kinetic text and native library extensions.
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
| Compose symbols or a paced visual | icon-grid, breathing |
| Walk through a routine | checklist |
| Compare choices | compare, matrix |
| Summarize | list |
| Ground a story in imagery | a beat `plate` (full or split, palette `treatment`), image, video, annotate |
| Follow spoken words | kinetic (highlight, reveal, word; `stack` for poster type) |
| Explain a mechanism, metaphor or system | canvas (start from `sketch`: route, orbit, pipeline, network, balance, versus, burst) |
| Point at something in any scene | beat `art.over` (arrows, circles, labels placed with `still --grid`) |
| Punctuate a turn or a number | `tone: accent`, a `panel`/`iris`/`whip` transition, centred `align` |
| Promo and launch pieces | canvas `sketch`: `sunburst` (opener), `chat` (a conversation on a floating phone), `device` (a window swinging in over a sky), `marquee` (an end card ringed by type); `material` for one word of hero type |
| A distinct typographic voice | the treatment's `film.type` (or storyboard `type`): `didone`, `wide`, `geometric`, `condensed`, `bookish`, `typewriter`; `inter` is the default; `types` lists them. Emphasis follows the voice (italic, weight, marker, underline); `emphasisStyle: serif` on a beat still wins |
| A period or craft look | `print` (benday, halftone, engraving, newsprint, letterpress; plate `treatment: halftone`), mosaic `style: pixel | stitch`; sketches `benday-burst`, `woodblock-wave`, `manifesto`, `pixel-skyline`, `sampler-border`; treatments `pulp`, `woodblock`, `constructivist`, `deco`, `handheld`, `sampler`; one subject across eras: the `style-relay` playbook (`gallery` treatment) |

Playbooks have different narrative arcs, audiences and required evidence. Adapt and combine them rather than stretching a mismatched structure. The sample claims/quotations are labelled illustrative; replace them before publishing. For real UI demonstrations use approved screenshots or recordings: `annotate` pins the reading order onto a screenshot; `screen-walkthrough` scaffolds a text-free wireframe placeholder to replace.

Financial explanations have dedicated arcs: `cash-flow` follows payment availability into a reconciled sample cash balance; `scenario-lab` compares possible outcomes on one explicit basis; `risk-tradeoffs` gives benefit and limitation equal space. Their native sketches are `cash-lock` (a clearing gate), `scenario-fork` (labelled possible paths, also split into `scenario-origin` and `scenario-outcomes` for a camera world) and `risk-lens` (access, price and loss). They adapt to landscape and vertical scaffolds; the drawings are qualitative and do not encode amounts or probabilities. Keep the sample's `sources`, narration and visible figures consistent when replacing the data. Read [financial-playbooks.md](../../docs/financial-playbooks.md) for evidence requirements and demo commands.

Research and podcast sources do not imply one style. `research-investigation` is an editorial manuscript montage that separates observation, inference and a missing comparison; `research-digest` explores evidence inside a continuous illustrated world. `podcast-thread` follows a single idea through a knot and an opening, using sparse type and a held picture; `podcast-clip` has a faster typographic arc. Treat these as editable examples: invent new scenes, combine arcs and change the picture, edit and pace to fit the source. Keep exact claims and citations for research, and exact recorded words, speaker identity and measured timing for podcasts. Never assign the sample script to a real speaker. Read [source-playbooks.md](../../docs/source-playbooks.md).

Layers combine with any block: `plate` (image/clip behind or beside), `tone` (colour-blocked scene), `camera` (slow move, on by default) and `art` (canvas elements under/over). A film-level `texture` adds grain and vignette. Read `docs/canvas.md` and the `clearframe-canvas` skill before drawing.

For multiple comparable time series, use `canvas.props.plot`: explicit shared domains and ticks, linear or dated x, linear or logarithmic y, null gaps, source/as-of and synchronized linear reveals. See [quantitative-plots.md](../../docs/quantitative-plots.md). Keep a two-second final-value hold and review portrait composition; source compilation does not establish visual acceptance.

Colors, motion intensity, entrances, sources and reading time are authored choices. Read `docs/style.md`. Kinetic modes are highlight/reveal/word; follow `docs/speech.md` for the measured-timestamp requirement. For generated plates, use `docs/continuity.md` and inspect both joins.

Use `gallery` to review all blocks in a theme/aspect ratio. A new block touches four places: authoring metadata and example in `film/catalog.mjs`; prop validation in `film/validators.mjs`; runtime rules in `film/registry.mjs` (cue delay, staged items, when values settle, sound events, critique family); and the renderer in `scene/native/src/blocks/` (`story.rs`, `speech.rs`, `charts.rs`, `diagrams.rs`, `media.rs` or `canvas.rs`, registered in `mod.rs` `BLOCKS` and dispatched in `compositor.rs`). Shared timing values live only in `film/constants.json`. A parity test fails if the renderer and catalog block lists diverge. Do not copy archived browser components into the active path.

New GitHub imports must be MIT at the pinned revision. The 95 bundled Tabler aliases inherit the scene accent and use local SVG geometry; see `film/assets/icons/tabler/manifest.json` and `LICENSE`. Add icons with `scene/native/tools/fetch-icons.py` (pinned revision, path-only shapes, hashes) then `generate-icons.py`. Use no runtime CDN or unreviewed icon path. Use `looks DIR --beat ID` for palette comparisons and `review DIR` for encoded boundary review.

Technical/PR films: `new DIR --playbook pr-walkthrough --treatment business`. `canvas.props.diagram` is the system-diagram primitive: components with identities (user, service, database, queue, state, external), connectors (dashed, flowing), groups, and `steps` that add, remove, replace, re-status and send requests over time; shared ids morph across beats. `clearframe sketch architecture|state-machine|component-change` prints an editable starting diagram. See [system diagrams](../../docs/system-diagrams.md).
