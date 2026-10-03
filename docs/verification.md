# Native verification — 2026-09-28

## 0.3.0 redesign

Recorded in `build/native-verified-v3d/verification.json` (ignored build output) from `scripts/verify-native.mjs`, run through the codex-heavy gate on the same Apple Silicon iMac with a warm cache, after all fixes in this release.

- **Tests:** 48 Rust tests and 56 Node contract tests pass. They cover text shaping and fitting, balanced wrapping, tabular figures, palette contrast and catalog parity, easing and exits (including settle-aware exits), nice ticks, phrase and emphasis ranges, new-block validation, glyph coverage, in-beat scheduling, the counting gate, font provenance and the wireframe placeholder.
- **Every block, four canvases:** all 32 blocks were checked in landscape (paper) and vertical (ink), with 611 sampled frames each. Sixteen representative and new blocks were checked in square and portrait at 25 fps, with 364 frames each. There were no native diagnostics apart from the gallery's deliberate draft-timing kinetic sample.
- **Encoded gallery:** 147 seconds at 1920×1080 and 30 fps. `ffprobe` independently decodes exactly **4,410 frames**. The draft review encoder took 37.3 s to render and finish, about 8.5 ms per frame. The previous final-quality draft path took about 11 ms per frame.
- **Frame-count regression:** a 451-frame file now decodes to all 451 frames. The upstream MP4 edit list previously ended one frame early at this length, so players dropped the final frame.
- **60 fps:** 180 frames at 640×360. The new counting gate first rejected this fixture's 1.2 s stat beat, because the counter never reached its value before the cut. The fixture now allows 2.2 s.
- **Dense layouts:** six-node cycle, eight-item grids and six-node flow in landscape and vertical, with 93 frames each and no diagnostics.
- **Measured speech:** highlight, reveal and word modes with audio, 375 frames and no warnings. A measured caption overlay has 125 frames with audio.

Contact sheets for the landscape, vertical, square, portrait, dense, data-story and eight-palette views were opened and reviewed. Encoded motion filmstrips were reviewed across entrances and exits for title, bars, line, stat, donut and checklist. That review found and fixed five problems:
- label collisions in `magnitude`;
- stretched `compare` cards;
- KPI labels spilling out of height-limited cards;
- highlight markers that vanished over the glow backdrop;
- a `looks` grid that showed only four of the eight palettes.

An independent code review of the redesign found eight issues. The main ones were exits that could fade numbers still counting, settle times that ignored label entrances, and props that silently dropped text. All eight are fixed and have regression tests.

**Limits.** No paid provider call was made; Google integrations remain covered by mocks. No subjective listening result is claimed. Performance figures describe this machine and may vary with other local work. This run is not Linux or Windows build evidence.

## Completed baseline before the GitHub expansion

The first complete FFFrames migration passed 40 Node contract tests and 12 Rust tests. Its release build used pinned FFFrames revision `bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b`, bundled static Inter400/600 fonts, one Metal pipeline and bounded encoder workers on this Apple Silicon iMac.

Contact sheets were opened and visually reviewed in landscape, vertical, square and portrait. The first 22 blocks rendered into a 90-second 1920×1080, 30 fps MP4 with exactly 2,700 decoded frames. Render and finishing took 30.63 seconds with a warm binary/cache; this is a fixture measurement, not a general performance promise. A compact 640×360, 60 fps test produced exactly 120 frames in two seconds of video.

A 12.5-second vertical speech fixture produced 375 frames, audio, and measured word timing with no check warnings. It rendered and finished in 4.45 seconds. Highlight/reveal/word contact sheets were inspected. The fixture concatenates isolated OS-TTS words with known sample/silence boundaries: it proves the renderer clock and import/mix integration, not recognition accuracy on natural continuous speech. Audio stream presence, silence windows and levels were checked programmatically; no subjective listening result is claimed.

All 360 frames across the bars, funnel and video boundary fixtures passed strict native inspection without warnings. The final-frame regression verifies the exact final B-frame, rejects a frame beyond the clip, and reproduces the final frame after a backward seek. The decoder patch and provenance are under `fframes/native/vendor/fframes-media/`.

Baseline records: `build/native-verified-final/verification.json`, `build/speech-smoke/build/video.mp4.json` and `build/speech-smoke/build/audio-review.json`. Source, fonts, inputs and outputs are hashed in render receipts. The active matrix conversion and matrix tag are SMPTE170M. The native working transfer is sRGB (IEC 61966-2-1), with BT.709 primaries and limited range; see the [transfer-signaling correction](research/fframes-color-transfer/README.md). Historical receipts retain their original tags.

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

The integration script builds/tests Rust, checks/sheets all blocks in landscape and vertical, checks representative and new blocks in square and portrait, encodes the full gallery, a 60 fps sample and a 451-frame final-frame regression, compares one frame across all palettes, and creates decoded boundary reviews. If `build/speech-smoke` exists, it also renders the measured speech modes and a non-kinetic caption overlay. Open the sheets/review pages and listen to complete MP4s after running it.

Google transcription, Omni and Lyria request/cache/error behavior are covered with mocks. No paid provider call was made during this changeover; generated-video quality and continuity across real Omni/native joins remain a per-film review task. This run is not Linux/Windows build evidence.
