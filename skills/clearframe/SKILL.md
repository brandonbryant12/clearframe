---
name: clearframe
description: Direct and produce an FFFrames video from a brief, article, script or recording. Use for explainers, lessons, recipes, travel, personal stories, reports and speech-led films; routes authoring, media generation and review.
---

# Direct a ClearFrame film

FFFrames is the only active renderer. Read the project AGENTS.md. Use the library skill before designing visuals, engine skill for commands, script skill for narration, motion/dataviz skills for design, integrity skill for evidence, and FFFrames skill for native code changes.

1. Establish audience, takeaway, format, duration and available evidence. Work from the user's material; research unresolved factual claims. Define what the viewer should understand or do.
2. Choose a playbook with `node engine/cli.mjs playbooks`, then adapt its arc. The 19 starters are not a finite catalog of possible videos. Combine blocks as needed; every beat needs a purpose.
3. Write spoken language, one idea per beat. Use verified figures and meaningful source labels. Plan the visual before spending on media. Keep titles short; reserve long speech for kinetic text.
4. Scaffold with `new DIR --playbook NAME`. Choose a palette, motion preset/intensity and entrances using `docs/style.md`. Use `blocks NAME` for exact props. Do not write browser scene modules.
5. Generate free draft voice or import approved recordings. For speech-following typography/captions, read `docs/speech.md`, import measured words or explicitly transcribe the current recording. Never describe syllable interpolation as word alignment.
6. Native type/charts/diagrams carry all information. Use Google image or Gemini Omni only for specific visual material the native scene cannot express. Read `docs/continuity.md`; keep palette/references/framing/movement consistent and preserve the shared soundtrack.
7. Before paid generation, run `plan` and honor the user scope and budget. `voice --draft` and `music --draft` are free. `align --words` is free; `align --transcribe` uploads the selected recording and is paid.
8. Render a sheet and open it. Use `looks` to compare palettes and `review` to inspect encoded transitions and word boundaries, run `check`, render the MP4, and listen. Final kinetic/captioned output must pass the measured-timestamp gate without `--draft`. Report sample-data, draft or transcription limitations accurately.

Deliver source/output locations, verification and remaining material limits. Do not claim a live API test from a mock or a visual review from a compilation. The historical engine is archived for recovery, not an active alternative.

Keep ordinary film output free of slide counters. Research recent MIT projects when the native vocabulary lacks a useful pattern; preserve exact source licenses and prefer the existing simple stack. See `docs/research/2026-github-video-patterns.md`.
