# ClearFrame agent instructions

ClearFrame now uses **FFFrames for every active render**. Begin with `skills/clearframe/SKILL.md`, then `skills/clearframe-library/SKILL.md`. Use `skills/clearframe-engine/SKILL.md` for project commands and `skills/clearframe-fframes/SKILL.md` plus `fframes/AGENTS.md` for renderer changes.

- Author one storyboard, using `block` and validated `props`. Run `playbooks` and `blocks` before inventing a scene.
- Adapt structure to the story. Twenty-four playbooks are reusable starting arcs, not limits on possible films.
- Choose palette, motion preset/intensity and entrances explicitly. Follow `docs/style.md`; use `looks` to compare one scene across palettes. Keep slide counters out of film output.
- New GitHub code/assets must be MIT-licensed at the exact imported revision, with bundled notices/provenance. Prefer independently implemented ideas over adding another renderer; see `docs/research/2026-github-video-patterns.md`.
- For speech-following text read `docs/speech.md`. Never call interpolated timestamps measured. Final kinetic/captioned scenes require word timings tied to the current audio hash.
- Keep factual text, charts and labels native. Every displayed number needs visible attribution and a `sources` entry. Never present sample figures or fictional quotes as evidence.
- Generated footage is sparing (default review threshold 20% of runtime). Read `docs/continuity.md` and the Gemini Omni skill. Use references and the film palette; review both joins. Discard generated clip audio and keep the shared mix.
- Run `plan` before paid generation and honor the user's scope/budget. No paid calls merely to test code.
- Render `sheet`, open the image, run `check`, then render/review the complete MP4. Use `review DIR` for decoded frames around cuts and word boundaries. Passing diagnostics alone does not establish visual quality, accurate transcription or factual correctness.
- Native frame output must depend only on frame number and prepared inputs. No live generation, random state or wall-clock animation in `render_frame`.
- Preserve unrelated changes. Archived browser source is for recovery only; no fallback renderer is active.
- Full tests/builds/installs use `/Users/brandon/.local/bin/codex-heavy -- ...`, one Cargo job and at most two supported workers. The CLI gates expensive commands automatically. Reuse warm caches, keep at least 20 GiB free, and avoid cold builds below 30 GiB.
- When independent custom scene work benefits from parallel agents, give each agent one owned native module and the storyboard/visual brief; avoid concurrent heavy builds.

Useful commands: `node engine/cli.mjs help`, `doctor`, `new DIR --playbook NAME`, `themes`, `motions`, `voice DIR --draft`, `sheet DIR --draft`, `check DIR --draft`, `render DIR --draft`. Node contract tests: `npm test` through the shared gate.
