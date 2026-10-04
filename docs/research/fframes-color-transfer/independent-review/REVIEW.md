# Independent review: native output transfer signaling

**The proposed sRGB transfer tag is justified for the current native sRGB graphics contract. No blocking defect was found in the reviewed change.** This is a source review plus one bounded real-mux test, not a new native-render or display-acceptance result. The unrendered camera proposal was not reviewed.

## Source trace

Reviewed pinned upstream revision `055bb6b9dcbbcca6532206847d43ea8e81fa2a0b` (FFFrames 1.2.0) and the exact local files hashed in `review.json`.

- Upstream `render/filters.rs:88–96` converts completed SVG filter chains back to sRGB for canvas consumption; lines 120–134 implement explicit sRGB/linear conversions within the filter chain. This supplies positive evidence for the intended graphics working convention.
- `backends/metal.rs:169–198` creates an `RGBA8Unorm` target and wraps it without a Skia color space. `frame_export/planes.rs` likewise creates the packed-plane surface without a color space, samples the existing picture, and applies channel dot products plus offsets. There is no sRGB-to-BT.709 transfer operation in this export path. These unmanaged surfaces preserve the working-value convention; they do not independently normalize arbitrary media.
- `fframes/src/renderer/pix_fmt.rs:4–14` defines the common BT.601 limited-range RGB-to-YCbCr coefficients. The GPU plane exporter consumes those coefficients. `renderer/stream.rs:182–190` declares SMPTE 170M matrix and MPEG/limited range for YUV encoder inputs. Keeping matrix coefficient 6 and limited range is consistent with that source; changing the tag to a BT.709 matrix without changing pixels would be wrong.
- The active caller of `mux` is the native `renderProject` finalization path. It stream-copies video in both silent and audio branches. Changing transfer signaling from 1 to 13 corrects its description of sRGB working values while preserving encoded picture samples. Receipt additions read the actual probed transfer, primaries and range from the finished output, which is preferable to copying intended settings.

The upstream source references are reproducible through the [pinned export coefficients](https://github.com/dmtrKovalenko/fframes/blob/055bb6b9dcbbcca6532206847d43ea8e81fa2a0b/fframes/src/renderer/pix_fmt.rs), [GPU plane exporter](https://github.com/dmtrKovalenko/fframes/blob/055bb6b9dcbbcca6532206847d43ea8e81fa2a0b/fframes-skia-renderer/src/frame_export/planes.rs), [Metal surface](https://github.com/dmtrKovalenko/fframes/blob/055bb6b9dcbbcca6532206847d43ea8e81fa2a0b/fframes-skia-renderer/src/backends/metal.rs), and [filter conversions](https://github.com/dmtrKovalenko/fframes/blob/055bb6b9dcbbcca6532206847d43ea8e81fa2a0b/fframes-skia-renderer/src/render/filters.rs).

Official FFmpeg definitions assign 13 to IEC 61966-2-1/sRGB and distinguish it from BT.709 transfer. Its `h264_metadata` filter changes the stream's VUI color description; it is not a transfer conversion. These support the proposed use of 13 in the bitstream and `iec61966-2-1` in the MP4 settings. [FFmpeg color enums](https://ffmpeg.org/doxygen/trunk/pixfmt_8h_source.html), [bitstream-filter documentation](https://ffmpeg.org/ffmpeg-bitstream-filters.html#h264_005fmetadata).

## Focused execution evidence

I ran `node --test test/native-video-color.test.mjs`: **1 passed, 0 failed**, approximately 431 ms total. The real 160×96 six-frame fixture exercises silent and short-audio muxes. It confirms unchanged decoded picture-plane hashes, all six frames at 24 fps, 0.25-second duration, expected audio presence, MP4 `colr`/`nclx` fields `(1,13,6,limited)`, and matching extracted H.264 VUI fields. The initially proposed ffprobe-only container check was insufficient to distinguish container metadata from codec VUI; the author added direct atom parsing before this test run.

This test establishes that the mux changes metadata without changing the fixture's picture samples or video duration. Its synthetic fixture is not itself evidence that native renders are sRGB; that conclusion comes from the source trace above and the separately retained clip comparisons. Receipt-field additions were source-reviewed, but a fresh end-to-end native render was not run because of the disk reserve. No builds, full suites, dependency installs or camera edits were performed by this reviewer.

## Boundaries and residual risk

The vendored media decoder uses `sws_getContext` and `sws_scale` to produce RGBA without an explicit input-transfer/primaries normalization step. Imported pixels then enter a Skia image without an associated color space. Consequently this change does **not** make arbitrary BT.709, wide-gamut, HDR, ICC-tagged or untagged input media color-correct. BT.709 footage whose nonlinear values were previously imported unchanged can look different once the whole composite is correctly tagged for its sRGB graphics contract. Input normalization and any destination-specific BT.709 export conversion require separate pixel processing and evidence; metadata rewriting cannot supply them. FFmpeg documents those conversions separately in its [colorspace filter](https://ffmpeg.org/ffmpeg-filters.html#colorspace).

The proposed fix is therefore appropriate for native graphics and prepared assets conforming to the sRGB working convention. Do not generalize it to arbitrary H.264 passthrough media or promise identical appearance in all players. Player support, calibrated display appearance, materials and subjective final acceptance remain unverified.

`rendererSourceHash` covers native Rust/vendor/constants and does not cover the changed JavaScript mux. The revised receipt writer now adds `finishingSourceHashes` for `fframes/render.mjs` and `engine/lib/audio.mjs`; the reviewed URL resolutions select those files correctly. This is source-reviewed receipt behavior, not a newly rendered receipt. The remux evidence separately binds the mux implementation and remux helper. Historical outputs and receipts remain historical and should not be silently retagged or re-described as new native renders.


## Final evidence refresh

Reviewed `check.py`, `remux.mjs`, `evidence/checks.json` and `evidence/remux.json`; rehashed every original, corrected and source MP4, the checker, mux and helper. All current hashes match their declared bindings. No new decode pass, native render or build was performed for this refresh.

The transfer-aware checker converts source, old native and corrected native samples into the same BT.709 primaries/transfer/matrix using FFmpeg `colorspace` with `fast=0`, a 12-bit YUV444 intermediate and no dithering, then RGB24. Unlike the earlier raw RGB check, this explicitly exercises the declared transfer curves. It compares frames 12, 144 and 318 in the same central crop for each variant. The report contains 12 passing improvements: the largest old mean absolute RGB error is 11.198412, the largest corrected mean is 1.856888, and the largest corrected 95th-percentile channel error is 6. These maxima are across the sample set, not necessarily the same crop. I checked the saved metrics against all threshold predicates and found no contradiction.

The checker also compares complete decoded `framemd5` data rows before/after stream-copy correction, including frame timestamps, durations, sizes and hashes; it requires 444 matches in each of four clips, unchanged 24 fps and 18.5-second duration. The bound report records all 1,776 picture frames unchanged. This refresh verifies the checker logic and saved report bindings; it does not claim an independent repetition of that full decode run.

These results strengthen the bounded transfer-aware FFmpeg comparison for the four retained sRGB assets. They do not normalize arbitrary imported media, prove platform-player appearance, or provide new motion/material/final-picture acceptance. No material contradiction or unresolved blocker was found within the scoped correction.
