---
name: clearframe-library
description: Choose and combine 26 FFFrames blocks and 19 adaptable narrative playbooks. Use for graphic selection, palette and motion variation, charts, diagrams, media plates, kinetic text and native library extensions.
---

# Native visual library

Run `node engine/cli.mjs blocks`, `blocks NAME`, `playbooks`, `themes`, `motions` and `icons`. The exact prop reference is [references/blocks.md](references/blocks.md), generated from `fframes/catalog.mjs`. Starter storyboards live in `recipes/` and are generated from `fframes/playbooks.mjs`.

Choose the visual by the task:

| Task | Blocks |
|---|---|
| Establish an idea | title, statement, callout, quote, endcard |
| Show a number/change | stat, kpis, delta |
| Compare quantities/shares/trends | bars, waffle, ring, line, funnel |
| Explain a process/relation | steps, timeline, equation, flow, cycle |
| Compose symbols or a paced visual | icon-grid, breathing |
| Compare choices | compare, matrix |
| Summarize | list |
| Ground a story in imagery | image, video |
| Follow spoken words | kinetic |

Playbooks have different narrative arcs, audiences and required evidence. Adapt and combine them rather than stretching a mismatched structure. The sample claims/quotations are labelled illustrative; replace them before publishing. For real UI demonstrations use approved screenshots or recordings as media plates, then native explanation beats.

Colors, motion intensity, entrances, sources and reading time are authored choices. Read `docs/style.md`. Kinetic modes are highlight/reveal/word; follow `docs/speech.md` for the measured-timestamp requirement. For generated plates, use `docs/continuity.md` and inspect both joins.

Use `gallery` to review all blocks in a theme/aspect ratio. For a new block, add metadata/example/validation in `fframes/catalog.mjs` and its renderer in `fframes/native/src/scenes.rs`, register it in native dispatch, then add focused regression tests and inspect wide/narrow outputs. Do not copy archived browser components into the active path.

New GitHub imports must be MIT at the pinned revision. The 24 bundled Tabler aliases inherit the scene accent and use local SVG geometry; see `fframes/assets/icons/tabler/manifest.json` and `LICENSE`. Use no runtime CDN or unreviewed icon path. Use `looks DIR --beat ID` for palette comparisons and `review DIR` for encoded boundary review.
