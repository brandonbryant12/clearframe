# Quantitative plot prototypes

Status: **prototype, not accepted artwork**. Three independent review rounds resolved the phone readability, reveal-label and annotation defects in the inspected two-series examples. Continuous playback remains unverified; see [REVIEW.md](REVIEW.md). Track acceptance in the [build-out goal](../../docs/research/timmer-library/BUILDOUT.md).

Two different subjects exercise the shared drawing: fictional retirement contributions versus account value, and fictional temperature monitoring with irregular observation dates, negative readings and a missing observation. [DIRECTION.md](DIRECTION.md) records intent and limitations. Native text, exact scales and data remain editable through `canvas.props.plot`; no external generation or paid providers are involved.

Run `node examples/quantitative-plots/build.mjs` from the repository root to regenerate both storyboards and the auditable ledger. [Contract and reproduction](../../docs/quantitative-plots.md). Source inputs and original drawings are repository MIT content; fonts retain their bundled licenses. There is no randomness in these specimens.

## Retained evidence

| Variant | Draft clip | Native sheet | Decoded 360 px sheet |
|---|---|---|---|
| Landscape, 1920×1080 | [video](evidence/landscape/video.mp4) | [sheet](evidence/landscape/sheet.png) | [phone](evidence/landscape/phone.png) |
| Vertical, 1080×1920 | [video](evidence/vertical/video.mp4) | [sheet](evidence/vertical/sheet.png) | [phone](evidence/vertical/phone.png) |
| Long names + log/annotation, landscape | [video](evidence/stress-landscape/video.mp4) | [sheet](evidence/stress-landscape/sheet.png) | [phone](evidence/stress-landscape/phone.png) |
| Long names + log/annotation, vertical | [video](evidence/stress-vertical/video.mp4) | [sheet](evidence/stress-vertical/sheet.png) | [phone](evidence/stress-vertical/phone.png) |
| Long names + log/annotation, square | [video](evidence/stress-square/video.mp4) | [sheet](evidence/stress-square/sheet.png) | [phone](evidence/stress-square/phone.png) |
| Long names + log/annotation, 4:5 | [video](evidence/stress-portrait/video.mp4) | [sheet](evidence/stress-portrait/sheet.png) | [phone](evidence/stress-portrait/phone.png) |

[evidence.json](evidence.json) records exact source/output hashes and automated results. Each retained directory includes encoded QA, native checks, timeline, seek comparison and renderer receipt. The two main clips are silent, 23 seconds at 30 fps, 690 decoded frames each; the four stress clips are 16 seconds/480 frames each. The receipt's `revision` is the pinned FFFrames upstream revision; the evidence manifest separately records our repository base and dirty source hashes.

The full Node suite passes 151 checks; native suite passes 64. All six native audits inspect 90 frames without errors or warnings. Encoded QA detects no one-frame pops. Its low-motion advisories are retained: these sparse line reveals change few pixels, then deliberately hold for reading. Five native frames per variant have identical PNG hashes in forward and shuffled seek orders.

[Encoded proportion checks](evidence/encoded-proportions.json) stream all 3,300 frames. Independent calculations verify 276 native point/tick coordinates, 23,208 visible encoded observations, 4,060 reveal fronts and 2,368 columns ahead of the expected trace, with zero failures. Native coordinates use a 1e-7-pixel tolerance; encoded checks allow three pixels at 720px width for sampling/compression and exclude occluded observations and whole-scene arrival/departure. This verifies these line fixtures, not arbitrary future inputs or area/volume encodings. Continuous playback remains unverified after the native player timed out. Three/four-series arrangements remain visually unreviewed.

After regenerating source, run the local `verify.mjs` through `codex-heavy` with `CLEARFRAME_HEAVY_HELD=1` to render/review and compare seek orders. Then run `check-encoded.py` through the same gate. The checker refuses stale storyboard inputs. No paid provider is used.
