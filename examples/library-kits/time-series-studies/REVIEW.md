# Independent review — time-series studies

**Verdict: prototype; no remaining material finding in the reviewed candidates.** The twelve current 40-second silent draft specimens pass this bounded source, calculation, artifact-binding and encoded phone-frame review. Continuous subjective playback was not observed. Final master acceptance, narration, sound and accessibility remain unverified. This verdict does not promote the kit to a finished film.

Reviewed 2026-10-03 by the independent reviewer, separately from implementation. This final review supersedes the earlier 24-second candidates; only the 40-second bindings and refreshed captures below are current. Scope: `DIRECTION.md`, `SOURCES.md`, original inputs and audit, calculation API/tests, native panel construction, source-attribution validation, native receipts/diagnostics, shuffled-seek reports, encoded checker and the current encoded images. No implementation files were edited by the reviewer.

## Current artifacts

Input SHA-256: `afefe31ccff4116ad0ccee48c96c60cf166add73ed3b39e0b1a80f2f6fdd167b`.

`evidence/independent-review/artifact-checks.json` records the current video SHA-256, storyboard SHA-256 and pipeline ID for every specimen. Independently recomputed hashes match both render receipts and the final encoded-check report. All twelve authoritative native check reports contain zero errors and warnings; QA reports zero pops; shuffled sampled seeks match. These are sampled diagnostic claims, not continuous-playback proof.

| Specimen | Current pipeline |
| --- | --- |
| budget-and-prices-landscape | `2026-10-03T06-56-20-943Z-8931ddb4` |
| budget-and-prices-vertical | `2026-10-03T06-56-34-026Z-0bf079fa` |
| interrupted-output-landscape | `2026-10-03T06-56-46-838Z-d1ace1c4` |
| interrupted-output-vertical | `2026-10-03T06-57-00-384Z-fabda689` |
| pay-and-prices-landscape | `2026-10-03T06-57-13-126Z-8c0cf155` |
| pay-and-prices-vertical | `2026-10-03T06-57-26-493Z-eeb9c199` |
| recovered-path-landscape | `2026-10-03T06-57-38-999Z-8c70aa78` |
| recovered-path-vertical | `2026-10-03T06-57-52-181Z-c0eaf337` |
| slower-expansion-landscape | `2026-10-03T06-58-04-816Z-5b02c878` |
| slower-expansion-vertical | `2026-10-03T06-58-17-872Z-bb92a41f` |
| unfinished-path-landscape | `2026-10-03T06-58-30-569Z-bb8654fc` |
| unfinished-path-vertical | `2026-10-03T06-58-43-740Z-1040b088` |

## Calculation and source review

The reviewer ran the final six focused time-series/source-element tests: all passed. An additional 7,428 independent arithmetic and calendar assertions passed, covering dated deflation, lag 1/2/3/6 growth, compounded annualization on/off, changes in growth, rolling sample SD with windows 2/3/5, running observed peaks, 1900/2000 leap rules, day clipping/restoration and month-end anchoring. Another 352 independent fixture assertions compared all twelve audit results with Python Fraction calculations and an independent sample-SD implementation. The retained summary is `evidence/independent-review/arithmetic-review.json`.

- **C09:** final pay 58 / 1.32 = 43.93939… in 2020-price thousands, with nominal minus real +14.06060…; final budget 110 / 0.9 = 122.22222…, with difference −12.22222…. The screen rounds these to 43.94/+14.06 and 122.22/−12.22. The missing 2022 budget price index breaks only the real series. The visible basis makes clear that this difference compares stated nominal and base-year price bases.
- **C10:** the slower-expansion fixture grows by 10%, 8%, 6%, 4%, 2%; consecutive growth changes are −2 percentage points after warmup. A missing April level in the alternate fixture removes the adjacent growth results and their dependent growth changes. Warmup and missing values are gaps, never zero or interpolated observations.
- **C11:** recovered-path reaches −20% and first observes recovery to its February peak in May; the later episode also recovers. Unfinished-path reaches −25% and ends without observed recovery. The retained orange peak across a missing level reflects known observations, not an unseen high or inferred recovery. Three-return SD uses the n−1 denominator and requires all three monthly percentage changes; its displayed unit is percentage points and it is not annualized.

