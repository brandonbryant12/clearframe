# FFFrames migration

FFFrames is the sole active renderer. The root CLI owns the end-to-end workflow; `fframes/cli.mjs` is an alias. Browser-only runtime, renderer, templates, recipes, tests and instructions are preserved under `archive/browser`, outside package dependencies and test discovery. Original comparison code is in `archive/comparison`; ignored frozen runs are retained.

New projects contain one `storyboard.json`, optional brief and media. The old separate `fframes.json` scene map is retired. Content is runtime JSON, so changing words, colors, values, motion or layout selection does not rebuild Rust. Supported canvases are landscape 1920×1080, vertical 1080×1920, square 1080×1080, portrait 1080×1350 and compact 640×360; FPS 24/25/30/50/60.

This is a deliberate native vocabulary, not automatic parity with every former browser component. Use the current 32-block catalog. Old HTML, CSS, custom JavaScript scenes, CF.kit calls, markdown emphasis syntax, browser/mock-UI components and live browser preview require explicit redesign/porting. Unsupported blocks/props fail instead of silently degrading. Use real screenshots as image plates for a UI walkthrough, then add native explanation beats.

Shared narration, generation, timing, scoring and audio finishing remain. Lyria 3.5 requests MP3 and caches the recorded extension. Native counters preserve suffixes; chart scales/baselines and focus opacity are data-driven. Negative bars are rejected; signed changes use delta or explicit line domains. Measured word timing is a separate quality gate from having a recorded voice.

Validation scope and review artifacts are recorded in `verification.md`. Paid integrations are verified with contract/mocked tests unless an explicit live-generation result is recorded there. Native preview is a rendered MP4; there is no live editing UI in this release.
