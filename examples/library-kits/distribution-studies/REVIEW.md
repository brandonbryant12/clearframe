# Independent review — distributions and exact thresholds

**Verdict: prototype; no remaining material finding in the reviewed candidates.** Four current 64-second silent draft specimens pass this bounded source, mathematical, geometry, artifact-binding and encoded phone-frame review. Continuous subjective playback and final master acceptance were not observed. Arbitrary new copy, more crowded samples and other aspect ratios require fresh review.

Reviewed 2026-10-03 separately from implementation. Scope: model/composition helpers and focused tests, input records, builder/audit, direction/README/API/provenance documents, native diagnostics, encoded checker and reports, and actual decoded images. The reviewer changed only this report and `evidence/independent-review` artifacts. No browser, server or heavy render was started by the reviewer.

## Current artifacts

Input SHA-256: `f7e1a8048e975662f861bef9b5c27b8a23ec8dc1b719df7ffa05e2d8a0925d60`.

Model SHA-256: `32c7a44e886d0690b1688f23bfd0d7177c98eb2a2b5d947947036fc85053cafb`.

Composition SHA-256: `f02b19cfe37b8e8477ba0b3061d2aff720d365256e7a6a9395110e97b83e23c2`.

`evidence/independent-review/artifact-checks.json` binds each inspected video, storyboard, native job, receipt, model, composition, input, audit and final encoded report. All receipt hashes independently match retained bytes. Each video contains 1,920 frames at 30 FPS, with two 32-second beats. Actual duration is **64 seconds** from frames/FPS; encoder elapsed time is separately named `encodeSeconds`. All native reports contain zero errors and warnings, QA reports zero pops, and shuffled sampled seeks match. Reviewed source, document, test, checker and report hashes are retained in `source-bindings.json`.

| Specimen | Current pipeline |
| --- | --- |
| monthly-change-landscape | `2026-10-03T10-40-33-335Z-f04ff890` |
| monthly-change-vertical | `2026-10-03T10-40-53-286Z-34e96c60` |
| service-delay-landscape | `2026-10-03T10-41-12-986Z-3384ca50` |
| service-delay-vertical | `2026-10-03T10-41-32-961Z-ef6595ac` |

## Independent mathematics and contract evidence

The reviewer ran the focused suite: **5/5 pass**. The retained `contract-review.mjs` passes **284,219 independent assertions** across 10,212 model cases: 280,718 mathematical assertions, 35 invalid-input guards, 3,272 geometry assertions and 194 current kit-audit assertions. The producer's final retained full-suite log reports **201/201 pass, zero failures or skips**; the reviewer inspected that log without rerunning the full suite.

The reference assigns a value's bin by counting the internal boundaries it has crossed, independently of the implementation's interval search. Exhaustive samples of one to three observations from signed endpoints, interior values, zero and null are tested under count/density modes and all four threshold relations, including equality and thresholds between observations. Additional cases cover repeated values, signed zero, subnormal observations, minimum bin widths, extreme bounded edges and the 240-observation limit. Every bin's member indices, count, width and endpoint policy are checked. Missing values remain explicit and excluded from the observed denominator; every non-null value belongs to exactly one bin. Input data are not mutated.

