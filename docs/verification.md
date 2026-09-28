# Native verification — 2026-09-28

## Completed baseline before the GitHub expansion

The first complete FFFrames migration passed 40 Node contract tests and 12 Rust tests. Its release build used pinned FFFrames revision `bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b`, bundled static Inter400/600 fonts, one Metal pipeline and bounded encoder workers on this Apple Silicon iMac.

Contact sheets were opened and visually reviewed in landscape, vertical, square and portrait. The first 22 blocks rendered into a 90-second 1920×1080, 30 fps MP4 with exactly 2,700 decoded frames. Render and finishing took 30.63 seconds with a warm binary/cache; this is a fixture measurement, not a general performance promise. A compact 640×360, 60 fps test produced exactly 120 frames in two seconds of video.

A 12.5-second vertical speech fixture produced 375 frames, audio, and measured word timing with no check warnings. It rendered and finished in 4.45 seconds. Highlight/reveal/word contact sheets were inspected. The fixture concatenates isolated OS-TTS words with known sample/silence boundaries: it proves the renderer clock and import/mix integration, not recognition accuracy on natural continuous speech. Audio stream presence, silence windows and levels were checked programmatically; no subjective listening result is claimed.

All 360 frames across the bars, funnel and video boundary fixtures passed strict native inspection without warnings. The final-frame regression verifies the exact final B-frame, rejects a frame beyond the clip, and reproduces the final frame after a backward seek. The decoder patch and provenance are under `fframes/native/vendor/fframes-media/`.

Baseline records: `build/native-verified-final/verification.json`, `build/speech-smoke/build/video.mp4.json` and `build/speech-smoke/build/audio-review.json`. Source, fonts, inputs and outputs are hashed in render receipts. The active codec conversion and tags are SMPTE170M.

## GitHub expansion verification

Six focused Node checks pass for all 26 block examples in both orientations, all 19 distinct playbooks compiling to jobs, new diagram validation/cue behavior, all 24 MIT asset hashes, cut/word review sample boundaries and rejection of a modified encoded video. The asset generator independently verifies the pinned Tabler revision, every source hash and the restricted SVG shape contract. The npm package dry run contains the MIT asset notices and native vendor license, with no archive, cache or node_modules content.

The expanded full Node suite passes all **45 tests**, and the native release build and **27 Rust regressions** pass. Four updated agent skills and all 21 bundled storyboards pass their validators. The successful integration record is `build/native-expanded-final2/verification.json`.

| Fixture | Result |
|---|---|
| All 26 blocks, landscape | 114 seconds, 1920×1080 at 30 fps, exactly 3,420 decoded frames; render and finishing 53.21 seconds |
| All 26 blocks, vertical | Native inspection and contact sheet pass; 458 sampled frames checked in each full gallery orientation |
| Square and portrait | Ten representative blocks at 25 fps, including all four new diagrams; 225 sampled frames checked per format |
| Dense wide and vertical diagrams | Six-node cycle/flow and eight-item grids, including a single-column grid; 93 sampled frames per format, no diagnostics |
| Compact 60 fps | Two seconds, exactly 120 frames; render and finishing 0.64 seconds |
| Measured speech, three kinetic modes | 12.5 seconds, 375 frames, audio present, no timing warnings; render and finishing 5.54 seconds |
| Measured caption overlay | 125 frames, audio present, no timing warnings; working single-PNG export |
| Encoded boundary reviews | 86 gallery, 33 speech and 11 caption frames extracted at exact frame indices |
| Four-palette comparison | Same flow scene and timestamp rendered in paper, ink, editorial and signal |

Landscape, vertical, square, portrait, both dense sheets, the palette comparison, caption still and decoded speech-boundary sheet were opened and visually inspected. The gallery's kinetic sample deliberately uses estimated draft timing and reports that warning; measured speech/caption fixtures separately exercise the final-output contract. Performance numbers describe this warm-cache run on the shared iMac and vary with other local activity. The 24-second `new-graphics.mp4` preview is an encoded extract of the last four gallery scenes, verified at 960×540, 30 fps and exactly 720 frames.

Integration and edge-case review also fixed single-frame export treating FFFrames' output directory as a PNG, explicit scene cues moving earlier during automatic spacing, late snappy connectors failing to complete, and text overflowing its box at the minimum font size. Regressions cover cue preservation, connector completion, multiline/unbreakable text, empty text, phrase pauses and duration limits, backward seeks and the removed scene counter.

The disk guard initially stopped the build at 15.2 GiB free. After inactive browser/download/header caches were removed and another task independently released its completed build scratch, the build ran with about 22 GiB available. Active workspaces and the warm native cache were preserved. The toolchain emits existing non-fatal QTKit arm64 linker and Rust `block` future-compatibility warnings; they did not prevent compilation or rendering.

## Reproduce

Use the shared heavy gate, with at least 20 GiB available for a warm native build (30 GiB cold):

```sh
/Users/brandon/.local/bin/codex-heavy -- npm test
# Once, to create the offline measured speech fixture on macOS:
/Users/brandon/.local/bin/codex-heavy -- node scripts/smoke-native.mjs
# Use a fresh output path; existing evidence is deliberately not overwritten.
/Users/brandon/.local/bin/codex-heavy -- node scripts/verify-native.mjs build/native-verification-new
```

The integration script builds/tests Rust, checks/sheets all blocks in landscape and vertical, checks representative blocks in square and portrait, encodes the full gallery and a 60 fps sample, compares one frame across four palettes, and creates decoded boundary reviews. If `build/speech-smoke` exists, it also renders the measured speech modes and a non-kinetic caption overlay. Open the sheets/review pages and listen to complete MP4s after running it.

Google transcription, Omni and Lyria request/cache/error behavior are covered with mocks. No paid provider call was made during this changeover; generated-video quality and continuity across real Omni/native joins remain a per-film review task. This run is not Linux/Windows build evidence.