Original fictional records and formula assumptions are disclosed on screen and in source documentation. Calendar anchoring, endpoint-lag behavior, equal peaks and missing observations are explicitly documented. This review verifies fixture arithmetic and the internal source trail; it does not certify a historical external dataset or independently audit the external methodology websites. The producer reports 178/178 full Node tests and a later 14/14 combined focused suite; those broader commands were not run by this reviewer.

## Encoded visual review

The reviewer independently decoded and inspected **84 current 360px-wide PNGs**, seven per specimen: 1.9, 19.9, 20.033333, 21.2, 22.5, 25 and 39.9 seconds. The captures cover the complete explanation, pre-cut/post-cut, early and middle reveal, settled view and final hold. All twelve sets were decoded and inspected again after the final extension to two 20-second beats; the cut is now at 20 seconds. Superseded 24-second captures were replaced. All captures are retained under `evidence/independent-review/<specimen>/`.

The explanation-to-evidence cut is intentional and legible. Axes establish before marks; all linked panels advance on the same elapsed-date clock. Growth warmup, missing-level gaps and the delayed availability of rolling SD remain visible. Underwater fill appears after the boundary is drawn and does not bridge a missing observation. C09 final labels and the difference wait for completion. Titles, source copy and units remain readable; landscape is compact, portrait has more breathing room. Current integer tick labels preserve the values while avoiding the earlier portrait margin warning.

The final producer-run encoded checker is bound to these exact video/source hashes. Its report has 1,488 native mapping checks, 1,008 sampled decoded frames, 5,830 point checks, 78 front checks, 1,950 missing-column checks and zero failures. There are 1,480 reported occlusion exclusions, including four explicitly proven coincident fronts: recovered-path frames 633 and 693 in both formats have zero computed front distance and the later-drawn orange color is present at the encoded location. The reviewer inspected the checker and exclusion evidence, without rerunning its full decode pass. Three-pixel tolerance at 720px width, 2Hz samples and four exact reveal frames per video make this bounded evidence; it is not an exhaustive pixel or area census.

## Findings and resolutions

**Tool issue, resolved:** the first `sourceElement` guard accepted `blur:60` and `fill:'bg'`, allowing illegible attribution to satisfy its visible-source requirement. The reviewer reproduced both accepted counterexamples. The final guard uses a strict text-field allowlist, requires ink fill and full opacity, and rejects blur/effects/transforms/exits and canvas print/rough. Counterexample tests now pass. A storyboard source record remains required, and native bounds/font/overlap checks still apply. Current specimens use effect-free ink source text.

**Diagnostic issue, resolved:** initial encoded front checks reported four misses where the orange observed-peak segment exactly covered the blue level segment. The final exclusion requires a later opposing segment, mathematically identical active front and visible encoded later color; each proof is retained. This is a documented occlusion, not a relaxed coordinate tolerance.

**Producer-found layout issue, resolved and re-reviewed:** redundant decimals in C09 integer y ticks triggered portrait safe-area warnings. Final ticks are integer-labelled; two-decimal endpoint figures remain. All current reports and refreshed frames are clear.

**Producer-found pacing issue, resolved and re-reviewed:** the original 10-second explanation and 14-second plot left 47–54 words too little reading time in some specimens. Both beats now last 20 seconds, giving a 40-second total. Content, fixed geometry and the 0.6–4.6-second dated reveal within the plot remain unchanged; the additional time is a reading hold. The final `evidence/critique.txt` covers all twelve 40-second specimens and has no reading-rate warning. Its stillness advisories are retained and intentional for these silent studies. Fresh encoded samples verify the new cut and final hold; an automated rate check does not establish subjective playback quality.

No additional changes are requested within the declared prototype scope. Under the fresh-review rubric, hooks and explanatory questions are clear, the source-to-transformation argument is coherent, and native geometry serves the evidence. This kit deliberately uses formula inserts, flat quantitative charts and long reading holds; those are appropriate reusable study specimens, but do not establish cinematic variety, speech timing or a finished narrative film. Square and 4:5 versions were not reviewed.
