# Retired rendering paths

These folders are historical recovery materials, kept out of active package dependencies, commands and tests:

- `browser/` keeps the earlier HTML/GSAP source, with its fixes, projects, templates, recipes, tests and agent instructions.
- `comparison/` keeps the first FFFrames experiment and its paired-evaluation documentation.
- `fframes/` is the exception: it records the fframes revision that is **active again** as the film runtime (a pinned Cargo git dependency of `scene/native`, see `docs/fframes-return.md`), with its MIT notice. The September 2026 `svgr!` block code it once drew stays retired; ClearFrame's engine draws every frame.

The production path is the root CLI, with `film/` for the job, prepare and render steps and `scene/native` for the renderer. Old scene APIs are not emulated. To run a historical engine, recover its layout and import paths in a separate checkout; these relocated sources are not a second installed application. Generated media and old build outputs stay ignored.
