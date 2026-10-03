# Independent review — expectations studies

**Verdict: prototype; no remaining material finding in the reviewed candidates.** All twelve current silent draft specimens pass this bounded source, calculation, artifact-binding and encoded phone-frame review. Continuous subjective playback was not observed. Final master acceptance, narration, sound and accessibility remain unverified. This verdict does not promote the kit to a finished film.

Reviewed 2026-10-03 by the independent reviewer, separately from implementation. Scope: DIRECTION.md, SOURCES.md, original inputs and audit, expectations API/tests, native chart construction, render receipts/diagnostics, shuffled-seek evidence, encoded-checker source and current MP4-decoded images. The reviewer edited only REVIEW.md and evidence/independent-review artifacts. No browser or server was used.

## Current artifacts

Input SHA-256: `f8333660e6c9fb33c3ec1b734eb01a0e099ab0a6269fcdb93be8875419136dc3`.

Model source SHA-256: `d36b7e44778d563a01e47d3b4eb2c8dd2517e6961e59ad98066f3b23b520e2b4`.

`evidence/independent-review/artifact-checks.json` records every current video/storyboard/pipeline binding, actual duration, inspected capture count, model/input/audit/native-job/receipt hashes and encoded-report binding. Independently recomputed hashes match render receipts and all twelve final encoded reports. All native check reports have zero errors and warnings; QA reports zero pops; shuffled sampled seeks match. The receipt's elapsed rendering seconds are not used as film duration: these clips are 1,560/30 = 52 seconds or 1,380/30 = 46 seconds. `source-bindings.json` binds the source and final report files.

| Specimen | Duration | Current pipeline |
| --- | --- | --- |
| capacity-vintages-landscape | 52 s | `2026-10-03T07-56-59-160Z-d89d8cca` |
| capacity-vintages-vertical | 52 s | `2026-10-03T07-57-17-142Z-8e8cd157` |
| delivery-vintages-landscape | 52 s | `2026-10-03T08-01-15-485Z-62ab2538` |
| delivery-vintages-vertical | 52 s | `2026-10-03T08-01-32-853Z-68ec51d3` |
| maturity-gap-landscape | 46 s | `2026-10-03T08-06-23-421Z-a896224a` |
| maturity-gap-vertical | 46 s | `2026-10-03T08-06-38-473Z-3169723a` |
| maturity-slope-landscape | 46 s | `2026-10-03T08-01-49-582Z-44a62b11` |
| maturity-slope-vertical | 46 s | `2026-10-03T08-02-04-515Z-955bfef4` |
| scenario-quantiles-landscape | 46 s | `2026-10-03T08-07-25-243Z-b7755bf2` |
| scenario-quantiles-vertical | 46 s | `2026-10-03T08-07-40-443Z-176dce27` |
| scenario-range-landscape | 46 s | `2026-10-03T08-06-54-547Z-cba8bc3f` |
| scenario-range-vertical | 46 s | `2026-10-03T08-07-10-559Z-e4301021` |

## Calculation and source review

The retained `evidence/independent-review/data-review.mjs` independently passes 1,204 assertions: 1,178 general chronology, normalization and scenario checks, plus 26 regressions for two resolved numeric findings. `data-review.json` binds the tested model hash. The reviewer also ran the focused expectations suite, 3/3 passing. The producer reports the broader gated 185/185 Node suite with no skips or failures; that full command was not run by this reviewer.

- **C04:** only vintages and releases available on or before the cutoff enter the view. March capacity actual 98 becomes revised 101, and June actual 108 becomes available in the August view. Delivery actuals change 112 to 109, with June 118 newly available. The unpublished October vintage and its December target do not leak into either earlier view. The missing January forecast for June stays missing and leaves two isolated forecast points. Forecast target dates and observation/release dates have distinct roles. Endpoint legend values are explicitly the last available target.
- **C06:** 1, 6, 12, 24, 60 and 120 months map to 1/12, 1/2, 1, 2, 5 and 10 years with true unequal spacing. Observation dates identify separate snapshots. The alternate case includes negative January quotes and a null 2-year quote; both adjacent January segments are absent. Connecting lines are disclosed as visual guides, without fitted rates, implied forwards or a future-rate claim.
- **C12:** the three-path range ends at 70–145 with middle path 120. The five-path 25th–75th type-7 interval ends at 75–125 with median 100. The missing May path suppresses lower, upper and median results and both adjacent band segments; the denominator is never reduced to the four available paths. History ends at the common March 31 origin, and shading appears only within the supplied future scenario domain. The band describes supplied scenarios and does not claim confidence, coverage or calibrated likelihood.

