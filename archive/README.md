# Retired rendering paths

These folders are historical recovery materials, kept out of active package dependencies, commands and tests:

- `browser/` keeps the earlier HTML/GSAP source, with its fixes, projects, templates, recipes, tests and agent instructions.
- `comparison/` keeps the first FFFrames experiment and its paired-evaluation documentation.
- `fframes/` records the FFFrames revision that drew ClearFrame films until October 2026, with its MIT notice. No FFFrames code or crate remains in the active renderer.

The production path is the root CLI, with `film/` for the job, prepare and render steps and `scene/native` for the renderer. Old scene APIs are not emulated. To run a historical engine, recover its layout and import paths in a separate checkout; these relocated sources are not a second installed application. Generated media and old build outputs stay ignored.
