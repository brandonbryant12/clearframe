# Native sRGB transfer signaling

The native finisher previously assigned the BT.709 transfer curve to sRGB graphics values. The renderer had applied a BT.601 limited-range matrix, without converting the sRGB transfer curve. The corrected finisher uses BT.709 primaries, IEC 61966-2-1/sRGB transfer, SMPTE 170M matrix and limited range in both MP4 and H.264 metadata. The matrix and picture samples are unchanged.

FFmpeg distinguishes [sRGB transfer value 13 from BT.709 value 1](https://ffmpeg.org/doxygen/8.0/pixfmt_8h.html). The [independent source review](independent-review/REVIEW.md) traces the exact pinned renderer's filter, surface and plane-export paths. Shared primaries do not imply shared transfer curves.

## Evidence

- The real mux regression covers silent and short-audio branches. It directly parses the MP4 `colr`/`nclx` atom and probes an extracted H.264 elementary stream. Picture-plane hashes, six-frame count, 24 fps and 0.25-second video duration remain unchanged. The short audio is padded without truncating video.
- Ten focused audio, native-color, QA and render-geometry tests pass. The complete suite and a new end-to-end native render were not run for this correction; the retained full-suite result belongs to the preceding milestone.
- Four retained chart drafts were stream-copied through the corrected mux into `evidence/`. These are metadata-corrected review copies, **not newly rendered films**. All 1,776 decoded picture frames and timestamps match their originals.
- Twelve source/native central crops were converted to a common BT.709 output using FFmpeg's `colorspace` filter with gamma correction enabled (`fast=0`), a 12-bit YUV444 intermediate, no dithering and final RGB24. Every sample improves. The largest mean absolute error falls from 11.199 to 1.857 on the 0–255 scale; largest corrected 95th-percentile error is 6. Bounds are mean error ≤3 and percentile error ≤12. Full metrics, probes and hashes are in [checks.json](evidence/checks.json).

The corrected receipt writer records actual transfer, primaries, matrix and range. It also binds `fframes/render.mjs` and `engine/lib/audio.mjs`, because the existing native source hash does not cover JavaScript finishing. Those new receipt fields have source review, but no fresh complete native-render receipt is claimed here.

## Reproduce

Use the existing Node, Python/NumPy and FFmpeg installations. These commands perform small tests, stream-copy remuxing and bounded decoding; they do not build or render the native engine.

```sh
node --test --test-concurrency=2 test/native-video-color.test.mjs test/audio.test.mjs test/qa.test.mjs test/render-geometry.test.mjs
python3 docs/research/fframes-color-transfer/check.py
```

`remux.mjs` documents production-mux use and refuses to overwrite the retained `evidence/` directory. It can regenerate the review copies in a separate checkout after moving that checkout's evidence aside. Inputs are the existing chart-flight `native-color-v3` drafts; historical clips and receipts remain unchanged. `remux.json`, `checks.json` and independent review bind the original/output clips and relevant source files. The retained comparison runs FFmpeg sequentially with at most two decoder/filter workers.

## Limits

The native graphics working convention is sRGB. This correction does not normalize arbitrary BT.709, wide-gamut, HDR, ICC-tagged or untagged imported media. The current decoder produces RGBA without explicit transfer/primaries normalization, so input media outside the convention needs separate pixel conversion and verification. The native mux is not a general-purpose H.264 passthrough API.

The common-output comparisons validate one explicit FFmpeg conversion path and these four prepared sRGB source cases. They do not prove identical appearance in every player, a calibrated display, final material fidelity or continuous artistic acceptance. Chart-flight camera composition and typography concerns remain open. Different-matrix output such as BT.709 delivery requires actual pixel conversion; do not relabel SMPTE 170M values as BT.709.