The independent contract checks also cover shuffled releases, inclusive cutoffs, null withdrawal without resurrecting an older release, zero rereleases, removal of hidden future prefixes, all-null maturity snapshots, scenario counts 2–25, four percentile pairs, and missing-date recovery. The producer-run checker independently recomputes fixture geometry from input dates, month-to-year conversion, and Fraction-based scenario quantiles; its source was inspected by the reviewer. Original fictional data and assumptions are disclosed on screen and in source documentation. This review verifies the internal source trail; it does not certify external historical data or independently audit the external methodology websites.

## Encoded visual review

The reviewer independently decoded and inspected **116 current 360px-wide PNGs**, plus one exact 720px-wide diagnostic frame. All are retained under `evidence/independent-review/<specimen>/`.

The four vintage clips were sampled at 0.1, 1.2, 3, 5, 25.9, 26.033333, 27.2, 29, 31 and 51.9 seconds. The four maturity clips were sampled at 0.1, 1.2, 3, 19.9, 20.033333, 21.2, 23, 25 and 45.9 seconds. The four scenario clips were sampled at 0.1, 1.2, 3, 19.9, 20.033333, 21.2, 23, 24.7, 25.3 and 45.9 seconds. These samples cover explanation, pre/post cut, early/middle reveal, completed geometry, band arrival and final hold.

Titles, units, dates, keys, endpoint values, takeaway and attribution remain legible in both formats. Landscape is compact; portrait has more room. The cutoff change is explicit while target axes remain fixed. Axes precede marks. Nonuniform maturity spacing and negative quotes remain visible. Missing data leave visible gaps rather than interpolation. Scenario paths share the marked origin, and the fill follows the completed paths without filling missing dates or observed history. Sampled cuts are clear. The 20/26-second explanatory holds leave reading time; the retained critique reports stillness and narrative-hook advisories, not reading-rate warnings. Those advisories are appropriate limits for reusable silent studies and do not establish a finished narrative film.

The final producer-run encoded checker reports 1,764 native mapping checks, 1,216 decoded frame samples, 7,578 point checks, 118 front checks, 1,224 missing-column checks, 2,050 band-interior checks and 246 missing-band checks, with zero failures. Its 186 occlusion exclusions require declared later geometry and the actual encoded later color. The reviewer inspected the checker and evidence without rerunning its full decode pass. At 720px width, the checker uses a three-pixel point tolerance, 2Hz sampling, and four exact reveal-front frames per chart. This is bounded evidence rather than an exhaustive pixel or area census.

## Findings and resolutions

**Numeric issue, resolved:** positive distinct month tenors could divide into zero or identical normalized years. Strict normalized-year monotonicity now rejects both subnormal underflow and ordinary adjacent-number collapse. Both counterexamples are retained in the independent checks.

**Numeric issue, resolved:** weighted endpoint quantile interpolation could turn equal subnormal endpoints into zero or round equal bounded endpoints outside the allowed range. Difference interpolation with adjacent-rank clamping now preserves these equal values exactly. Twenty-four exact endpoint assertions pass.

**Encoded diagnostic issue, resolved:** scenario-quantiles portrait source frame 663 contained the gray upper front at the predicted position, but thin-line H.264 chroma loss made its pixels too neutral for the original gray classifier. The reviewer decoded and inspected that exact frame and independently read neighboring RGB values. The final diagnostic fallback keeps the same three-pixel positional radius, requires a pixel within 28 per channel of the declared gray palette with every channel above 75, and requires more than six pixels of clearance from other series, grid and origin geometry. Retained proof identifies pixel (330,719), RGB [108,110,109], palette distance 11 and other-geometry clearance 11.342 pixels. This is a constrained detector correction with actual pixel evidence, not a geometry exception or wider coordinate tolerance. The final complete checker rerun passed all twelve clips.

No further change is requested within the prototype scope. The fresh-review argument is coherent and the native geometry serves the stated chronology, maturity and scenario lessons. Square and 4:5 formats, continuous playback and interactive browser behavior were not reviewed.
