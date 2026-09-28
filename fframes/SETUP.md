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

For native tests use the same `nativeEnv()` as the build, to preserve tool paths, target directory and worker limits:

```sh
/Users/brandon/.local/bin/codex-heavy -- node --input-type=module -e 'import {run,ROOT} from "./fframes/production.mjs"; await run("cargo",["test","--manifest-path",ROOT+"/native/Cargo.toml","--release","--locked","--jobs","1","--lib","--","--test-threads=2"]);'
```

The source media directory is prepared automatically. Fonts load locally. Metal uses one pipeline, a queue of two frames, two encoder workers and one libx264 thread per encoder. The finishing step removes upstream's empty AAC track, mixes authored sound once, and verifies the final MP4's dimensions, frame rate and decoded frame count.

`preview` creates a review MP4. A live native editor/player is not part of this release. Set `GEMINI_API_KEY` only for explicitly requested paid media generation. Existing audio and timestamp imports remain offline.

The native crate carries a small pinned `fframes-media` patch under `native/vendor` to drain delayed decoder frames at EOF. This keeps valid final B-frames visible. Read its patch/provenance notes before updating upstream; the vendor files participate in the renderer build hash.
