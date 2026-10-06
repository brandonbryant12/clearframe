# The film pipeline

`film/` turns a storyboard into a finished film. It builds the job, stages media, measures voice levels and writes manifests (`prepare.mjs`), then renders and finishes the film, stills, sheets and lookbooks (`render.mjs`). The renderer it drives is `../scene/native` ([design](../docs/scene-engine.md)), which draws every block, native stage and film-level layer with Skia on Metal. Use the root CLI (`node engine/cli.mjs`); `node film/cli.mjs` is an alias. No per-film Rust project is needed.

- [Setup](SETUP.md): native tools, pinned dependencies and resource limits.
- [Design](DESIGN.md): storyboard → prepared job → native render → shared audio mix.
- [Block reference](../skills/clearframe-library/references/blocks.md).
- [Speech](../docs/speech.md), [style](../docs/style.md), [continuity](../docs/continuity.md).

`catalog.mjs`, `playbooks.mjs` and `production.mjs` define the authoring vocabulary, the starters and the render pipeline. `assets/fonts/` holds the bundled OFL fonts, with their provenance and hashes; `assets/icons/` holds the pinned MIT Tabler subset. `runs/` is local and ignored.
