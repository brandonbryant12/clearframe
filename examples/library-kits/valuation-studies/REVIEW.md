# Independent review — valuation sensitivity studies

**Verdict: prototype; no remaining material finding in the reviewed candidates.** Four current 72-second silent draft specimens pass this bounded source, mathematical, geometry, artifact-binding and encoded phone-frame review. Continuous subjective playback and final master acceptance were not observed. New assumptions, copy, denser grids and other aspect ratios require fresh review.

Reviewed 2026-10-03 separately from implementation. Scope: both model/composition helpers, focused tests, inputs, builder/audit, direction and method provenance, native reports, encoded-checker source, and actual decoded frames. The reviewer changed only this report and `evidence/independent-review`. No browser, server or heavy render was started by the reviewer.

## Current artifacts

Input SHA-256: `377e281374fb73c2d5d5723ce115d3f5ca6c9edb98d39bee68b36917a033fae9`.

Model SHA-256: `780a6ca096b2729c35880f86227fb3cefe5863b635e3d412bf7d5d8a6e05a3ba`.

Composition SHA-256: `ea0d86cada15550eccff838d788ea64ef40c17477678033a7b72fff1fd86030a`.

`evidence/independent-review/artifact-checks.json` binds the reviewed videos to each current storyboard, audit entry, native job and encode receipt. Every retained video contains 2,160 frames at 30 FPS and two 36-second beats. Duration is **72 seconds** from frames/FPS; encode elapsed time is separately named `encodeSeconds`. The four native reports contain zero errors and warnings, QA reports zero pops, and shuffled sampled seeks match. Native runs were produced by the implementation agent; the reviewer independently verified their artifact identities rather than rerunning them.

| Specimen | Final pipeline |
| --- | --- |
| finite-project-landscape | `2026-10-03T11-13-40-915Z-43aea0f1` |
| finite-project-vertical | `2026-10-03T11-14-04-983Z-fd203692` |
| perpetual-payments-landscape | `2026-10-03T11-14-27-401Z-0e827052` |
| perpetual-payments-vertical | `2026-10-03T11-14-51-664Z-3095718b` |

## Independent model and geometry checks

The reviewer independently ran the five focused tests: **5/5 pass**. The producer’s retained full-suite log reports **206/206 pass, zero failures or skips**; the reviewer inspected this log without rerunning the full suite. `contract-check.mjs` and its retained report pass **33,154 numerical/model comparisons, 30 invalid-input or crowding rejections, and 306 geometry checks**. The finite reference constructs exact integer powers with BigInt for each year's rational growth/discount ratio, then converts that term for comparison. It separately verifies annual cash flows, present values, total present value and subtraction of initial outlay over negative, zero and positive base flows; several upfront outlays; horizons 1, 2, 5, 12 and 30; and both slice directions. Perpetual comparisons independently use the first future flow and rate difference. Floating-point comparisons allow 1e-9 absolute or 1e-12 relative error.

