---
name: clearframe-library
description: Choose and combine 33 FFFrames blocks, canvas sketches, beat layers (plate, tone, camera, art) and adaptable narrative playbooks. Use for graphic selection, palette and motion variation, charts, diagrams, drawings, media plates, kinetic text and native library extensions.
---

# Native visual library

Run `node engine/cli.mjs blocks`, `blocks NAME`, `sketch`, `playbooks`, `themes`, `motions` and `icons`. The exact prop reference is [references/blocks.md](references/blocks.md), generated from `fframes/catalog.mjs`. Starter storyboards live in `recipes/` and are generated from `fframes/playbooks.mjs`.

Choose the visual by the task:

| Task | Blocks |
|---|---|
| Establish an idea | title, statement, chapter, callout, quote, endcard |
| Make key words land | highlight (marker sweeps), `emphasis` on hero text |
| Show a number/change | stat, kpis, delta |
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

Playbooks have different narrative arcs, audiences and required evidence. Adapt and combine them rather than stretching a mismatched structure. The sample claims/quotations are labelled illustrative; replace them before publishing. For real UI demonstrations use approved screenshots or recordings: `annotate` pins the reading order onto a screenshot; `screen-walkthrough` scaffolds a text-free wireframe placeholder to replace.

Layers combine with any block: `plate` (image/clip behind or beside), `tone` (colour-blocked scene), `camera` (slow move, on by default) and `art` (canvas elements under/over). A film-level `texture` adds grain and vignette. Read `docs/canvas.md` and the `clearframe-canvas` skill before drawing.

Colors, motion intensity, entrances, sources and reading time are authored choices. Read `docs/style.md`. Kinetic modes are highlight/reveal/word; follow `docs/speech.md` for the measured-timestamp requirement. For generated plates, use `docs/continuity.md` and inspect both joins.

Use `gallery` to review all blocks in a theme/aspect ratio. A new block touches four places: authoring metadata and example in `fframes/catalog.mjs`; prop validation in `fframes/validators.mjs`; runtime rules in `fframes/registry.mjs` (cue delay, staged items, when values settle, sound events, critique family); and the renderer in `fframes/native/src/` (`story.rs`, `speech.rs`, `charts.rs`, `diagrams.rs`, `media.rs` or `canvas.rs`, registered in `lib.rs` `BLOCKS` and dispatched in `compositor.rs`). Shared timing values live only in `fframes/constants.json`. A parity test fails if the renderer and catalog block lists diverge. Do not copy archived browser components into the active path.

New GitHub imports must be MIT at the pinned revision. The 95 bundled Tabler aliases inherit the scene accent and use local SVG geometry; see `fframes/assets/icons/tabler/manifest.json` and `LICENSE`. Add icons with `fframes/native/tools/fetch-icons.py` (pinned revision, path-only shapes, hashes) then `generate-icons.py`. Use no runtime CDN or unreviewed icon path. Use `looks DIR --beat ID` for palette comparisons and `review DIR` for encoded boundary review.
