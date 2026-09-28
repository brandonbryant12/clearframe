# Verified local results — September 28, 2026

**The FFFrames Metal path now builds and renders on this 8 GiB M1 Mac.** For the
17.17-second vector fixture, three controlled warm render trials had medians of
**5.06 s native versus 24.29 s JavaScript** (4.80× less render time). This is a rendering
measurement, **not an overall quality or authoring-time win**: visible headline-weight
and background-color differences remain.

## Watch and compare

- [JavaScript MP4](runs/paired-01/js-matched-1-final.mp4)
- [FFFrames Metal MP4](runs/paired-01/metal-matched-1-final.mp4)
- [JavaScript decoded-frame sheet](runs/paired-01/js-matched-review.png)
- [Native decoded-frame sheet](runs/paired-01/native-matched-review.png)
- [Native 12-frame contact sheet](runs/paired-01/native/strip.png)
- [Machine-readable comparison](runs/paired-01/reports/comparison.json)

Generated evidence is ignored by Git. The fixture, adapter, native template, tested
Cargo.lock, setup instructions and agent skill are repository source.

## Controlled render trials

Same input bundle, draft narration, font file, layout geometry, cues, duration and
canvas. Order: JS1/native1, native2/JS2, JS3/native3. Browser dependencies were already
warm; the rebuilt native binary had a separate 5.94 s warm-up. Existing Docker services
remained running. These are three local samples, not a statistical performance guarantee.

| Path | Trials (seconds) | Median | Example final file |
|---|---|---:|---:|
| JavaScript / Chrome | 24.470, 24.293, 24.024 | 24.293 s | 735,348 bytes |
| FFFrames / Skia Metal | 5.063, 5.021, 5.078 | 5.063 s | 692,696 bytes |

Both use libx264 core 165 r3222, medium, CRF 16, GOP 250, quantizer bounds 0–69 and
one codec thread per encoder worker. These settings were checked in the encoded x264
parameter strings. There are two browser capture workers and two native encoder workers;
Skia uses one GPU pipeline and a queue of two frames. The experiment-only `FFMPEG_PATH`
wrapper caps browser encoding without changing the original JS engine.

Native render timing includes upstream's automatically generated silent AAC track.
Removing it by stream copy took 0.032, 0.034 and 0.031 seconds, measured separately.
Common-mix finishing/frame validation is excluded from both render timings. Initial
unaligned trials (native ~2.5 s, JS ~23.5 s) remain in the evidence but are **excluded**:
the native GOP/quantizer defaults and browser encoder thread counts differed.

## Validation and visual findings

- **28 JavaScript/bridge tests pass**; source syntax, skill validation, packaging dry run,
  and `git diff --check` pass. Packaging includes Cargo.lock and executable tool wrappers,
  and excludes generated runs/build caches.
- Native release compilation succeeds with Rust/Cargo **1.98.1**, NASM **3.02**, Ninja
  **1.13.2**, pinned FFFrames `bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b` and the committed
  template Cargo.lock. External ffmpeg is **8.0.1**; native builds FFmpeg through
  `ffmpeg-sys-next` **9.0.0**. Node is **v23.11.0**; Chrome for Testing **154.0.8037.57**.
- Native `timeline` reports **515 frames**, 1920×1080, 30 fps, three scenes. Native
  `inspect --fail-on warning` checked 70 frames with **no problems found**.
- Every controlled render passed decoded-frame count, canvas and fps checks before
  receiving the common narration mix. Finished videos have H.264 video, 48 kHz stereo
  AAC, video duration 17.166667 s and audio duration 17.152 s.
- Decoded PCM hashes match between the selected finished videos:
  `052327f7562d7e20e6a10b1da1850427d1f300ac4326e5f7c4dd4affadec9eef`.
  This proves identical decoded audio, not a completed subjective listening review.
- Opened the native contact sheet and matching decoded video frames at 1, 8 and 14 s.
  Content, chart values, proportions, positions and source labels are present/readable.
  **Native headlines look thinner despite the shared variable font and weight 600**.
  Static weight-specific fonts or explicit variation handling should be tested next.
- Background appearance differs slightly. JS streams report `bt709`; native streams
  report `smpte170m` (upstream's declared BT.601 conversion). Primaries/transfer are
  unspecified in the probed outputs. No color-equivalence claim is made.
- Browser QA has 0 errors and 4 documented fixture warnings: long first beat (subject
  appears before 3 s), static opening/recap holds, and a 33-word chart including labels
  and disclosure. This is a minimal benchmark fixture, not a polished launch film.
- No Google API calls or paid generation occurred; voice is the same macOS draft take.

Input ID: `4113b3b25096d52ca89d876e4a4ed125af87d98de576a73ced7abb458d12ce99`.
Shared mix SHA-256: `69ecda1bb8aef3295b6d3c8f6f386aa9fa8a1f52621cedcc63e17f74a8aa93d8`.

## Setup and iteration costs

| Stage | Observed time / result |
|---|---|
| First compile attempt | 223.0 s; deliberately interrupted to correct FFmpeg's eight-job default |
| Resumed dependency build | 781.1 s; FFmpeg and Skia built from source, then native compilation succeeded |
| Encoder-setting source edit and release rebuild | 33.7 s |
| Combined first two compile attempts | 16 min 44 s; excludes tool installation/download resolution and pauses |

The resumed build's generic measurement phase is `warm-build`, but it was a resumed
first dependency build, **not an ordinary warm source edit**. Separate receipts preserve
that distinction. Disk cleanup overlapped part of the dependency build, so these are
setup observations, not a pristine cold-cache benchmark. The 33.7 s encoder rebuild is
the actual small source-edit observation. JSON content edits within the existing native
schema need not recompile Rust; canvas/fps or Rust scene changes do.

Two integration fixes were required and documented in [SETUP.md](SETUP.md):

1. FFmpeg's build script ignores Cargo's worker cap, and Skia's default Ninja invocation
   also uses CPU-derived concurrency. Local wrappers cap both at two workers; Cargo
   uses one job so nested native builds cannot each launch their own pair simultaneously.
2. `AudioMap::none()` still produces silent AAC. Keep the raw result, remove that stream
   losslessly, then use strict `finish` to attach the frozen common mix.

The linker warned about an unavailable arm64 QTKit stub and the old `block` crate's
future Rust compatibility. They did not prevent compilation or this Metal render.
Retain the tested lockfile/toolchain when reproducing the result.

After cleanup, tools, compilation and all trials, free space was **27.5 GiB**, versus
25.4 GiB before cleanup. Native-related footprint is roughly 2.5 GiB target cache,
2.5 GiB Cargo cache (77 MiB existed before), and 436 MiB Rust toolchain. The monitored
resumed build stayed above 27.6 GiB free. Summed sampled process RSS peaked at ~557 MiB;
this is not a true process-tree peak or total system memory measurement.

A new cold target still requires the documented 30 GiB preflight; ordinary renders reuse
this compiled target. The detailed disk audit is at
`/Users/brandon/Development/artifacts/disk-cleanup-2026-09-28/README.md`.

## What this supports

Keep both paths. Native is promising for repeated vector renders once compiled; the
existing JS path retains its full block library and avoids Rust rebuilds for scene code
changes. A Rust edit plus rebuild can erase the native render-time advantage on a short
video. Fix font-weight/color differences and test richer scenes before choosing a
production renderer. CPU rendering, vertical/captioned layouts, media-heavy scenes,
full playback/listening review and a measured brief-to-accepted-video comparison remain
outside this smoke test. All changes remain local; no branch or publication was created.
