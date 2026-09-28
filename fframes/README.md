# Production FFFrames renderer

This is ClearFrame's only active renderer. Use the root CLI (`node engine/cli.mjs`); `node fframes/cli.mjs` is an alias. No separate `fframes.json` or per-film Rust project is needed.

- [Setup](SETUP.md): native tools, pinned dependencies and resource limits.
- [Design](DESIGN.md): storyboard → prepared job → native render → shared audio mix.
- [Block reference](../skills/clearframe-library/references/blocks.md).
- [Speech](../docs/speech.md), [style](../docs/style.md), [continuity](../docs/continuity.md).

`native/` is the reusable renderer crate. `catalog.mjs`, `playbooks.mjs` and `production.mjs` define the authoring vocabulary, starters and render pipeline. `assets/fonts/` bundles licensed Inter. `upstream.json` and Cargo.lock pin upstream code. `.cache/` and `runs/` are local, ignored artifacts.
