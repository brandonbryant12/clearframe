# Quantitative plot prototypes

Status: **prototype, not accepted artwork**. The strict data/scale contract and native geometry are tested. Independent review found phone readability and reveal-label defects; see [REVIEW.md](REVIEW.md). Track remediation in the [build-out goal](../../docs/research/timmer-library/BUILDOUT.md).

Two different subjects exercise the shared drawing: fictional retirement contributions versus account value, and fictional temperature monitoring with irregular observation dates, negative readings and a missing observation. [DIRECTION.md](DIRECTION.md) records intent and limitations. Native text, exact scales and data remain editable through `canvas.props.plot`; no external generation or paid providers are involved.

Run `node examples/quantitative-plots/build.mjs` from the repository root to regenerate both storyboards and the auditable ledger. [Contract and reproduction](../../docs/quantitative-plots.md). Source inputs and original drawings are repository MIT content; fonts retain their bundled licenses. There is no randomness in these specimens.

## Retained evidence

| Variant | Draft clip | Native sheet | Decoded 360 px sheet |
|---|---|---|---|
| Landscape, 1920×1080 | [video](evidence/landscape/video.mp4) | [sheet](evidence/landscape/sheet.png) | [phone](evidence/landscape/phone.png) |
| Vertical, 1080×1920 | [video](evidence/vertical/video.mp4) | [sheet](evidence/vertical/sheet.png) | [phone](evidence/vertical/phone.png) |

[evidence.json](evidence.json) records exact source/output hashes and automated results. Each retained directory includes encoded QA, native checks, timeline and renderer receipt. Both clips are silent, 23 seconds at 30 fps, 690 decoded frames. The receipt's `revision` is the pinned FFFrames upstream revision; the evidence manifest separately records our repository base and dirty source hashes.

The full Node suite passes 151 checks; native suite passes 64. Both native audits inspect 90 frames without errors or warnings. Encoded QA detects no one-frame pops. Its low-motion advisories are retained: these sparse line reveals change few pixels, then deliberately hold for reading. Decoded frames establish sampled reveal progress and a genuine missing-data gap, not continuous-playback acceptance. Square/4:5, logarithmic axes and annotations have source checks only. Full motion, arbitrary-seek output comparisons, long labels and close endpoints remain review work.
