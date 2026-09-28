# Setup on this Mac

Run commands from the ClearFrame repository root, currently
`/Users/brandon/Development/motion-graphic`. These instructions are for macOS/Metal.

## 1. Check prerequisites and disk

```bash
node fframes/cli.mjs doctor
df -h .
```

The exporter needs the root Node dependencies and ffmpeg; native rendering additionally
needs a current Rust toolchain, Xcode command-line tools, codec development libraries,
`pkg-config`, `nasm`, and `ninja`. The project's Rust floor is 1.88 (edition 2024 alone
requires 1.85); current transitive dependencies may require a newer stable toolchain.
The initial local Rust was 1.80.1 and could not parse this project's edition. The
September 28 setup installed **Rust/Cargo 1.98.1** with rustup's minimal profile,
**NASM 3.02** and **Ninja 1.13.2**. The old Homebrew Rust remains installed; shell
startup files were not modified. Select the new toolchain explicitly:

```bash
export PATH="/Users/brandon/.cargo/bin:$PATH"
cargo --version
rustc --version
```

Start a cold native build with **at least 30 GiB free**, then watch free space and keep
at least 20 GiB available for swap/temp files. The extra 10 GiB is a conservative local
allowance, not a measured FFFrames build size. At creation this Mac had about 25 GiB
free. A subsequent user-requested cleanup of unused dependency/build/download caches
provided 30.7 GiB before compilation. Source checkouts and task history were retained.
Upstream estimates about 20 minutes
for an initial Skia/FFmpeg build; that is not a measurement on this machine.

## 2. Install missing tools

