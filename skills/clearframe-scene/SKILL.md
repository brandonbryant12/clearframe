---
name: clearframe-scene
description: Author native GPU stages for ClearFrame films (actors with stable identities, links that follow them, packets, callouts, commit-grounded code edits, footage textures, SkSL materials, particles, a 2.5D camera with depth of field and real motion blur) and develop the scene engine that renders every film. Use for technical/PR explainers, systems that change over time, footage-led shots with native type, material looks, and for engine or compositor changes.
---

# Native stages and the scene engine

Read `docs/scene-engine.md` (design and full reference) and `docs/scene-engine-coverage.md` (what is native, what is still drawn by FFFrames block code). The scene engine is the default renderer; `--engine fframes` renders the old way and refuses films with stages.

## When to use a stage

- A mechanism with **identities that persist**: a request travelling between services, a state machine changing, a component replaced. Use `actors` + `links` + `events` instead of re-drawing a diagram per beat. A film `stages` entry keeps the same actors across several beats.
- **Code that changed**: `code: {commit, file, window}` reads the exact commit from git, keeps unchanged lines in place, opens room for insertions and closes it for removals. The plan records the commit and blob ids; put the commit in `source`.
- **Footage with native type**: `video` elements are decoded as GPU textures at the size drawn; title them with `camera: false` text so a camera push does not carry the type off frame.
- **A look**: `ground` or `material` (noise, sheen, halftone, grain, glass, chrome, gold, thermal, scanlines, neon), `particles` (burst, stream along a link, field), `shutter` for motion blur on fast moves.

Charts, KPIs, plots, quotes and kinetic speech stay in their blocks (exact values, sources, audits). Put a stage `over` a block for callouts and emphasis, not a re-drawn chart.

## Authoring rules

1. Positions are frame pixels of the layout frame (1920×1080 landscape, 1080×1920 vertical; the shorter side is 1080). Keep type inside title-safe; `check` audits native type like block type.
2. Cue with `say` (a word of the beat's narration; for film stages the first match in its beats, or `{beat, say}`). Every cue must land inside the stage; late cues fail.
3. Actor ids are the identities: links, packets (`send`), callouts and `attach` refer to them. Events can be in any order; keys are sorted.
4. Footage must cover its time on screen, including a dissolve into the next beat; it never loops, and freezes only with `hold: true`.
5. Canvas-only features (`rough`, `print`, `mosaic`, `morph`, `solid`, `meter`, `loop: level`, `assemble`/`scatter`) are refused on stages by name. Use a `canvas` beat or `art` for them.
6. Keep steady films steady: no `camera` keys or `shutter` on a business/report stage unless the brief asks for movement.
7. Run `sheet`, `check`, then render and look at decoded frames around every cut and camera move.

## Minimal stage

```json
{ "id": "flow", "block": "stage", "vo": "The CLI sends stop; the daemon waits for the child to exit.",
  "props": { "title": "How a stop request travels", "source": "PR #12, commit 1a2b3c4",
    "actors": [ {"id": "cli", "label": "CLI", "kind": "client", "x": 420, "y": 600},
                {"id": "daemon", "label": "Daemon", "x": 960, "y": 600},
                {"id": "child", "label": "Child", "kind": "process", "x": 1500, "y": 600} ],
    "links": [ {"from": "cli", "to": "daemon", "label": "stop"}, {"from": "daemon", "to": "child", "label": "SIGTERM"} ],
    "events": [ {"do": "send", "from": "cli", "to": "daemon", "say": "sends"},
                {"do": "callout", "actor": "daemon", "text": "waits for exit", "say": "waits"},
                {"do": "state", "actor": "child", "status": "done", "label": "Exited", "say": "exit"} ],
    "shutter": 0.5 } }
```

Examples: `examples/stage-pr` (a film stage across beats, a callout riding a camera move, a code edit from a commit) and `examples/stage-footage/make.mjs` (portrait/landscape footage stages).

## Engine development

- Sources: `scene/native/src` — `plan.rs` (contract), `compose.rs` (frame order, dissolves, motion blur), `film.rs` (backdrop, texture, chrome, frame, lens, letterbox), `nodes.rs` (elements, recipes' targets, camera), `materials.rs` (SkSL), `media.rs` (footage/images, bounded), `fonts.rs` (glyph runs from the rustybuzz shaping that measured them), `legacy.rs` (block layers via `fframes/native`), `encode.rs` (FFmpeg pipe), `inspect.rs` (inspect + audit). JS: `scene/compile.mjs`, `scene/recipes.mjs`, `scene/code.mjs`, `scene/engine.mjs`.
- Frame output is a pure function of the frame and prepared inputs. Anything random is hash-derived from a seed; no wall clock.
- Film-level looks must match FFFrames until it retires: change `fframes/native/src/{lib,design,lens}.rs` and `film.rs` together and run `scripts/engine-parity.mjs`.
- Build: `node engine/cli.mjs build` (one Cargo job, codex-heavy). Tests: `node --test test/scene-engine.test.mjs`; Rust: `codex-heavy -- env CARGO_TARGET_DIR=scene/.cache/target cargo test --manifest-path scene/native/Cargo.toml --release --locked --jobs 1 -- --test-threads=2`.
- Measure before claiming speed: `scripts/engine-bench.mjs OUT PROJECT…` (cold, warm, range, full, peak memory, temp disk, both engines, same settings).
