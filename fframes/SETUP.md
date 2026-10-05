# Native setup

## Requirements

Node 20.10 or newer, Rust 1.88 or newer (rustup recommended), C/C++ build tools, pkg-config, FFmpeg/ffprobe, NASM, Ninja, and x264/x265/opus development libraries. macOS uses Metal; other platforms use the pinned CPU renderer. This revision is verified locally on Apple Silicon; Linux/Windows require their corresponding native toolchains and separate verification.

On macOS, install Xcode Command Line Tools and the native dependencies:

```sh
xcode-select --install
/Users/brandon/.local/bin/codex-heavy -- brew install ffmpeg nasm ninja pkg-config x264 x265 opus
# Install Rust from https://rustup.rs if ~/.cargo/bin/rustc is unavailable.
export PATH="$HOME/.cargo/bin:$PATH"
node engine/cli.mjs doctor
node engine/cli.mjs build
```

The CLI prefers `~/.cargo/bin` ahead of an older Homebrew Rust. The current machine has a warm release cache and Rust 1.98.1, so no install is needed here. The renderer's upstream revision is pinned in `upstream.json` and `native/Cargo.lock`. It uses the bundled `tools/make` and `tools/ninja-limited` wrappers. Compilation is release/locked, one Cargo job, with nested workers capped at two. The local codex-heavy gate is detected automatically; an outer gate is recognized without deadlocking.

Before installing or building, check free disk. Allow **30 GiB for a cold build**, keep **20 GiB free with a warm cache**. A cold Skia/FFmpeg build can take several minutes and several GiB. `.cache/metal` is reusable and ignored; deleting it forces a cold build. Project `build/` outputs can be regenerated; retain original recordings and source media.

No npm packages are required for the active Node workflow. `npm ci` can establish the empty dependency lock. For full tests:

```sh
/Users/brandon/.local/bin/codex-heavy -- npm test
```

## The scene engine

The default renderer, `scene/native` (`clearframe-scene`), needs nothing beyond the requirements above: it links the same pinned FFFrames crates and the same prebuilt Skia binaries (`skia-safe 0.153.3`), and it encodes through the `ffmpeg` on `PATH` (libx264). `node engine/cli.mjs build` compiles it into `scene/.cache/target` (ignored) with one Cargo job through the heavy gate; when that target is empty it is first seeded from `fframes/.cache/metal` by copy-on-write, so a warm FFFrames cache avoids a cold Skia/FFmpeg build. `build --all` compiles both engines; `--engine fframes` on any command renders with this crate instead. Allow the same disk headroom as the FFFrames build (the two targets together take about 4–5 GiB on this Mac). Engine tests:

```sh
/Users/brandon/.local/bin/codex-heavy -- env CARGO_TARGET_DIR=scene/.cache/target cargo test --manifest-path scene/native/Cargo.toml --release --locked --jobs 1 -- --test-threads=2
node --test test/scene-engine.test.mjs
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

`doctor` checks the native renderer's toolchain; verify the optional Blender executable with the commands above. `sculptures` and `--dry-run` work without Blender. A still pass produces a poster and scene; omit `--still` and use a new output directory for a clip. Asset rendering requires at least 20 GiB free, enters the shared heavy-process gate when available, and caps Blender/FFmpeg CPU threads at two.

No Blender installation is needed for these replays from the bundled masters. Run the scripts from the repository root to prepare self-contained film projects; the reference storyboards in `examples/feature-launch` and `examples/teaching-3d` are source templates, not directly renderable projects.

```sh
node scripts/trajectories/feature-launch.mjs --asset-root examples/sculptures --out /tmp/clearframe-launch-setup --final --render
node scripts/trajectories/teaching-3d.mjs --asset-root examples/sculptures --out /tmp/clearframe-teaching-setup --final --render
```

Omit `--render` to prepare each portable project without rendering its film. Retain its source scenes, asset receipts and exact inputs. See the [asset workflow](../docs/sculptures.md), [KPI direction guide](../docs/kpi-direction.md) and [teaching guide](../docs/teaching-sequences.md). Saved scenes open with Python auto-execution disabled; regeneration through `sculpture` explicitly runs the trusted built-in recipe. Native rendering remains the ordinary film pipeline.

## Native verification and rendering

For native tests use the same `nativeEnv()` as the build, to preserve tool paths, target directory and worker limits:

```sh
/Users/brandon/.local/bin/codex-heavy -- node --input-type=module -e 'import {run,ROOT} from "./fframes/production.mjs"; await run("cargo",["test","--manifest-path",ROOT+"/native/Cargo.toml","--release","--locked","--jobs","1","--lib","--","--test-threads=2"]);'
```

The source media directory is prepared automatically. Fonts load locally. Metal uses one pipeline, a queue of two frames, two encoder workers and one libx264 thread per encoder. The finishing step removes upstream's empty AAC track, mixes authored sound once, and verifies the final MP4's dimensions, frame rate and decoded frame count.

`preview` creates a review MP4. A live native editor/player is not part of this release. Set `GEMINI_API_KEY` only for explicitly requested paid media generation. Existing audio and timestamp imports remain offline.

Full high-resolution finals need at least a **five-minute (300,000 ms) external execution allowance**, including the shared audio mix and mux. Longer films can exceed this; use a resumable process session and monitor it rather than treating a yield as failure or launching duplicate renders. The CLI does not impose a 120-second render deadline. When gating a render externally, use `/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node engine/cli.mjs render DIR` to avoid taking the same build lock twice.

The native crate pins FFFrames **1.2.0** at `055bb6b9dcbbcca6532206847d43ea8e81fa2a0b`. This release supplies delayed-frame draining and final source-frame interval handling upstream. Both existing decoder regressions pass upstream, but a new 49-frame/24fps fixture exposes a fractional-duration tail loss at 30fps. The updated `native/vendor/fframes-media` patch changes only the exclusive output-frame bound to round upward; decoder draining and seeking remain upstream. See its `PATCH.md` and the regression fixture provenance. The MIT notice is retained in `UPSTREAM-LICENSE.txt`; release provenance is in `upstream.json`. Metal still uses one pipeline and two encoder workers, with the new geometry cache at its upstream defaults. The configured encoder remains libx264. The new automatic Metal export can convert YUV planes on the GPU; hardware video encoding is not enabled.