Use an existing working Rust installation if possible. For a new installation, use
[rustup's official installer](https://rustup.rs/), selecting the minimal profile. Avoid
blindly piping a remote installer into a shell. For an existing rustup installation:

```bash
/Users/brandon/.local/bin/codex-heavy -- rustup toolchain install stable --profile minimal
```

This Mac's installation used the official `aarch64-apple-darwin/rustup-init` binary,
verified against its published SHA-256, then ran `rustup-init -y --profile minimal
--default-toolchain stable --no-modify-path` through the shared gate. The installer
must be named `rustup-init`; a renamed executable can enter rustup's proxy mode.
See the [official manual installation instructions](https://rust-lang.github.io/rustup/installation/other.html).

Ensure the selected stable toolchain's Cargo/rustc precede the old Homebrew Rust on PATH;
verify `command -v cargo`, `cargo --version`, and `rustc --version` in the build shell.
Installing rustup alone does not change which binary this shell resolves.

```bash
# Only missing packages are needed. Both commands share the machine-wide resource gate.
/Users/brandon/.local/bin/codex-heavy -- brew install pkg-config ffmpeg x264 x265 opus nasm ninja
# Root JS dependencies already exist on this Mac; use npm ci only when absent.
/Users/brandon/.local/bin/codex-heavy -- npm ci
node fframes/cli.mjs doctor
```

Native FFFrames links/builds libav; having the `ffmpeg` command on PATH is not sufficient.
The Cargo template enables upstream `h264` and `libav-agree-gpl` for libx264. FFFrames'
MIT license does not replace the licenses of linked codecs. No global FFFrames skill,
generator or browser editor installation is required for this repository path.

## 3. Create one frozen experiment

```bash
node engine/cli.mjs voice fframes/examples/paired --draft
node fframes/cli.mjs prepare fframes/examples/paired fframes/runs/paired-01
node fframes/cli.mjs verify fframes/runs/paired-01
```

Use a **new run name** each time the source/story/audio changes. `prepare` will not overwrite
an existing directory. It copies the project without `.env`, dependency directories or
old build output. It writes:

- `browser/`: frozen JS scene, storyboard, font and recorded takes.
- `native/`: Rust sources, Cargo manifest, explicit scene job and the same font.
- `inputs/`: absolute word/beat timings, SRT/VTT and the common mixed WAV, if audio exists.
- `manifest.json`: SHA-256 hashes, input identity, FFFrames revision and voice providers.

The font fixture is Google Fonts Inter with its OFL license and pinned source/hash in
`examples/paired/assets/fonts/provenance.json`. No system font fallback is enabled in Rust.
The example deliberately avoids image generation, footage and automatic SFX.

For existing approved media, use it in the source project before freezing. Final Google
generation still uses `node engine/cli.mjs plan|voice|music|images|clips`; follow the shared
skills and budget. Do not generate one voice take for each renderer.

## 4. Resolve, lock and build FFFrames

```bash
# Separate locations prevent CPU/Metal builds from replacing each other's binary.
export CARGO_TARGET_DIR="$PWD/fframes/.cache/metal"
export PATH="$PWD/fframes/tools:/Users/brandon/.cargo/bin:$PATH"
export CARGO_BUILD_JOBS=1
export SKIA_NINJA_COMMAND="$PWD/fframes/tools/ninja-limited"
export RAYON_NUM_THREADS=2
export FFRAMES_NUM_THREADS=2
export CMAKE_BUILD_PARALLEL_LEVEL=2
export NUM_JOBS=2

# New bundles copy the tested template Cargo.lock. Only regenerate it for an intentional
# dependency update, and keep the resulting changed lockfile with that experiment.
# /Users/brandon/.local/bin/codex-heavy -- cargo generate-lockfile --manifest-path fframes/runs/paired-01/native/Cargo.toml

# The timer is INSIDE the gate: time waiting for another task is excluded.
/Users/brandon/.local/bin/codex-heavy -- node fframes/cli.mjs measure fframes/runs/paired-01 --renderer fframes-metal --phase cold-build --out fframes/runs/paired-01/reports/metal-cold-build.json -- cargo build --manifest-path fframes/runs/paired-01/native/Cargo.toml --release --locked --jobs 1
```

Keep the local `fframes/tools/make` wrapper on PATH during builds. In the pinned
`ffmpeg-sys-next` 9.0.0 dependency, the build script invokes `make -j <CPU count>` and
ignores `NUM_JOBS`; Cargo's limit alone is insufficient. The wrapper invokes Apple's
`/usr/bin/make` with a final `-j 2`, overriding that request. It does not change global
build tools. Check the running compiler process count during a new dependency build.
`SKIA_NINJA_COMMAND` similarly caps a Skia source fallback at two jobs; its default
Ninja invocation otherwise chooses ten jobs on this Mac. One Cargo job prevents two
native build scripts from each launching their own pair of compilers at once.
The Ninja wrapper defaults to Apple Silicon Homebrew's `/opt/homebrew/bin/ninja`;
set `FFRAMES_NINJA` to the real binary on other machines.

Keep `native/Cargo.lock` with the experiment. The Git revision pins FFFrames
but does not pin every transitive crate; the copied tested lockfile does. Record the toolchain that
actually builds successfully. Use a separate fresh `CARGO_TARGET_DIR` for a true cold
build; a warm Cargo registry is still a warm download cache, and should be labelled.

Inspect progress in the report's `.log` file. A failed command still gets a timing report.
For bindgen errors, locate `libclang.dylib` in the active Xcode toolchain and set
`LIBCLANG_PATH` to that directory. Do not assume the CommandLineTools and full-Xcode
directory layouts are identical. For missing codecs, inspect `pkg-config` and the native
build log. Do not replace the pin with moving `main` to make a build pass.

For an explicitly labelled CPU experiment, use a separate target:

```bash
CARGO_TARGET_DIR="$PWD/fframes/.cache/cpu" /Users/brandon/.local/bin/codex-heavy -- cargo build --manifest-path fframes/runs/paired-01/native/Cargo.toml --release --locked --jobs 1 --no-default-features
```

CPU avoids Skia, but still needs Rust, libav and codec build tools. It is not the GPU result.
Linux/Windows need upstream platform setup and a platform backend; this starter wires
Metal only. It does not silently provide Vulkan or the web editor.

## 5. Review both versions

```bash
node engine/cli.mjs sheet fframes/runs/paired-01/browser
node engine/cli.mjs check fframes/runs/paired-01/browser

```

For less error-prone paths, use absolute variables from the repo root:

```bash
cf_native_bin="$PWD/fframes/.cache/metal/release/clearframe-native"
cf_native_dir="$PWD/fframes/runs/paired-01/native"
(cd "$cf_native_dir" && "$cf_native_bin" --help)
(cd "$cf_native_dir" && "$cf_native_bin" timeline)
(cd "$cf_native_dir" && "$cf_native_bin" inspect --fail-on warning)
(cd "$cf_native_dir" && "$cf_native_bin" strip -n 12 --columns 3 -o strip.png)
(cd "$cf_native_dir" && "$cf_native_bin" frame '0,1s,3s,end' -o frames)
```

Open the sheets/frames. All native scenes use the Rust type `Beat`; use `#0`, `#1`, `#2`
or absolute times from `inputs/timing.json`, not storyboard IDs as upstream scene names.
The native CLI's audio/preview commands are not the final audio review: the starter
renders silently and uses the shared mix in step 6. No native player is installed.

## 6. Render, verify and attach the common soundtrack

```bash
cf_bundle="$PWD/fframes/runs/paired-01"
cf_native_bin="$PWD/fframes/.cache/metal/release/clearframe-native"
export FFMPEG_PATH="$PWD/fframes/tools/ffmpeg-limited"

/Users/brandon/.local/bin/codex-heavy -- node fframes/cli.mjs measure "$cf_bundle" --renderer javascript --phase render --out "$cf_bundle/reports/js-render-1.json" -- node engine/cli.mjs render "$cf_bundle/browser" --workers 2 --no-audio --out "$cf_bundle/js-silent.mp4"

/Users/brandon/.local/bin/codex-heavy -- node fframes/cli.mjs measure "$cf_bundle" --renderer fframes-metal --phase render --cwd "$cf_bundle/native" --out "$cf_bundle/reports/metal-render-1.json" -- "$cf_native_bin" render -o "$cf_bundle/metal-raw.mp4"

# Upstream writes a silent AAC track even for AudioMap::none(). Remove it losslessly.
ffmpeg -v error -n -i "$cf_bundle/metal-raw.mp4" -map 0:v:0 -c:v copy -an "$cf_bundle/metal-video-only.mp4"

node fframes/cli.mjs finish "$cf_bundle" "$cf_bundle/js-silent.mp4" --out "$cf_bundle/javascript.mp4"
node fframes/cli.mjs finish "$cf_bundle" "$cf_bundle/metal-video-only.mp4" --out "$cf_bundle/fframes-metal.mp4"
```

`finish` checks decoded frame count, canvas and frame rate before muxing; it refuses an
existing output. Use unique outputs/reports on repeat runs. It records the shared mix hash,
video/output hashes, codec, pixel format and color metadata alongside each final file.
It does not normalize away visual or color differences between renderers. Watch/listen
to both MP4s and follow [EVALUATION.md](EVALUATION.md) before claiming a winner.

For paired runs, `FFMPEG_PATH` caps each browser encoder at one codec/filter thread;
the original JS engine is unchanged. The native template likewise uses one codec thread
per encoder worker, GOP 250 and quantizer bounds 0–69. Validate the actual x264 settings
in the output; matching a preset/CRF alone does not align every upstream default.
The wrapper defaults to `/opt/homebrew/bin/ffmpeg`; set `FFRAMES_FFMPEG` for another path.
