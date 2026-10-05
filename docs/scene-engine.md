# The scene engine

ClearFrame renders every film with the **scene engine** (`scene/`): a ClearFrame-owned scene plan evaluated frame by frame and composited with Skia on the GPU (Metal on macOS). The FFFrames renderer is still in the repository and selectable, for comparison and for recovering older projects, and its block code still draws the inside of the 33 blocks (see [what is native](#what-is-native-and-what-is-not)). It is not retired.

This page is the design and the authoring reference. The plan review that chose this design is summarised under [Decisions](#decisions); [coverage](scene-engine-coverage.md) lists every block, sketch, treatment and playbook with its state.

## In one picture

```
storyboard.json ─► timing, words, sources, data transforms           (unchanged)
                ─► createJob (fframes/job.mjs)  → build/native/job.json   block validation and scheduling
                ─► compilePlan (scene/compile.mjs) → build/native/plan.json  native stages, cues resolved,
                                                                          media staged by content hash
clearframe-scene --plan plan.json  (scene/native, Rust)
    per frame:  clear → [lens layer: handheld → background → backdrop → vignette
                         → stages under → beats (ground │ native under │ block content │ native over)
                         → stages over → chrome] → leak → editorial frame → grain → letterbox → guides
    commands:   frame LIST │ render [A..B] │ inspect │ audit │ bench │ info │ serve
                ─► raw H.264 (FFmpeg pipe, two threads) ─► the existing finisher: packet timeline,
                   one audio mix, mux with colour tags, decoded frame-count check, receipt, revision
```

Every frame is a pure function of its number and the prepared inputs (job, plan, staged media, bundled fonts). There is no wall-clock state, no random state and no live generation in the engine.

## Choosing the engine

| How | Effect |
|---|---|
| default | `scene` |
| `--engine fframes` on any command, `CLEARFRAME_ENGINE=fframes`, or `"engine": "fframes"` in the storyboard | the FFFrames renderer draws the whole film, as before this change |
| a film with native stages and `fframes` | refused: *only the scene engine draws them* (nothing is silently dropped) |

The prepared manifest and every receipt record `renderer`/`engine`, the engine's source hash (for the scene engine: its own sources plus the block layer it draws), the plan's SHA-256, font hashes and input hashes. A render fails if any of them change during the render.

`clearframe build` builds the selected engine; `clearframe build --all` builds both. The scene engine's Cargo target lives in `scene/.cache/target` (ignored); a cold target is seeded from the FFFrames cache by copy-on-write. Builds use one Cargo job through `codex-heavy`, like the FFFrames build.

## Native stages

A **stage** is a list of native elements the engine draws itself, on the GPU, on its own clock. Three places declare one; all compile with the same recipes:

```jsonc
// 1. A stage block: the beat's picture is native. The block layer still draws the heading,
//    the source line, captions, the speaker tag and the transitions.
{ "id": "flow", "block": "stage", "vo": "…",
  "props": { "title": "How a stop request travels", "source": "…",
             "actors": [...], "links": [...], "events": [...], "code": {...},
             "ground": {...}, "under": [...], "elements": [...], "over": [...],
             "camera": {...}, "shutter": 0.5, "samples": 8, "z": "under" } }

// 2. A beat stage: native layers under or over any block (z defaults to over).
{ "id": "chart", "block": "bars", "props": {...}, "stage": { "z": "over", "over": [ … callouts … ] } }

// 3. A film stage spanning beats: one layer, one clock, identities kept across the cuts.
"stages": [{ "id": "route", "from": "symptom", "to": "cause", "z": "under", "actors": [...], "events": [...] }]
```

Times are seconds on the stage's clock or spoken cues (`say`): a word in the beat's narration, or — for a film stage — the first match in the stage's beats, or `{ "beat": "cause", "say": "zero" }`. Every cue resolves before rendering; a cue past the stage's end is an error.

### Elements: the canvas dialect, drawn natively

Stage elements use the canvas block's vocabulary ([canvas.md](canvas.md)): `rect, circle, ellipse, line, path, poly, text, icon, image, group, particles, spotlight` with `fill/stroke` tokens and gradients, `enter` (fade, pop, rise, drop, left, right, grow, grow-x, grow-y, draw, wipe, wipe-up, type, scramble, blur, none), `at/say/dur`, `keys` (x, y, scale, rotate, opacity, scaleX, scaleY, blur, tiltX, tiltY — and now **fill/stroke colours**), `along`, `loop` (spin, pulse, float, sway, orbit, dash, blink, rock), `exit`/`exitAt`/`exitSay`, `echo`, `tilt`, `shine`, `glow`, `shadow`, `blur`, `blend`, `z`, `fps`. The rules (default entrances and durations, keys easing from the previous state, values that never overshoot, stroke draw-on) follow `fframes/native/src/canvas.rs`, so an element means the same thing in a canvas and on a stage.

Features the canvas block draws but stages do not — `rough`, `print`, `mosaic`, `morph`, `solid`, `meter`, `loop: level` — are **refused by name** when a stage uses them (`box uses rough, which the canvas block draws; native stages do not`). Keep them in a `canvas` beat or `art`.

New element types and properties only the engine draws:

| | |
|---|---|
| `video` | Footage as a GPU texture: `{file|asset, x, y, w, h, r, fit: cover|contain, focusX, focusY, offset, rate, hold, treatment}`. Decoded in order at the size drawn (at most six decoders, two frames each; never a raw cache of the clip). A clip shorter than its time on screen — including a following dissolve — fails at prepare time; footage never loops, and freezes only with `hold: true`. |
| `shader` | A rectangle filled with an SkSL material (below). |
| `material` | On any shape or text: `noise, sheen, halftone, grain, glass, chrome, gold, thermal, scanlines` (SkSL runtime shaders over the element's bounds, palette colours, seeded and time-driven) or `neon` (a bright core with a glow). `{name, colors: [tokens], scale, amount, speed, seed}`. |
| `particles` | The canvas kinds (dust, embers, rain, snow, bubbles, stars) plus `burst` (seeded emitter: velocity, spread, angle, gravity, drag, life), `stream` (particles flowing along a path element by id) and `field` (a noise-steered drift). Up to 4,000 per element, batched by opacity. Pure functions of time. |
| `connector` | A live path between two elements' current positions: `{from, to, route: curve|straight|elbow, bend, gap, gapFrom, gapTo, fromOffset, toOffset}`. It follows them as they move and is a route other elements can ride. |
| `code` | An editor whose lines keep their identity: `{lines: [{id, text|spans, number, indent}], steps: [{at, show, add, remove, focus}], title, gutter, size, leading}`. Kept lines move to their new rows, insertions open room on a positive wash, removals fade on a negative wash and close up, focus dims the rest. |
| `attach` | `{to, dx, dy}`: ride another element (a label on a packet, a callout on a moving actor). |
| `along: {path: id}` | Travel along another element's path or connector (`from`/`to` fractions run it backwards). |
| `camera: false` | Pin an element to the screen while the stage camera moves (type over a moving shot). |

Each frame places every element first (twice, so an element can follow one listed after it), then draws in list order: a connector can sit under the actors it joins.

### Recipes: say what happens, not where every shape goes

`scene/recipes.mjs` compiles intent into elements with stable ids:

- **actors** `[{id, label, kind, x, y, w?, h?, icon?, status?, detail?, at|say, z?}]` — a card (icon, label, status light) whose group carries the identity. Kinds: service, database, user, users, queue, process, external, file, client, phone, timer, lock, note, state.
- **links** `[{id?, from, to, label?, route?, bend?, dashed?, color?, arrow?, at|say}]` — connectors inset to the cards' edges, with a label riding the midpoint.
- **events** `[{do, at|say, …}]`:
  `send {from, to | via, label, color, dur, ease, burst, arrive}` a packet travels the link (backwards for a reply), the receiver pulses on arrival;
  `pulse | highlight {actor, color, until|untilSay}`; `state {actor, status: neutral|active|added|done|removed|error|waiting, label}` (the card and light change colour; a new label replaces the old);
  `move {actor, x, y, dur, ease}`; `show`/`hide {actor}` (a hidden actor takes its links and their labels with it); `connect`/`disconnect {link}`;
  `callout {actor, text, side, dx, dy, untilSay}` (a dark tag with a leader, riding the actor); `burst {actor, count, color, …}`; `camera {x, y, zoom, rotate | follow: actor, dur, ease}`.
- **code** — inline `lines`+`steps`, `before`/`after` text, or **from git**: `{commit, file, base?, repo?, window: [first, last] | context}`. The plan records the full commit, base and blob ids in `manifest.provenance`; the title reads `file @ shortsha`. `h` fits the editor to a height and refuses rows that would be smaller than 20 px.
- **ground** `{material, colors, opacity, scale, speed, z}` — a full-frame material behind the stage.

### Camera, depth and motion blur

`camera: {x, y, zoom, rotate, z, keys: [{at|say, x, y, zoom, rotate, z, dur, ease}], focus: {z, aperture, keys}}` is a 2.5D camera: elements with `z` (0 the picture plane, positive farther) scale with perspective as the camera dollies (`z`), move by 1/(1+z) of a pan (parallax), disappear once passed, and blur with distance from the focus plane — except type, which stays readable. Camera and depth apply at a stage's top level; group children move with their group.

`shutter` (0–1 of a frame) with `samples` (default 8, at most 32) is **temporal motion blur**: the stage is evaluated at `samples` instants across the open shutter and accumulated in half float. Footage stays on its decoded frame inside one output frame. It costs about one stage draw per sample; leave it off for still stages.

## Film-level compositing

The engine composites the film itself instead of building one SVG tree per frame:

- **backdrop** `grid, dots, glow, paper, mosaic`, **texture** grain/vignette, `chrome`, the editorial `frame`, the review grid — native Skia drawing with the same geometry, timing and palette rules as `fframes/native/src/{lib,design}.rs`. Paper and grain use Skia's implementation of the SVG fractal-noise function; the grain reproduces how the FFFrames converter read that noise (premultiplied), so existing films keep their reviewed look.
- **lens**: grade (the same saturation matrix and transfer tables), bloom (threshold, blur, screen) and chromatic aberration (channel split and offset) as one GPU image-filter graph over the picture; handheld, light leaks and letterbox bars with the same curves.
- **dissolves** are two real layers: the outgoing beat (its block content and its native layers) runs on under the incoming one, whose layer fades up; the outgoing words clear in the first third.

Block content is drawn by `fframes/native` (below) between the engine's own layers; a beat with native `under` layers is drawn in two parts — its ground (tone, plate), then the stage, then its content — so a stage sits between a plate and the heading.

## What is native and what is not

| Part | Drawn by | Notes |
|---|---|---|
| Film compositing (backdrop, texture, lens, chrome, frame, letterbox, dissolves, guides) | scene engine | Native Skia/GPU. |
| Native stages (stage block, beat stages, film stages): all element types above | scene engine | Native Skia/GPU; SkSL materials; footage textures; motion blur. |
| The inside of the 33 blocks (titles, charts, diagrams, canvas, kinetic speech, captions, speaker tags, plates, entrances/exits, graphic transitions) | `fframes/native` block code, as an **SVG input layer** | Converted to a usvg tree and drawn by `fframes_skia_renderer::render::render_tree` into the engine's own GPU canvas. Pixel-identical block code in both engines; this is the compatibility path. |
| Encoding | scene engine → FFmpeg (libx264, 2 threads) | Same CRF/preset/AQ and BT.601 limited-range conversion as before; the finisher's tags are unchanged. |
| Audio, captions files, receipts, revisions, Studio | unchanged | The engine only replaces picture rendering. |

So FFFrames is still a dependency: its SVG tree builder (usvgr), its Skia tree renderer and its media crate (footage decoding, vendored with its patch). Its frame loop, encoder, previewer-driven film compositing and fixed `const W, H, FPS` video type are no longer used by the default engine. Porting each block's internals to native elements, then removing the SVG input layer, is the remaining migration ([coverage](scene-engine-coverage.md)).

## Commands and the serve protocol

`clearframe-scene --plan PLAN [--scale S] [--draft] COMMAND`:

| | |
|---|---|
| `frame 120,4.2s -o DIR` | PNG stills (frames, or seconds rounded to the nearest frame as FFFrames resolved them) |
| `render [A..B] -o OUT.mp4 [--report R.json]` | H.264 of film frames [A, B) on the film's own clock; draw and readback times in the report |
| `inspect [--every 0.25s]` | sampled block-converter diagnostics plus native errors and clipped native type, in the FFFrames report format `check` reads; exit 2 on errors |
| `audit FILE` | the frame audit (held type cut by the frame or letterbox, over other type or a subject, too small) over block type **and** native type |
| `bench [A..B]` | draw + readback per frame, without encoding |
| `serve` | JSON lines on stdin: `{id, cmd: open|frame|render|inspect|audit|info|quit, …}`; the GPU context, fonts, decoders and shader programs stay warm between requests |

The Node side never calls these directly: `scene/engine.mjs` maps the commands `prepare`, `render`, `revise`, `sheet`, `still`, `check` and the range previews already use.

## Range renders keep the film's clock

A range is film frames [A, B) of the full plan: every beat keeps its place, a stage spanning the range keeps its state, and a dissolve into the range still shows the outgoing beat. The finisher cuts the matching samples from the full mix and checks the first, last and first-cut frames against frames drawn directly at those film positions (PSNR, as before). Stills, sheets, ranges and full films all call the same frame function.

## Decisions

- **Independent implementation, no Psychopomp code.** The upstream repository has no license (re-checked through the GitHub API on 2026-10-05: `license: null`, `main` 6fca3bc). Ideas are taken from the research (actors with persistent identity, an event vocabulary compiled to time tracks, packets on connectors, callouts riding moving objects, stepped code diffs); no upstream code or assets.
- **Skia (Ganesh/Metal) directly, not wgpu.** Skia gives shaped text with the bundled fonts, anti-aliased vectors, image filters and SkSL runtime shaders, and it can draw the SVG input layers into the same canvas — one compositor, not two. `skia-safe 0.153.3` with the prebuilt-binary feature set was already in the lock graph and warm cache. wgpu would have needed a new text/vector stack plus Skia/resvg for SVG content, and a cold build of new crates on an 8 GB machine.
- **One authoring language.** The storyboard is the only authored document; stages use the canvas element dialect; recipes compile in JavaScript (no Rust per film, no Rust rebuild per content change); the plan is a compiled, hashed artifact.
- **Integrate first, port blocks after.** All 45 playbooks render through the new engine from the first commit, with block internals as SVG input layers; each block can then be ported with the old output as its pixel oracle.

## Limits

- The block internals are still FFFrames SVG; their look is unchanged and so is their cost.
- Particles are batched draws, not GPU compute; thousands, not millions.
- Motion blur multiplies a stage's draw cost by its samples.
- Readback plus an FFmpeg pipe replaces FFFrames' in-process GPU YUV conversion: see [measured results](scene-engine-coverage.md#measurements) before assuming either is faster.
- GPU output is deterministic on one backend; bit-identical pixels across GPUs are not promised. The raster fallback (no Metal) is untested outside macOS.
- `serve` keeps one plan open; reopening leaks the previous job's parsed film (small) for the life of the process.
