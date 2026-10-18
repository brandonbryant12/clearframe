# Returning to fframes

**Status: stages 1 and 2 done on branch `fframes-return`** — every render runs through fframes;
`CLEARFRAME_RUNTIME=scene` keeps the old FFmpeg pipe for comparison. Numbers below were measured
on this machine (M1 iMac, 8 GB, macOS 26) on 2026-10-12 while other agents were working, so each
timing is the best (and median) of interleaved runs, with the load average recorded. Sections
marked _planned_ are not built yet.

## October 18 runtime update

The runtime is pinned to upstream main
[`28356c5b5473`](https://github.com/dmtrKovalenko/fframes/commit/28356c5b5473fc3281167e3b2baff12a0d204a67),
25 commits after the previous `62f6673` pin. The latest tagged release is still `v1.2.0`
(October 3); using that tag would move backwards. The MIT notice was checked at the new
revision and its hash is unchanged. `Cargo.lock` pins the resolved dependencies.

This incorporates encoder frame-colour metadata (#232), the lru dependency update (#229),
svgr/usvgr 0.50.2, and media decoder size/duration fixes. The scheduler and encoder remain
the active integration. Upstream's new Lottie adapter, native preview window, SVG inspection,
and per-track audio APIs do not become authoring features merely by updating the dependency:
ClearFrame still draws its own native display list and mixes its audio in Node.

Full and range render receipts now retain the native render report. It records the selected
encoder, the parameters supplied to it, negotiated pixel format and YUV matrix, actual worker
and segment counts, and the number of frames converted by the GPU, CPU, or upstream converter.
The final delivery's decoded colour tags remain separate: BT.709 primaries, sRGB transfer
(`iec61966-2-1`), BT.601 matrix (`smpte170m`), TV range. Timing fields sum work across workers;
they are not additive wall-clock phase durations. This exposes a conversion fallback instead
of labelling every render with the requested path.

`scripts/verify-runtime.mjs NEW-DIR [PREVIOUS-NATIVE-BINARY]` renders real 1920×1080 and
1080×1920 fixtures with one/two workers and forced CPU conversion. It checks all decoded frame
hashes across worker counts, all frame/stream colour tags, frame and segment counts, receipt
settings, and the outermost portrait columns (1080 is not a multiple of 16). A previous binary
adds an independent before/after decoded-frame comparison. On October 18 all six exports
passed; every frame matched the previous runtime. GPU/CPU middle-frame PSNR was 66.70 dB
landscape and 64.21 dB portrait on these fixtures. These are narrow compatibility measurements,
not a performance or whole-library quality claim. Keep the generated evidence outside git.

Run it through `codex-heavy` on this machine. Builds now recognize an inherited heavy gate,
including an outer `codex-heavy -- node engine/cli.mjs build`, instead of waiting on their
own parent lock. A dependency upgrade should use an isolated build target so it does not
replace another checkout's cached renderer.

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
- ClearFrame keeps drawing every pixel with its display list on a Skia canvas: the 31 blocks,
  native stages, materials, motion blur and film compositing (`scene/native/src/`
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
| `encode.rs` (FFmpeg child, RGBA pipe, BT.601 limited, libx264 2 threads) | **fframes** `SegmentWriter` (in-process libav, libx264, two codec threads per segment, two segments at once) | Same CRF/preset/aq-mode/250-frame keyframe interval; `encode.rs` stays as the `CLEARFRAME_RUNTIME=scene` path until it is deleted |
| RGBA → YUV (FFmpeg's `scale` filter in the child) | ClearFrame `yuv.rs`, on the GPU | fframes' own converter point-samples chroma (measured ~3 dB worse) |
| `gpu.rs` (Metal context, surfaces, readback) | ClearFrame | One Metal context per fframes worker; readback is three one-channel planes |
| `compose.rs` (beats, wipes, stages, motion blur, chrome, grain) | ClearFrame | Unchanged |
| `blocks/*`, `nodes.rs`, `draw.rs`, `paint.rs`, `fx.rs`, `text.rs`, `fonts.rs`, `materials.rs`, `icons.rs`, `geometry.rs`, `motion.rs`, `numbers.rs`, `design.rs` | ClearFrame | Unchanged |
| `media.rs` footage (ffmpeg/ffprobe pipes, exact timestamps, any seek order) | ClearFrame for now; fframes `get_synced_video_frame` is the candidate | Each worker has its own decoders; segment starts seek accurately |
| `film.rs` (backdrop, grain, frame) | ClearFrame | |
| `audit.rs`, `inspect.rs` | ClearFrame | fframes' `inspect` checks svgr trees, which ClearFrame does not build |
| Node finisher: packet timeline, mix, loudness, mux, tags, frame-count check, receipt | Node, unchanged | The fframes MP4 has no audio stream; the finisher muxes the mix as before |
| Audio mix (`engine/lib/audio.mjs`) | _planned:_ fframes `AudioMap` + `analyze_audio` | Needs bed looping, the silent-beat gate and two-pass loudness matched first |

## What is gained, what is at risk

Gained now: parallel GOP-aligned segment encoding with deterministic cuts; in-process encoding
(no RGBA pipe to a child process); GPU 4:2:0 conversion (a third of the readback); about a third
less render time on encode-bound films; fframes' render runtime and its upstream fixes (#202
failed conversions, #215 abort latency, #200 BT.709 when we choose it).

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

Method: the same prepared plan rendered by the native binary with each runtime
(`clearframe-scene --plan … render`), wall time and peak resident memory of the whole process
tree (engine + FFmpeg child for the old pipe) sampled every 0.1 s; decoded pictures compared
with FFmpeg's `psnr`/`ssim` between runtimes, and each runtime's decoded frames compared in RGB
with the engine's own PNG stills of the same frames ("truth"), including frames on both sides
of a segment cut. Scripts are not committed (they live with the evidence in the scratchpad);
the commands are reproducible from this description.

### Pictures

| Film (1920×1080, 30 fps, final quality) | Between runtimes | Against the engine's stills (RGB PSNR) |
|---|---|---|
| native-explainer (530 frames; example since removed) | PSNR 58.5 dB, SSIM 0.99977 | frames 15, 120, 239, 240, 241, 400, 529: old pipe 40.91–44.96 dB, fframes 40.98–44.96 dB (within ±0.3 dB; cut at 240) |
| `examples/finance-charts` (3,630 frames) | PSNR 60.6 dB, SSIM 0.99979 | frames 120, 900, 1800, 2700, 3600: old pipe 44.28–47.11 dB, fframes 44.39–47.12 dB (equal or better at every frame) |
| stage-footage (378 frames; footage, motion blur, depth of field; example since removed) | PSNR 52.1 dB, SSIM 0.99526 | frames 10, 120, 249, 250, 251, 300, 377: within 0.06 dB |

Both runtimes produce the same frame count, size, rate, pixel format and colour tags; the Node
finisher's decoded frame-count validation, colour tags and range-preview clock check (43.7–46.4
dB against film frames) pass through the new path.

Two fframes defaults were measured and replaced:

- **Chroma.** fframes' built-in yuv420p converter takes each 2×2 block's top-left pixel and floors
  it; against the stills it was 2.8–3.1 dB worse (charts frame 120: 43.98 vs 47.11 dB).
  `yuv.rs` averages the block and rounds, on the GPU (SkSL into three one-channel planes read
  straight into the encoder's frame: 1.5 bytes a pixel cross to the CPU instead of 4), with a CPU
  fallback that does the same.
- **Segment length.** fframes' default minimum segment is one second, so the charts film was cut
  into 121 one-second segments, each opening with a keyframe: 7.48 MB against the old pipe's
  2.58 MB at the same CRF. Whole-GOP segments (250 frames; whole seconds cutting short films into
  about four) give 2.70 MB (+5%).

### Speed and memory

Best (median) wall time of interleaved runs, whole process tree peak:

| Film | Old pipe | fframes runtime (2 workers × 2 x264 threads) | Load average |
|---|---|---|---|
| finance-charts, final (121 s) | 16.90 s (17.29) · 750 MiB | **10.89 s (11.46)** · 880–1,107 MiB | 10–19 |
| finance-charts, draft 960×540 | 6.51 s (6.71) · 157 MiB | **4.66 s (5.01)** · 218 MiB | 8–9 |
| native-explainer, final (17.7 s) | 4.43 s (4.64) · 746 MiB | **2.96 s (3.15)** · 950 MiB | 6–8 |
| stage-footage, final (12.6 s) | 15.94 s (16.43) · 1,351 MiB | 14.42 s (16.15) · 1,339 MiB; 1 worker 19.65 s | 13–26 |

Encode-bound films (charts, type, held frames) render about a third faster: x264 runs in two
segments at once and the CPU no longer converts RGBA. GPU-bound films (footage, motion blur) are
at parity: two Metal contexts share one GPU. Peak memory is up to ~350 MiB higher with two
workers; `CLEARFRAME_RENDER_WORKERS=1` keeps it near the old pipe. The binary grows from 19 MB to
38 MB (static FFmpeg + x264). A cold build of the new dependencies took 19 minutes with one Cargo
job (the image crate's AVIF encoder, which fframes enables, is the slowest part); incremental
builds take 10–50 s as before.

Tests on the branch: Rust 75/75 (with new 4:2:0 tests), Node 413 (412 pass, 1 skipped; the studio
test needs a `build/` folder in a fresh worktree).

### Where a render's time goes (2026-10-13)

A 48 s workplace draft (1,454 frames at 1080p, static grain, voice only), measured per phase:

| Step | Before | After | What changed |
|---|---|---|---|
| native render (fframes, 2 workers) | 5.5 s | 4.4 s | grain noise cached per engine (frames bit-identical); one YUV readback a frame instead of three (same bytes) |
| audio mix | 3.0 s, after the render | 0.4–0.8 s, beside the render | `ebur128` instead of `loudnorm`'s 192 kHz analysis; mixed and AAC-encoded while the picture renders |
| mux | 1.1 s | 0.05 s | stream copy of the pre-encoded audio |
| decoded frame count | 1.0 s | 0.6 s | four decode threads |
| `qa` | 2.8 s | 1.7 s | sheets and loudness read the film beside the picture decode |
| whole `draft` | about 14.5 s | 9.5–9.9 s | |

A draft is GPU-bound: readback (where each worker waits for its frame) is most of the time, about a third of it a fixed cost per frame that resolution does not change, and a third worker gains 10%. Skia's Ganesh bindings do not expose asynchronous readback, which is what pipelining the next frame behind it would need. A final render is encoder-bound (x264 medium): three encoder threads per segment take it from 10.6 to 9.1 s (`CLEARFRAME_ENCODER_THREADS`, the default at that measurement; the October 18 default is two); one worker with four threads is 9.5 s at 519 MiB instead of 880, but GPU-bound films (footage) need the second worker. `superfast` for drafts saved 8% and doubled the file, so drafts stay `veryfast`.

With the mix running beside the render, moving it into fframes' `AudioMap` (stage 3 below) would no longer shorten a render; it remains worth doing only for audio-reactive pictures.

## Staged migration

1. **Runtime for `render`** — done: `runtime.rs`, parity above.
2. **Default runtime** — done: fframes renders every film; `CLEARFRAME_RUNTIME=scene` keeps the old
   pipe (`encode.rs`) for comparison until it is deleted.
3. _Planned:_ audio through `AudioMap` (bed looping, ducking, gate, room tone, loudness target),
   compared against the Node mix with `analyze_audio` and the existing `qa` loudness checks.
4. _Planned:_ fframes interfaces for authors: audio features for audio-reactive canvases, svgr/
   `Shader` overlay layers, fframes-3d hero layers once released.
