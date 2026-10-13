# Returning to fframes

**Status: in progress on branch `fframes-return`.** Numbers below are measured on this machine
(M1 iMac, 8 GB, macOS) unless marked otherwise. Sections marked _planned_ are not built yet.

## Decision

ClearFrame goes back to [fframes](https://github.com/dmtrKovalenko/fframes) (MIT core, pinned in
`archive/fframes/upstream.json`) as the **film runtime**, and keeps its own engine as the
**frame painter**:

- fframes owns the film as a timeline: duration and format (`fframes::Video`), the render
  schedule (`FrameScheduler`: the same GOP-aligned segments on every render, fframes #208),
  in-process FFmpeg/libx264 encoding of those segments in parallel (`SegmentWriter`), and
  concatenation (`concatenator`). Next it can own the audio mix (`AudioMap`: sample-exact
  placement, fades, ducking under the voice, a lookahead limiter) and its analysis
  (`analyze_audio`: LUFS, true peak, silent ranges), and expose its other interfaces
  (FFT `visualize_audio_frame`, `Shader`, synced video frames, the native preview player,
  the CLI's `strip`/`onion`/`inspect`, and fframes-3d once it is released).
- ClearFrame keeps drawing every pixel with its display list on a Skia canvas: the 33 blocks,
  native stages, materials, motion blur, the lens and film compositing (`scene/native/src/`
  `blocks/*`, `nodes.rs`, `draw.rs`, `text.rs`, `compose.rs`). fframes calls it through a custom
  `FFramesRenderBackend` (`scene/native/src/runtime.rs`).

### Why this split, and not svgr trees again

Two ways to put ClearFrame's pictures inside fframes were evaluated against the code:

| | A. ClearFrame backend for fframes (chosen) | B. Display list → `usvgr` nodes |
|---|---|---|
| How | `FFramesRenderBackend::render` reuses fframes' public `FrameScheduler`, `SegmentWriter` and `concatenator`; each fframes worker opens its own `Engine` and submits the RGBA it draws | Convert `draw::Node` to `usvgr::Tree` so fframes' Skia/tiny-skia renderers draw it |
| Pictures | Unchanged, bit-for-bit the same compositor | Every node type needs an SVG equivalent: SkSL materials become shader image layers, temporal motion blur becomes repeated subtrees, Skia image-filter graphs become SVG filters, glyph outlines become paths |
| Merges with block work on main | Clean: no block, node, draw or text file changes | Every painter changes |
| fframes changes | None (public API at the pinned revision) | None, but a large converter |
| What fframes adds now | Timeline, parallel GOP-aligned encode, in-process libx264, concat/mux, (next) audio | Same, plus fframes' own renderers |
| Risk | fframes' `render_backend` runtime API is documented as unstable for custom backends | A second implementation of every visual, regressions in text/filters |

The previous integration (September 2026, commits 3c2cfc2 → 0be3b18, retired in daf189a) was B in
its original form: blocks emitted `svgr!` trees. It was retired because the converter and
per-frame SVG trees cost more than they gave. A keeps everything that retirement gained and
adds what fframes does best: the render/encode/mux runtime.

### Format and rate are types in fframes

`Video::FPS`, `WIDTH` and `HEIGHT` are associated constants. ClearFrame's canvases
(`film/catalog.mjs` `CANVASES`: 1920×1080, 1080×1920, 1080×1080, 1080×1350, 640×360) and rates
(24, 25, 30, 50, 60) are dispatched at run time to `runtime::Film<W, H, FPS>` (25 small types,
as the old integration did). Draft and `--scale` sizes use `RenderOptions::scale_resolution`;
fframes' `VideoSize::new_scaled` rounds to even sizes exactly as `Engine::open` does, and every
worker checks that its engine draws at fframes' output size.

## Mapping: every scene-engine piece

| Scene engine (`scene/native/src`) | After the return | Notes |
|---|---|---|
| `main.rs` `render [A..B]` | **fframes** (`runtime::render` → `fframes::render` with `runtime::Backend`) | Range renders keep the film clock through `RenderOptions::frame_range` |
| `main.rs` `frame`, `inspect`, `audit`, `bench`, `info`, `serve` | ClearFrame engine | Stills and diagnostics need no encoder; they draw with the same `Engine` the fframes workers use |
| `encode.rs` (FFmpeg child, RGBA pipe, BT.601 limited, libx264 2 threads) | **fframes** `SegmentWriter` (in-process libav, libx264, one codec thread per segment, segments in parallel) | Same CRF/preset/aq-mode/GOP; kept as the `CLEARFRAME_RUNTIME=scene` path while parity is checked |
| `gpu.rs` (Metal context, surfaces, readback) | ClearFrame | One Metal context per fframes worker |
| `compose.rs` (beats, dissolves, stages, motion blur, lens, chrome, grain, letterbox) | ClearFrame | Unchanged |
| `blocks/*`, `nodes.rs`, `draw.rs`, `paint.rs`, `fx.rs`, `text.rs`, `fonts.rs`, `materials.rs`, `icons.rs`, `geometry.rs`, `motion.rs`, `numbers.rs`, `design.rs` | ClearFrame | Unchanged |
| `media.rs` footage (ffmpeg/ffprobe pipes, exact timestamps, any seek order) | ClearFrame for now; fframes `get_synced_video_frame` is the candidate | Each worker has its own decoders; segment starts seek accurately |
| `film.rs` (backdrop, grain, leaks, frame, letterbox) | ClearFrame | |
| `audit.rs`, `inspect.rs` | ClearFrame | fframes' `inspect` checks svgr trees, which ClearFrame does not build |
| Node finisher: packet timeline, mix, loudness, mux, tags, frame-count check, receipt | Node, unchanged | The fframes MP4 has no audio stream; the finisher muxes the mix as before |
| Audio mix (`engine/lib/audio.mjs`) | _planned:_ fframes `AudioMap` + `analyze_audio` | Needs bed looping, the silent-beat gate, room tone and two-pass loudness matched first |

## What is gained, what is at risk

Gained now: parallel GOP-aligned segment encoding with deterministic cuts; in-process encoding
(no RGBA pipe to a child process); fframes' render runtime and its upstream fixes (#202 failed
conversions, #215 abort latency, #200 BT.709 when we choose it).

Available next through the same runtime: `AudioMap` mixing and `analyze_audio`; FFT audio
features for audio-reactive pictures; the native preview player; `Shader`/svgr overlay layers
for fframes-authored pictures; fframes-3d (announced, not released at the pinned revision).

Risks:
- **Licensing.** `h264` + `libav-agree-gpl` statically link a GPL FFmpeg with x264 into the
  renderer binary (the old integration did the same). The scene engine only shelled out to the
  machine's `ffmpeg`. Distributing the binary is a GPL question; a VideoToolbox build
  (LGPL, hardware H.264) is the alternative to evaluate.
- **Memory.** Each worker holds an engine (surfaces, glyph caches, footage decoders) and an
  encoder. Measured below; `CLEARFRAME_RENDER_WORKERS` caps it (default 2 on this 8 GB Mac).
- **Bytes differ from the single-stream encode.** Segments restart rate control at GOP
  boundaries; decoded pictures are compared below, not file hashes.
- **Custom-backend API stability.** fframes documents `FFramesRendererRuntime` as unstable for
  custom backends; the git dependency is pinned to an exact revision.
- **Build.** First build fetches the fframes workspace and a prebuilt static FFmpeg
  (`~/Library/Caches/ffmpeg-sys-fframes`, ~110 MB) and grows the binary.

## Evidence

_Filled in from measured runs; see below._

## Staged migration

1. **Runtime for `render`** behind `CLEARFRAME_RUNTIME=fframes` (done when parity holds).
2. **Default runtime**: fframes renders every film; `CLEARFRAME_RUNTIME=scene` keeps the old pipe
   for comparison until it is deleted.
3. _Planned:_ audio through `AudioMap` (bed looping, ducking, gate, room tone, loudness target),
   compared against the Node mix with `analyze_audio` and the existing `qa` loudness checks.
4. _Planned:_ fframes interfaces for authors: audio features for audio-reactive canvases, svgr/
   `Shader` overlay layers, fframes-3d hero layers once released.
