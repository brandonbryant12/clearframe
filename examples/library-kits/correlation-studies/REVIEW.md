# Independent review — correlation windows

**Verdict: prototype; no remaining material finding in the reviewed candidates.** Four current 94-second silent draft specimens pass this bounded source, arithmetic, native geometry, artifact-binding and encoded phone-frame review. Continuous subjective playback and final master acceptance were not observed. Four-member visual acceptance, arbitrary new labels, other methods/frequencies and unreviewed formats remain outside this verdict.

Reviewed 2026-10-03 separately from implementation. Scope: the Pearson model and native composition, focused tests and shared plot contract, input records and builder/audit, direction/README/API/provenance documents, native diagnostics, encoded checker and reports, and actual decoded images. The reviewer changed only this report and `evidence/independent-review` artifacts. No browser, server or heavy render was started by the reviewer.

## Current artifacts

Input SHA-256: `eb159d2103e49cc8497b13a0dcda34cc6c089642363273d0ceb08b361027939c`.

Model SHA-256: `25d6e7ed20b6f4837136da01d55b4b0bfc24fb956fb2f8bc673d0653a18cf697`.

Composition SHA-256: `799558247b9b6a784cb41fcfaa3f6a4fdfe619e50c9e29b5c7ebdc7380276582`.

`evidence/independent-review/artifact-checks.json` binds each inspected video, storyboard, native job, receipt, model, composition, input, audit and final encoded report. All receipt hashes independently match retained bytes. Each current video contains 2,820 frames at 30 FPS, divided into 34/32/28-second beats. Duration is 94 seconds from frames/FPS; the receipt's encoder elapsed time is separately recorded as `encodeSeconds`. All native reports contain zero errors and warnings, QA reports zero pops, and shuffled sampled seeks match. `source-bindings.json` retains reviewed source, document, test, checker and report hashes.

| Specimen | Current pipeline |
| --- | --- |
| changing-pair-landscape | `2026-10-03T10-08-43-608Z-9b8ed11f` |
| changing-pair-vertical | `2026-10-03T10-09-14-506Z-413a178b` |
| missing-pairs-landscape | `2026-10-03T10-09-45-241Z-3c4bfd02` |
| missing-pairs-vertical | `2026-10-03T10-10-15-655Z-a7178417` |

## Independent arithmetic and contract evidence

The reviewer ran the focused suite: **4/4 pass**. The retained `contract-review.mjs` passes **32,489 independent assertions**: 28,770 mathematical assertions, 22 invalid-input guards, 2,813 scene/color/layer-order assertions and 884 current kit-audit assertions. Its main matrix fixtures cover 297 matrices and 2,531 cells, with additional maximum-length and indefinite-matrix examples. The producer's retained full-suite log reports **196/196 pass, zero failures or skips**; the reviewer inspected that log without rerunning the full suite.

The review independently checked the centered Pearson formula against [NIST Dataplot: Correlation](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm). The reference test does not reuse the implementation's min/range normalization. It converts every supplied IEEE-754 value into an exact signed integer in units of 2^-1074, evaluates covariance sums with BigInt, and converts only for the final normalized coefficient. This separates arithmetic verification from the producer's floating-point centering algorithm. Coefficients agree within 3e-14 in the tested fixtures.

Cases include exact zero correlation, positive/negative linear relations, constant members, subnormal differences, mixed scales, large offsets with adjacent representable differences, values near the −100% boundary, asymmetric nulls and short/one-month windows. Assertions check pair counts, contributing and missing dates, undefined reasons, input immutability, full-history retention, matrix symmetry and stable ID mappings under input permutation. The 120-month/two-series boundary remains within the shared 240-observation limit. A constructed three-member pairwise-deletion matrix has valid per-pair coefficients but determinant −4; the API preserves this result and makes no positive-semidefinite or portfolio-risk guarantee.

Guards reject unsupported method/frequency/return conventions, non-month-end dates, omitted months, mismatched grids, reversed/unlisted windows, invalid minimum samples, impossible simple returns, stale as-of dates, nonfinite values, duplicate IDs and unsupported member counts. Undefined results distinguish too few paired observations from zero variance, including diagonal cells. Numeric zero stays a defined coefficient. The minimum is an authored sample threshold, not a significance test.

Scene checks cover two to four members at four dimensions, fixed −1/0/+1 colors, symmetric pair outlines, cell locations/timing/labels, common pair-chart domains, elapsed-calendar positions and reveal times, disconnected null gaps and hollow unpaired observations. Forty-eight layer-order checks ensure hollow marks paint after attached line segments. This mathematical/layout coverage is separate from native visual acceptance: current rendered cases have three members and two reviewed formats.

