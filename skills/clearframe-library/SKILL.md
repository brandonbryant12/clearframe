---
name: clearframe-library
description: Choose and combine 32 FFFrames blocks and 24 adaptable narrative playbooks. Use for graphic selection, palette and motion variation, charts, diagrams, media plates, kinetic text and native library extensions.
---

# Native visual library

Run `node engine/cli.mjs blocks`, `blocks NAME`, `playbooks`, `themes`, `motions` and `icons`. The exact prop reference is [references/blocks.md](references/blocks.md), generated from `fframes/catalog.mjs`. Starter storyboards live in `recipes/` and are generated from `fframes/playbooks.mjs`.

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
| Ground a story in imagery | image, video, annotate (pins on a screenshot) |
| Follow spoken words | kinetic |

Playbooks have different narrative arcs, audiences and required evidence. Adapt and combine them rather than stretching a mismatched structure. The sample claims/quotations are labelled illustrative; replace them before publishing. For real UI demonstrations use approved screenshots or recordings: `annotate` pins the reading order onto a screenshot; `screen-walkthrough` scaffolds a text-free wireframe placeholder to replace.

Colors, motion intensity, entrances, sources and reading time are authored choices. Read `docs/style.md`. Kinetic modes are highlight/reveal/word; follow `docs/speech.md` for the measured-timestamp requirement. For generated plates, use `docs/continuity.md` and inspect both joins.

Use `gallery` to review all blocks in a theme/aspect ratio. For a new block, add metadata/example/validation in `fframes/catalog.mjs`, its renderer in the matching module under `fframes/native/src/` (`scenes.rs` story blocks, `charts.rs`, `diagrams.rs`, `media.rs`), register it in `lib.rs` `BLOCKS` and the `render` dispatch, add scheduling/settle rules in `production.mjs` if it stages items or counts, then add focused regression tests and inspect wide/narrow outputs. A test fails if the renderer and catalog block lists diverge. Do not copy archived browser components into the active path.

New GitHub imports must be MIT at the pinned revision. The 95 bundled Tabler aliases inherit the scene accent and use local SVG geometry; see `fframes/assets/icons/tabler/manifest.json` and `LICENSE`. Add icons with `fframes/native/tools/fetch-icons.py` (pinned revision, path-only shapes, hashes) then `generate-icons.py`. Use no runtime CDN or unreviewed icon path. Use `looks DIR --beat ID` for palette comparisons and `review DIR` for encoded boundary review.
