# Native setup

## Requirements

You need:
- Node 20.10 or newer.
- Rust 1.88 or newer (rustup recommended).
- The Xcode command-line tools.
- FFmpeg and ffprobe with libx264.

The renderer (`scene/native`, Skia on Metal) depends on these crates: `skia-safe` (pinned with a feature set rust-skia publishes prebuilt binaries for, so Skia is never compiled), `metal`, `rustybuzz`, `kurbo` and `serde`. FFmpeg is used as a tool: the renderer pipes frames to `ffmpeg` to encode, and decodes footage through `ffmpeg`/`ffprobe` pipes, so no FFmpeg libraries are linked. This revision is verified on Apple Silicon. Without Metal the renderer falls back to Skia's raster backend, which is untested.

On macOS:

```sh
xcode-select --install
/Users/brandon/.local/bin/codex-heavy -- brew install ffmpeg
# Install Rust from https://rustup.rs if ~/.cargo/bin/rustc is unavailable.
export PATH="$HOME/.cargo/bin:$PATH"
node engine/cli.mjs doctor
node engine/cli.mjs build
```

The CLI prefers `~/.cargo/bin` ahead of an older Homebrew Rust. `build` compiles the renderer into `scene/.cache/target` (ignored) with one Cargo job through the heavy-job gate. Builds are release builds against `Cargo.lock`, and nested workers are capped at two. The gate is detected automatically; an outer gate is recognized without deadlocking. Every render command rebuilds the renderer first when its sources changed. A warm build of the crate takes under a minute on this Mac.

Before building, check free disk: allow **25 GiB for a cold build** (the prebuilt Skia download and the dependency graph) and keep **10 GiB free with a warm cache**. `scene/.cache` is reusable and ignored; deleting it forces a cold build. Project `build/` outputs can be regenerated; keep original recordings and source media.

The active Node workflow needs no npm packages. `npm ci` can establish the empty dependency lock. For full tests:

```sh
/Users/brandon/.local/bin/codex-heavy -- npm test
/Users/brandon/.local/bin/codex-heavy -- env CARGO_TARGET_DIR=scene/.cache/target cargo test --manifest-path scene/native/Cargo.toml --release --locked --jobs 1 -- --test-threads=2
```

## Optional dimensional art setup

| Functionality | Additional requirement |
|---|---|
| Native KPI, seesaw, contribution stack, quiz and fill-in-the-blank templates | None beyond the native setup above. |
| Play or reuse the bundled `examples/sculptures/` clips | None. Prepared media and editable scenes are included. |
| Prepare new `sculpture` assets or rerender retained `.blend` scenes | Blender installed separately. Recipes were verified with Blender 5.2.2 LTS on this Mac; other versions/platforms need their own check. |
| Encode a sculpture or prepare the feature/teaching replay projects | Existing FFmpeg/ffprobe on `PATH`, with `libx264` and the standard scale, pad, tpad and fps filters. |
| Run the repository's `verify:sculptures` harness | Git, for source revision and dirty-state evidence. |

Download Blender from its [official distribution](https://www.blender.org/download/), or reuse an installed copy. The recipes run inside Blender's bundled Python: no system Python, pip packages, addons, npm dependencies or API keys are needed. ClearFrame does not install or download Blender automatically. Set `BLENDER_BIN` to the executable when `blender` is not on `PATH`; for a standard macOS installation:

```sh
export BLENDER_BIN="/Applications/Blender.app/Contents/MacOS/Blender"
"$BLENDER_BIN" --version
ffmpeg -hide_banner -h encoder=libx264
ffprobe -version
node engine/cli.mjs sculptures
node engine/cli.mjs sculpture petal-reveal --draft --still --dry-run
# Optional bounded render; the destination must not already exist:
node engine/cli.mjs sculpture petal-reveal --draft --still --out /tmp/clearframe-petal-setup
```

`doctor` checks the renderer's toolchain (Rust, Cargo, FFmpeg with libx264, ffprobe, disk) and that the bundled fonts match their recorded hashes; verify the optional Blender executable with the commands above. `sculptures` and `--dry-run` work without Blender. A still pass produces a poster and scene; omit `--still` and use a new output directory for a clip. Asset rendering requires at least 20 GiB free, enters the shared heavy-process gate when available, and caps Blender/FFmpeg CPU threads at two.

No Blender installation is needed for these replays from the bundled masters. Run the scripts from the repository root to prepare self-contained film projects; the reference storyboards in `examples/feature-launch` and `examples/teaching-3d` are source templates, not directly renderable projects.

```sh
node scripts/trajectories/feature-launch.mjs --asset-root examples/sculptures --out /tmp/clearframe-launch-setup --final --render
node scripts/trajectories/teaching-3d.mjs --asset-root examples/sculptures --out /tmp/clearframe-teaching-setup --final --render
```

Omit `--render` to prepare each portable project without rendering its film. Retain its source scenes, asset receipts and exact inputs. See the [asset workflow](../docs/sculptures.md), [KPI direction guide](../docs/kpi-direction.md) and [teaching guide](../docs/teaching-sequences.md). Saved scenes open with Python auto-execution disabled; regeneration through `sculpture` explicitly runs the trusted built-in recipe. Native rendering remains the ordinary film pipeline.

## Native verification and rendering

`scripts/verify-native.mjs` builds the renderer and runs its Rust tests with the build environment, then renders galleries, stills, sheets and a long-form mux regression.

Media is staged into the prepared folder automatically and fonts load from there. The renderer uses one Metal context; footage decoders and the encoder each run `ffmpeg` with at most two threads. The finishing step mixes the authored sound once, muxes it, and verifies the final MP4's dimensions, frame rate and decoded frame count.

`preview` creates a review MP4. A live native editor or player is not part of this release. Set `GEMINI_API_KEY` only for explicitly requested paid media generation. Audio and timestamp imports stay offline.

Full high-resolution finals need at least a **five-minute (300,000 ms) external execution allowance**, including the shared audio mix and mux. Longer films can take more than that: use a resumable process session and monitor it, rather than treating a yield as failure or launching duplicate renders. The CLI imposes no 120-second render deadline. To gate a render externally, use `/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node engine/cli.mjs render DIR`, so the same lock is not taken twice.

FFFrames, which drew ClearFrame films until October 2026, is retired. Its revision and MIT notice are kept in `../archive/fframes/`; no FFFrames crate is a dependency.