The finite model treats `cashFlowNow` as the annual time-zero basis. It is not a receipt at time zero. The first receipt includes one year of growth and discounting. The initial outlay is subtracted exactly once, and no terminal receipt is inferred. Equal growth and discount are valid for a finite horizon. The perpetual model requires discount strictly above growth and keeps every other cell null with an explicit reason, including a zero-flow degenerate case under this declared policy. These rules agree with the independently consulted [Damodaran constant-growth formula](https://pages.stern.nyu.edu/adamodar/New_Home_Page/lectures/ddm.html) and [OpenStax net present value method](https://openstax.org/books/principles-finance/pages/16-2-net-present-value-npv-method). Historical company examples and market assumptions from those references are not used.

The selected perpetual case is 4 × 1.02 / (0.06 − 0.02) = **102.00 USD**. Its fixed-growth slice is undefined at discount 2%, then 204, 102, 68 and 51 at 4%, 6%, 8% and 10%. The selected five-year case has present value **379.0786769408448 USD** and initial outlay 500, giving **−120.92132305915521 USD**, displayed as −120.92. Its fixed-discount slice at growth −10%, 0% and 10% is approximately −214.9915244, −120.9213231 and 0. The equal 10% growth/discount case is valid zero, distinct from the perpetual undefined cells.

Guards reject unsupported fields, nonfinite or unsupported amounts, negative outlay, unsupported timing/terminal/horizon, duplicate or descending rates, sparse rate/tick arrays, mismatched precision, unlisted selected rates, unsupported slice direction, clipped scales, missing signed-scale zero ticks and excessive crowding. Slice points exactly reuse their corresponding grid evaluations while holding the other selected assumption fixed. No segment crosses an invalid point. Geometry checks independently derive affine slice coordinates for both supplied formats, ensure numeric labels stay within cell bounds, and preserve color/value correspondence.

## Encoded visual review

The reviewer independently decoded and viewed **48 actual 360px-wide PNGs**, twelve per final clip, at 0.1, 0.5, 0.9, 1.4, 3, 35.9, 36.033333, 36.3, 36.7, 37.8, 39.9 and 71.9 seconds. `frames.json` records the exact current video hashes, frame hashes and inspected status. Superseded finite clips are excluded from this verdict.

The grid reveals complete cells and labels together. The fixed row or column has a consistent outline, with a stronger selected cell. Finite negative values use orange, positive values use blue, and zero remains light with an explicit 0.00 label. Perpetual undefined values have gray fill and an em dash. Exact values, rate axes and a labeled legend carry the quantities; color does not imply desirability or probability.

The cut at 36 seconds retains title, base annual flow, outlay, horizon/terminal policy and fixed assumption. The line view uses the same selected cases and scale. The perpetual line begins at the first valid 4% discount point, leaving 2% empty. The finite line ends at the valid zero value. Intermediate samples show the line advancing between evaluated points; the final marker appears only at its declared reveal time. The caption explicitly calls connecting lines guides. No material clipping, overlap, misplaced zero, lost undefined cell or misleading bridge was found in these samples. Landscape figures are compact at phone width; portrait has stronger reading clearance. Source/date text remains visible in both.

The retained automated critique reports zero warnings for all four specimens; its three suggestions per specimen concern the held beats and lack of a narrative question. The long holds are authored reading time, so those suggestions do not change this prototype’s duration. These observations establish sampled encoded-frame behavior, not continuous subjective pacing, audio quality, browser playback or a final publication master.

The final producer-run encoded checker passes **1,002 native mapping checks, 1,020 arithmetic checks, 676 decoded frame samples, 19,104 visible cell-fill probes (including 1,960 undefined-fill probes), 1,776 hidden-cell probes, 986 point probes, 36 reveal-front probes and 128 invalid-column checks, with zero failures**. Its independent 60-digit Decimal formulas, native rate/box/value mapping and sampled encoded marks were read and bound to the current artifacts. The reviewer did not repeat its full decode run. Native coordinate tolerance is 1e-7 pixels; arithmetic tolerance is 1e-9 absolute. Encoded fill colors allow 18 RGB levels per channel; blue point/front support is sought within two pixels at 720px width, and invalid columns use a one-pixel radius. These bounded probes do not constitute OCR or exhaustive pixel equivalence.

## Findings and resolutions

**Asymmetric cell label overflow, resolved:** with discount samples [0, 20, 100], a wide number was anchored at the true rate coordinate near the left side of its midpoint-defined cell while its fit allowance used the full cell width. The scene now centers the value label in its rectangle while retaining the numeric rate coordinates for the axes and audit. The independent fixture verifies its center and fit bounds.

**Crowded numeric axes, resolved:** nonuniform rates and explicit value ticks could place neighboring labels too close even when cell widths or average spacing appeared adequate. The scene now checks nearest-boundary fit for grid discount labels, adjacent growth-label spacing, adjacent slice-rate spacing and adjacent value-tick spacing. Independent fixtures reject crowded grid x/y, slice x and value ticks. Rate positions remain quantitative; no values are nudged or relabeled.

**Basis and tick clarity, resolved:** visible copy identifies the base as an annual flow. Slice tick labels retain their exact supplied values without forcing redundant decimal places. Cell values still use the declared valuation precision. These producer changes are present in all four final encoded clips.

Current source, test, document, checker, report and independent-evidence hashes are retained in `source-bindings.json`.

No further change is requested within the declared C14 prototype scope. These are fictional formula sensitivities, with no inferred probability, forecast or complete business valuation.
