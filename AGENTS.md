# ClearFrame agent instructions

ClearFrame now uses **FFFrames for every active render**. Begin with `skills/clearframe/SKILL.md`, then `skills/clearframe-library/SKILL.md`. Use `skills/clearframe-engine/SKILL.md` for project commands and `skills/clearframe-fframes/SKILL.md` plus `fframes/AGENTS.md` for renderer changes.

- Author one storyboard, using `block` and validated `props`. Run `playbooks`, `blocks`, `treatments` and `sketch` before inventing a scene.
- Adapt structure to the story. Twenty-seven playbooks and eight treatments are reusable starting points, not limits on possible films. Source material (reports, recordings) goes through `ingest`; references through `reference`; see `skills/clearframe-direction/SKILL.md`.
- Films are not slide decks: draw mechanisms (`canvas`), use plates, tones, camera and graphic transitions, and run `critique` before rendering.
- Choose palette, motion preset/intensity and entrances explicitly. Follow `docs/style.md`; use `looks` to compare one scene across palettes. Keep slide counters out of film output.
- New GitHub code/assets must be MIT-licensed at the exact imported revision, with bundled notices/provenance; bundled fonts are SIL OFL 1.1 from google/fonts at a pinned revision with hashes in `fframes/assets/fonts/provenance.json`. Prefer independently implemented ideas over adding another renderer; see `docs/research/2026-github-video-patterns.md`.
- For speech-following text read `docs/speech.md`. Never call interpolated timestamps measured. Final kinetic/captioned scenes require word timings tied to the current audio hash; `align --whisper` measures them locally for free.
- Keep factual text, charts and labels native. Every displayed number needs visible attribution and a `sources` entry. Never present sample figures or fictional quotes as evidence.
- Generated footage is sparing (default review threshold 20% of runtime). Read `docs/continuity.md` and the Gemini Omni skill. Use references and the film palette; review both joins. Discard generated clip audio and keep the shared mix.
- Run `plan` before paid generation and honor the user's scope/budget. No paid calls merely to test code.
- Render `sheet`, open the image, run `check`, then render/review the complete MP4. Use `review DIR` for decoded frames around cuts and word boundaries. Passing diagnostics alone does not establish visual quality, accurate transcription or factual correctness.
- Native frame output must depend only on frame number and prepared inputs. No live generation, random state or wall-clock animation in `render_frame`.
- Preserve unrelated changes. Archived browser source is for recovery only; no fallback renderer is active.
- Native builds use one Cargo job and at most two supported workers; `buildNative` takes the machine-wide `codex-heavy` lock for the compile only (renders, checks and `npm test` run directly). Reuse the warm cache; warm builds need 10 GiB free, cold builds 25 GiB.
- This is an experimental project: tests are fast smoke checks that help development, not exhaustive edge-case coverage. Add a test when it saves debugging time; don't add them for completeness.
- When independent custom scene work benefits from parallel agents, give each agent one owned native module and the storyboard/visual brief; avoid concurrent heavy builds.

Useful commands: `node engine/cli.mjs help`, `doctor`, `new DIR --playbook NAME --treatment ID`, `ingest DIR --markdown|--audio`, `reference VIDEO`, `themes`, `treatments`, `sketch`, `critique DIR`, `voice DIR --draft`, `align DIR --whisper`, `sheet DIR --draft [--grid]`, `check DIR --draft`, `render DIR --draft`. Node contract tests: `npm test` through the shared gate.
