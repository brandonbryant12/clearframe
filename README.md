# ClearFrame

Agent-directed motion graphics rendered with **FFFrames**. A film is a `storyboard.json`, recorded speech, and optional media. Native Rust/SVG blocks carry text, numbers, diagrams and captions; Google models supply speech, music, images and occasional footage.

## Start

Requires Node 20.10+, Rust 1.88+, FFmpeg/ffprobe and native codecs. Follow [native setup](fframes/SETUP.md) before the first build. No npm runtime dependencies or browser installation are needed.

```sh
node engine/cli.mjs doctor
node engine/cli.mjs new my-video --playbook concept-explainer --theme paper
# Edit my-video/storyboard.json and replace the illustrative claims.
node engine/cli.mjs voice my-video --draft
node engine/cli.mjs sheet my-video --draft
node engine/cli.mjs check my-video --draft
node engine/cli.mjs render my-video --draft
```

Read the contact sheet and review the MP4 with sound. `build/video.mp4.json` records input identity, renderer revision, audio provenance, output hash, color space and render time. Draft mode permits provisional voice timing; it retains the authored canvas and frame rate.

## Build a visual vocabulary

- **19 playbooks:** reports and explainers, plus science lessons, cooking guides, travel, language practice, personal stories, creative process and quiet moments. Run `playbooks`; scaffold with `new --playbook NAME`.
- **26 native blocks:** typography, stats, KPIs, bar/line/waffle/ring charts, before-and-after, comparisons, steps, timelines, funnels, quotations, lists, matrices, equations, callouts, endcards, images, video, kinetic text, icon grids, animated flows, cycles and breathing visuals. Run `blocks NAME`; 24 bundled MIT Tabler icons are listed by `icons`. [Full reference](skills/clearframe-library/references/blocks.md).
- **Colors:** four presets or individual palette overrides. **Motion:** gentle, snappy or spring, intensity 0–1, with cut/fade/rise/wipe/push/zoom entrances. [Style guide](docs/style.md).
- **Speech-led text:** phrase highlighting, word reveals and one-word mode, plus burned captions and SRT/VTT. Final speech-following output requires measured timestamps tied to the exact audio. [Speech workflow](docs/speech.md).
- **Occasional generated inserts:** Gemini Omni Flash 1.1 uses the film palette, visual references and continuity brief. Titles remain native; one shared soundtrack spans every scene. [Continuity workflow](docs/continuity.md).

Playbooks are starting structures, not a fixed menu of possible videos. Combine and reorder blocks freely; extend the native catalog when a story needs a new visual form. Each playbook deliberately starts with labelled hypothetical content, which must be replaced before publishing.

## Authoring and review

`storyboard.json` is the single source for scene selection, data, theme, motion and cues. [Engine skill](skills/clearframe-engine/SKILL.md) describes the contract. Choose landscape, vertical, square or portrait; supported frame rates are 24, 25, 30, 50 and 60.

`looks DIR --beat ID` compares the same frame across four palettes. `review DIR` creates a cut/word-boundary filmstrip from the encoded MP4. Normal output has no slide counter; optional `chrome` shows only a title and progress rail.

`preview` produces a review MP4. `still` and `sheet` support rapid visual iteration. `check` validates authoring inputs and native diagnostics; manual legibility, factual and audio review remains necessary. Paid commands are explicit: `plan` estimates spend, then `voice`, `music`, `images`, `clips` or `align --transcribe` call Google. Existing recordings and imported timestamp files need no API key.

The local CLI automatically uses `~/.local/bin/codex-heavy` for expensive work when installed, and recognizes an inherited gate. Builds use one Cargo job and bounded native workers. Keep 20 GiB free with a warm cache, 30 GiB before a cold build.

## Development

```sh
/Users/brandon/.local/bin/codex-heavy -- npm test
node engine/cli.mjs gallery build/gallery-paper --theme paper
node engine/cli.mjs gallery build/gallery-ink --vertical --theme ink
node engine/cli.mjs build
```

`engine/` owns orchestration, timing, generation and audio. `fframes/native/` owns rendering. `fframes/catalog.mjs` owns block metadata/validation; `fframes/playbooks.mjs` owns narrative starters. `skills/` routes agents through writing, visual design, native rendering and review.

The retired HTML/GSAP engine and original comparison are preserved in [archive/](archive/README.md), outside active CLI commands, tests and package dependencies. Existing browser-specific scenes require an explicit port; the native renderer never silently substitutes generic scenes. See [migration notes](docs/fframes-migration.md).

[GitHub research and reuse policy](docs/research/2026-github-video-patterns.md) · [Verification evidence](docs/verification.md) · [Visual catalog](docs/media/blocks.jpg)