All 884 kit-audit checks derive cell coefficients/counts/dates directly from `inputs.json`. The changing-pair case moves Alpha/Beta from +1 in January–June to −1 in July–December; constant late Gamma is undefined even on its diagonal. The missing-pairs case uses four late Alpha/Beta pairs. Alpha's August and November observations remain visible but unpaired. Late Alpha/Gamma has three pairs and Beta/Gamma has two, below the declared minimum four. Nothing fills, carries, annualizes or converts prices into returns. All source records and narratives are original fictional examples.

## Encoded visual and mapping review

The reviewer independently decoded and inspected **44 actual 360px-wide PNGs**, eleven per final video, at 0.1, 0.5, 1.3, 33.9, 34.033333, 65.9, 66.1, 67.5, 69.4, 70.5 and 93.9 seconds. Two additional final 720px images inspect missing-pairs portrait frame 2085 and landscape frame 2817. Earlier candidates and failed diagnostics are not the basis of this verdict.

The sampled matrix reveal introduces whole values/counts without interpolating coefficients. Both sides of the window cut retain member order, signed legend and selected-pair outline. Dates, counts and undefined reasons remain visible. Portrait source copy wraps within the safe area. The pair view preserves equal percent/date scales and uses the same elapsed-date reveal in both charts. Missing Beta months remain disconnected; Alpha's excluded observations have clear hollow centers and colored rims in both final formats. Final holds preserve these distinctions. No material clipping, overlap or misleading statistical geometry was found in the reviewed samples. Long stable holds remain a reading-time choice, not a continuous-playback pacing approval.

The producer-run final encoded checker reports **1,424 native mapping checks, 540 arithmetic checks, 840 decoded frame samples, 19,968 cell-fill probes (including 5,280 undefined fills), 768 hidden-cell probes, 2,428 point probes, 72 reveal-front probes, 192 missing-column checks and 220 hollow-center/rim checks, with zero failures**. The reviewer inspected the checker and reports and independently bound them to all four current artifacts; its complete decode run was not repeated by the reviewer.

The checker independently derives current example correlations, pair counts/dates, calendar-time geometry and native labels without importing the JS helpers. Source coordinates use a 1e-7-pixel tolerance. Decoded matrix fills allow 18 RGB levels per channel. Colored point/front support uses a three-pixel radius at 720px width; missing columns and hollow centers use one pixel, and hollow rims use two. The final checker retains these tolerances and verifies the enlarged native marker radius. These are bounded probes, not exhaustive raster equivalence, OCR or continuous playback.

The retained four-specimen critique reports zero warnings. Its generic movement suggestions do not override deliberate statistical cuts or reading holds. Automated scores do not establish master acceptance.

## Findings and resolutions

**Hollow-marker layering defect, resolved:** the earlier composition interleaved segment and circle elements. A later segment painted through the center of the previous hollow observation, making an excluded month look filled. In the old landscape diagnostic, August center (138,239) was RGB [42,87,210], and November center (278,202) was [100,133,226] at 720px width. All segments now paint before all point circles while retaining their original timing. Independent layer-order regressions pass. The current corresponding centers are background RGB [244,242,232] and [243,243,232]. `hollow-layering-finding.json` explicitly marks the original evidence superseded and binds the corrected final artifact.

**Hollow-marker clarity, improved and rechecked:** after fixing layer order, the smaller portrait marker produced a chroma-bleed pixel within the unchanged one-pixel center probe at frame 2085. The producer enlarged marker radius from .0045W to .006W, preserving centers, values, dates and pairing. Final frame 2085 is independently inspected and bound in `hollow-2085-review.json`; center (527,491) is [242,242,231], and the earlier failing adjacent pixel (528,492) is [255,246,239]. The full four-clip checker now passes without relaxing center/rim tolerances.

**Portrait footer overflow, resolved:** actual native diagnostics found three safe-area warnings in an earlier changing-pair portrait. The portrait source baseline moved from .925H to .91H. Both current portraits have zero warnings and clear decoded footer samples. Landscape matrix cells/text were also widened/enlarged by the producer before final review; current candidates use that layout.

No further change is requested within the declared C07 prototype scope. The evidence supports descriptive Pearson matrices and paired histories for the retained fictional examples. It does not establish causation, prediction, significance, a valid portfolio covariance model, continuous playback, narration/audio quality or final publication acceptance.
