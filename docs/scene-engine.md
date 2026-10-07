# The scene engine

ClearFrame renders every film with the **scene engine** (`scene/`), its only renderer: a ClearFrame-owned scene plan evaluated frame by frame and drawn with Skia on the GPU (Metal on macOS). It draws everything on screen itself: the 33 blocks, native stages, film compositing and footage. Its dependencies are Skia, Metal, a text shaper and the FFmpeg tools. FFFrames, which drew ClearFrame films until October 2026, is retired; its revision and notice are kept in `archive/fframes/`.

This page is the design and the authoring reference. The plan review that chose this design is summarised under [Decisions](#decisions); [coverage](scene-engine-coverage.md) lists every block, sketch, treatment and playbook with its state.

## In one picture

```
storyboard.json ─► timing, words, sources, data transforms           (unchanged)
                ─► createJob (film/job.mjs)  → build/native/job.json   block validation and scheduling
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

## Identity and builds

The prepared manifest and every receipt record the renderer's source hash (its Rust sources, `Cargo.toml`, `Cargo.lock` and the shared `film/constants.json`), the plan's SHA-256, font hashes and input hashes. A render fails if any of them change during the render.

`clearframe build` builds the renderer, and every render command builds it first when its sources changed. The Cargo target lives in `scene/.cache/target` (ignored). Builds use one Cargo job through `codex-heavy`. `skia-safe` is pinned with the feature set rust-skia publishes prebuilt binaries for (`gl, metal, svg`), so Skia itself is never compiled.

## Native stages

A **stage** is a list of native elements the engine draws itself, on the GPU, on its own clock. Three places declare one; all compile with the same recipes:

```jsonc
// 1. A stage block: the beat's picture is a native stage. The block still draws the heading,
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

Stage elements use the canvas block's vocabulary ([canvas.md](canvas.md)): `rect, circle, ellipse, line, path, poly, text, icon, image, group, particles, spotlight` with `fill/stroke` tokens and gradients, `enter` (fade, pop, rise, drop, left, right, grow, grow-x, grow-y, draw, wipe, wipe-up, type, scramble, blur, none), `at/say/dur`, `keys` (x, y, scale, rotate, opacity, scaleX, scaleY, blur, tiltX, tiltY — and now **fill/stroke colours**), `along`, `loop` (spin, pulse, float, sway, orbit, dash, blink, rock), `exit`/`exitAt`/`exitSay`, `echo`, `tilt`, `shine`, `glow`, `shadow`, `blur`, `blend`, `z`, `fps`. The rules (default entrances and durations, keys easing from the previous state, values that never overshoot, stroke draw-on) follow the canvas block (`scene/native/src/blocks/canvas.rs`), so an element means the same thing in a canvas and on a stage.

Features the canvas block draws but stages do not — `rough`, `print`, `mosaic`, `morph`, `solid`, `meter`, `loop: level` — are **refused by name** when a stage uses them (`box uses rough, which the canvas block draws; native stages do not`). Keep them in a `canvas` beat or `art`.

New element types and properties only the engine draws:

| | |
|---|---|
| `video` | Footage as a GPU texture: `{file|asset, x, y, w, h, r, fit: cover|contain, focusX, focusY, offset, rate, hold, treatment}`. Decoded at the size drawn (see [footage](#footage)). A clip shorter than its time on screen — including a following dissolve — fails at prepare time; footage never loops, and freezes only with `hold: true`. |
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
- **code** — inline `lines`+`steps`, `before`/`after` text, or **from git**: `{commit, file, base?, repo?, window: [first, last] | context}`. The plan records the full commit, base and blob ids in `manifest.provenance`; the title reads `file @ shortsha`. The editor stays inside the stage area (title-safe, below the heading, above the source line). Its type shrinks to the longest line, measured in IBM Plex Mono's exact 0.6 em advance, but not below 24 px; a line still too long wraps at a token boundary with a hanging indent, and its pieces move, wash and focus as one line. On a tall frame, width is short and height plentiful, so a long line wraps at the authored size instead of shrinking. A code-only stage there takes the stage's full width at 34 px and is centred down it, so the lines stay readable on a phone. `h` (or the area's height) fits the rows and refuses any smaller than 20 px.
- **Frame fit.** Positions are pixels of the frame the stage is drawn for. A stage drawn for a wide frame and shown in a tall one (its actors would leave the frame) is laid down the tall frame: left-to-right order becomes top-to-bottom inside the stage area, below any editor; `move` targets and camera keys follow the same mapping, and `check` says it happened. Callout tags are pulled back inside the area wherever their actor stands. Give a tall film tall positions for exact placement; a stage that already fits is never moved.
- **ground** `{material, colors, opacity, scale, speed, z}` — a full-frame material behind the stage.

### Camera, depth and motion blur

`camera: {x, y, zoom, rotate, z, keys: [{at|say, x, y, zoom, rotate, z, dur, ease}], focus: {z, aperture, keys}}` is a 2.5D camera: elements with `z` (0 the picture plane, positive farther) scale with perspective as the camera dollies (`z`), move by 1/(1+z) of a pan (parallax), disappear once passed, and blur with distance from the focus plane — except type, which stays readable. Camera and depth apply at a stage's top level; group children move with their group.

`shutter` (0–1 of a frame) with `samples` (default 8, at most 32) is **temporal motion blur**: the stage is evaluated at `samples` instants across the open shutter and accumulated in half float. Footage stays on its decoded frame inside one output frame. It costs about one stage draw per sample; leave it off for still stages.

## Blocks

The 33 blocks are drawn by `scene/native/src/blocks/` (the block code ClearFrame has always owned, moved into the renderer). Each block builds a **display list** for its frame (`draw::Node`): groups with a transform, opacity, clip, mask, blend mode or filter; shapes (Skia paths with fills, gradients and strokes); text runs; and pictures. `draw::paint` draws it on the frame's GPU canvas, and the frame audit reads the same tree, so what is judged is exactly what is drawn.

- **Type** is shaped once, with rustybuzz over the bundled OFL fonts. The same shaping measures, wraps and fits the text, and the glyphs are drawn by id with Skia typefaces built from those files, so measurement and pixels cannot disagree. A text that does not fit its box fails the frame, with the scene and box named, instead of spilling.
- **Effects** keep SVG filter semantics (`fx.rs`): shadows, glows, blurs, image treatments (mono, duotone, tint, blur, soft), the thermal look and worn print are Skia image-filter graphs confined to their region, in linear-light or sRGB as authored.
- **Shared code** sits beside the renderer, not inside a block: `text` (faces, shaping, layout, fitting), `design` (palettes and colour arithmetic), `motion` (easing, entrances and exits), `icons` (the pinned Tabler subset), `numbers` (grouping, signs, zero baselines), `audit` (the frame audit) and `constants` (timings shared with `film/`).

A beat with native `under` layers is drawn in two parts: its ground (tone, plate), then the stage, then its content. That way a stage sits between a plate and the heading.

## Film-level compositing

The engine composites the film itself:

- **Backdrop** `grid, dots, glow, paper, mosaic`, **texture** (grain and vignette), `chrome`, the editorial `frame` and the review grid. Paper and grain are Skia's fractal noise with fixed colour matrices; grain is opaque grey at the texture's opacity.
- **Lens**: grade (a saturation matrix and transfer tables), bloom (threshold, blur, screen) and chromatic aberration (channel split and offset), as one GPU image-filter graph over the picture. Handheld, light leaks and letterbox bars are drawn over it.
- **Dissolves** are two real layers: the outgoing beat (its block and its native layers) runs on under the incoming one, whose layer fades up. The outgoing words clear in the first third.

## Footage

Footage (stage `video` elements, plates and the `video` block) is decoded by the `ffmpeg` and `ffprobe` tools, which ClearFrame already needs to encode and mix:

- **Bounded memory.** Each open clip is one `ffmpeg` process streaming RGBA through a pipe, at no more than the size drawn. At most six clips are open at once, each holding one frame. There is never a raw cache of a clip.
- **Exact timing.** `ffprobe` lists the clip's presentation timestamps once. Film time *t* shows the latest source frame at or before *t*. The clip ends at the end of its last sample: the end is exclusive and rounded up to the film's frame grid, so 49 frames at 24 fps still show their final sample at frame 61 of a 30 fps film.
- **Any order.** Small forward steps read on through the pipe. A backward step or a far jump restarts the decoder with an accurate seek just before the wanted frame, so every frame comes out the same in any order.
- **Colour.** FFmpeg's `scale` filter converts with the source's tagged matrix and range. Untagged sources are BT.601 limited range.

The decoder's regression tests (a delayed final B-frame, a higher film rate, a non-integral end, and backward seeks) use the fixtures in `scene/native/tests/fixtures`.

## Commands and the serve protocol

`clearframe-scene --plan PLAN [--scale S] [--draft] COMMAND`:

| | |
|---|---|
| `frame 120,4.2s -o DIR` | PNG stills (frames, or seconds rounded to the nearest frame) |
| `render [A..B] -o OUT.mp4 [--report R.json]` | H.264 of film frames [A, B) on the film's own clock; draw and readback times in the report |
| `inspect [--every 0.25s]` | sampled frames that cannot be drawn (overflowing text, missing media, stage errors) and type cut by the canvas edge, in the text report `check` reads; exit 2 on errors |
| `audit FILE` | the frame audit (held type cut by the frame or letterbox, over other type or a subject, too small) over block type **and** native type |
| `bench [A..B]` | draw + readback per frame, without encoding |
| `serve` | JSON lines on stdin: `{id, cmd: open|frame|render|inspect|audit|info|quit, …}`; the GPU context, fonts, decoders and shader programs stay warm between requests |

The Node side never calls these directly: `scene/engine.mjs` maps the commands `prepare`, `render`, `revise`, `sheet`, `still`, `check` and the range previews already use.

## Range renders keep the film's clock

A range is film frames [A, B) of the full plan: every beat keeps its place, a stage spanning the range keeps its state, and a dissolve into the range still shows the outgoing beat. The finisher cuts the matching samples from the full mix and checks the first, last and first-cut frames against frames drawn directly at those film positions (PSNR, as before). Stills, sheets, ranges and full films all call the same frame function.

## Decisions

- **Independent implementation, no Psychopomp code.** The upstream repository has no license (re-checked through the GitHub API on 2026-10-05: `license: null`, `main` 6fca3bc). Ideas are taken from the research (actors with persistent identity, an event vocabulary compiled to time tracks, packets on connectors, callouts riding moving objects, stepped code diffs); no upstream code or assets.
- **Skia (Ganesh/Metal) directly, not wgpu.** Skia gives anti-aliased vectors, gradients, image filters, SkSL runtime shaders and glyph drawing in one GPU canvas. `skia-safe 0.153.3` with a prebuilt-binary feature set builds without compiling Skia. wgpu would have needed a new text and vector stack, plus a cold build of new crates on an 8 GB machine.
- **One renderer, no fallback.** FFFrames was removed outright rather than kept selectable. The block code was always ClearFrame's own and was moved, not rewritten: layout, fitting, chart scales, diagram geometry, speech and caption timing are the same functions. Only their output changed, from an SVG tree for usvg to a display list for Skia.
- **A display list, not SVG text.** Blocks build typed nodes from Skia values. There are no id references, no converter and no per-frame SVG parsing; SVG remains only an asset format.
- **Footage through the FFmpeg tools.** One process per open clip replaced a statically linked FFmpeg and a vendored decoder patch, and the same exact-end rule is now a tested property of `media.rs`.
- **One authoring language.** The storyboard is the only authored document; stages use the canvas element dialect; recipes compile in JavaScript (no Rust per film, no Rust rebuild per content change); the plan is a compiled, hashed artifact.

## Limits

- The canvas element dialect has two implementations: the canvas block (`blocks/canvas*.rs`) and native stages (`nodes.rs`). Stages refuse the canvas-only features by name.
- Particles are batched draws, not GPU compute; thousands, not millions.
- Motion blur multiplies a stage's draw cost by its samples.
- GPU output is deterministic on one backend; bit-identical pixels across GPUs are not promised. The raster fallback (no Metal) is untested outside macOS.
- `serve` keeps one plan open; reopening leaks the previous job's parsed film (small) for the life of the process.
