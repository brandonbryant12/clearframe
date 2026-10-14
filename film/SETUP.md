# Native setup

## Requirements

You need:
- Node 20.10 or newer.
- Rust 1.88 or newer (rustup recommended).
- The Xcode command-line tools.
- FFmpeg and ffprobe with libx264.

The renderer (`scene/native`, Skia on Metal) depends on these crates: `skia-safe` (pinned with a feature set rust-skia publishes prebuilt binaries for, so Skia is never compiled), `metal`, `rustybuzz`, `kurbo`, `serde` and `fframes` (pinned to an exact upstream revision; the film runtime). fframes links a prebuilt static FFmpeg with libx264 (GPL) from `ffmpeg-sys-fframes`, downloaded once into `~/Library/Caches/ffmpeg-sys-fframes`, and encodes in process. Footage is still decoded through `ffmpeg`/`ffprobe` pipes, and the finisher still mixes and muxes with the `ffmpeg` tool. A cold build of the fframes dependencies takes about 20 minutes with one Cargo job; later builds are incremental. This revision is verified on Apple Silicon. Without Metal the renderer falls back to Skia's raster backend, which is untested.

On macOS:

```sh
xcode-select --install
brew install ffmpeg
# Install Rust from https://rustup.rs if ~/.cargo/bin/rustc is unavailable.
export PATH="$HOME/.cargo/bin:$PATH"
node engine/cli.mjs doctor
node engine/cli.mjs build
```

The CLI prefers `~/.cargo/bin` ahead of an older Homebrew Rust. `build` compiles the renderer into `scene/.cache/target` (ignored) with one Cargo job. Builds are release builds against `Cargo.lock`, and nested workers are capped at two. Every render command rebuilds the renderer first when its sources changed. A warm build of the crate takes under a minute on this Mac.

Before building, check free disk: allow **25 GiB for a cold build** (the prebuilt Skia download and the dependency graph) and keep **10 GiB free with a warm cache**. `scene/.cache` is reusable and ignored; deleting it forces a cold build. Project `build/` outputs can be regenerated; keep original recordings and source media.

The active Node workflow needs no npm packages. `npm ci` can establish the empty dependency lock. For full tests:

```sh
npm test
env CARGO_TARGET_DIR=scene/.cache/target cargo test --manifest-path scene/native/Cargo.toml --release --locked --jobs 1 -- --test-threads=2
```

## Native verification and rendering

`scripts/verify-native.mjs` builds the renderer and runs its Rust tests with the build environment, then renders galleries, stills, sheets and a long-form mux regression.

Media is staged into the prepared folder automatically and fonts load from there. Each of the two render workers uses its own Metal context and encodes its segments with two libx264 threads; footage decoders run `ffmpeg` with at most two threads. The finishing step mixes the authored sound once, muxes it, and verifies the final MP4's dimensions, frame rate and decoded frame count.

`preview` creates a review MP4. A live native editor or player is not part of this release. Set `GEMINI_API_KEY` only for explicitly requested paid media generation. Audio and timestamp imports stay offline.

Full high-resolution finals need at least a **five-minute (300,000 ms) external execution allowance**, including the shared audio mix and mux. Longer films can take more than that: use a resumable process session and monitor it, rather than treating a yield as failure or launching duplicate renders. The CLI imposes no 120-second render deadline.

FFFrames drew ClearFrame films (as `svgr!` trees) until early October 2026. Since 2026-10-12 it is back as the runtime only: ClearFrame's engine draws every frame through a custom render backend, and fframes schedules, encodes and concatenates (`CLEARFRAME_RENDER_WORKERS`, default 2; `CLEARFRAME_ENCODER_THREADS` per segment, default 2). Its revision and MIT notice are in `../archive/fframes/`; see `../docs/fframes-return.md`.