Density uses count divided by observed sample size times bin width. This normalization was checked against the [NIST/SEMATECH histogram reference](https://www.itl.nist.gov/div898/handbook/eda/section3/eda33e.htm). Independent density comparisons allow ordinary floating-point operation-order rounding; total bin area agrees with one within 2e-15 in tested fixtures. Count mode requires equal widths within its declared relative tolerance. No fitted curve, population probability, future tail estimate or partial-bin uniformity is inferred.

Threshold membership is computed directly from original observed values for `gte`, `gt`, `lte` and `lt`. The returned numerator, denominator, fraction and exact member indices match the independent comparisons. Guards reject all-missing samples, sparse observation slots, invalid/sparse edges or ticks, out-of-range/nonfinite values, unsupported relations/modes, insufficient y ranges, misleading tick precision and unsupported properties. Sparse observations must be written as explicit nulls.

Geometry tests cover 1920×1080, 1080×1920, 640×640 and 4096×2160, both modes and all threshold relations. They independently derive bar widths/heights, zero baselines, threshold positions and exact observation x coordinates. Full bar geometry, fill and dot positions remain identical at the focus cut. Dot y carries separation only. Pairwise distances and strip-bottom bounds include the selected rings and stroke widths. Count-label backgrounds remain above the bars and paint after threshold lines but before their text. Positive bars below one native pixel, bins narrower than 12 pixels and excessively dense strips are rejected. Mathematical checks at extra dimensions do not establish native visual acceptance there.

The current kit audit retains all observations and exact memberships. Monthly changes use counts [5, 6, 6, 6], 23 observed values and two nulls; ten values satisfy ≤ −25 dollars. Both outer endpoints are retained, and duplicate −50 values enter the bin beginning at −50. Service delays use counts [6, 7, 5, 7] over widths [10, 10, 20, 60], with 25 observed values and one null. Density—not count—is bar height. Seven values satisfy >35 min; the observation exactly equal to 35 is excluded. The full histogram remains visible while individual qualifying observations are outlined.

## Encoded visual and mapping review

The reviewer independently decoded and inspected **44 actual 360px-wide PNGs**, eleven per final specimen, at 0.1, 0.6, 1.2, 1.8, 31.9, 32.033333, 32.3, 32.5, 33.1, 40 and 63.9 seconds. One additional final 720px image inspects monthly-change landscape frame **974**, where an earlier outline probe had failed. Superseded candidates are not the basis of this verdict.

The bar reveal grows from zero and displays a bin count only after that bar settles. The cut preserves the complete histogram and exact dot x coordinates. Unequal-width density bars keep the correct area relationship; their widths do not imply equal intervals. Threshold lines, direct counts and selected rings communicate the exact observed subset. Duplicate values remain separated, and the service observation at 35 is visibly unselected. Count text remains clear where the monthly threshold crosses its label location. Source text fits in both formats. No material clipping, overlap, lost observation or misleading partial-bin shading was found in these samples. Stable holds provide reading time; continuous pacing remains unreviewed.

The final producer-run encoded checker reports **1,534 native mapping checks, 128 arithmetic checks, 596 decoded frame samples, 2,285 bar-fill probes, 92 reveal-front probes with 92 above-front checks, 14,304 point probes, 4,488 outline-edge probes and 252 threshold probes, with zero failures**. The reviewer inspected the checker/reports and independently bound them to current artifacts; its full decode run was not repeated by the reviewer.

The checker independently derives sample counts, members, densities, affine geometry and packing without importing the JS helpers. Native coordinate tolerance is 1e-7 pixels. Encoded point and outline probes use a one-pixel radius at 720px width; front probes use two pixels. Outline ink requires every RGB channel below 160. The threshold probe is at 80% of plot height, away from the intentional count-label background. This changes its location, not the acceptance tolerance. These are bounded samples, not exhaustive image equivalence, OCR or continuous playback.

## Findings and resolutions

**Positive-bar collapse, resolved:** a legal model with y.max=1e308 produced zero-height native rectangles for positive counts. The scene now rejects positive bars below one native pixel and requests a tighter authored maximum. The independent regression passes; values are not silently enlarged or dropped.

**Selection-ring overlap, resolved:** at width 1080, the old 2.8r packing distance was 16.632 pixels, while two selected rings and their strokes required 17.444 pixels. Packing now reserves `3*r+3`, with a `1.3*r+1.5` bottom allowance for the final 3px outlines. Both beats use the same positions. Independent pairwise-distance and bottom-bound checks pass.

**Outline encoding clarity, resolved:** a 2px native stroke was too weak for a strict encoded edge probe in an earlier frame 974. The producer increased the actual stroke to 3px and updated packing clearance. The final exact frame was independently decoded and inspected. At the duplicate −50 observation, current left/right expected edge positions are (257.652,312.705) and (267.948,312.705) in the 720px image. Dark support [75,77,76] and [48,62,103] lies within the unchanged one-pixel radius. `outline-974-review.json` binds this proof to the current video/image.

**Copy and threshold clearance, resolved:** the producer moved the landscape footer inward and placed background clearance behind bin-count labels after the threshold stroke. Current native warnings and decoded samples are clear. The service unit is authored as `min`, keeping density wording concise. These changes preserve data and bar geometry.

**Sparse observations, resolved:** the producer found that JavaScript sparse-array slots bypassed the initial mapping check. The model now requires every observation index to be present; explicit null remains the only missing-value representation. Independent negative cases also confirm that sparse edges and ticks reject. This guard-only change leaves all four current storyboards and the audit byte-identical; final artifact bindings remain valid.

No further change is requested within the declared C13 prototype scope. The evidence supports these supplied fictional distributions and exact threshold counts. It does not establish a population model, forecast probability, continuous playback, narration/audio quality or final publication acceptance.
