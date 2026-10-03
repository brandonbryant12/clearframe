# Independent review — ranked small multiples

**Verdict: prototype; no remaining material finding in the reviewed candidates.** Four current 78-second silent draft specimens pass this bounded source, ranking, geometry, artifact-binding and encoded phone-frame review. Continuous subjective playback and final master acceptance were not observed. Arbitrary new copy, independent scales, more than four panels and unreviewed formats remain outside this verdict.

Reviewed 2026-10-03 separately from implementation. Scope: ranking/composition helpers and focused tests, plot contract, native group transform, kit direction/README, reusable API documentation, fictional input records, builder/audit, native diagnostics, encoded checker and reports, and actual decoded phone images. The reviewer changed only this report and `evidence/independent-review` artifacts. No browser, server or heavy render was started by the reviewer.

## Current artifacts

Input SHA-256: `fc735a5033010d6bb0887bbcd7afb44fd84e2a2a3adb862bd0d81555f5e2bc98`.

Ranking model SHA-256: `e8bb2f1e3bf20ae750b11f6cd4e804410cfcffc89836fb4fc865de29af826097`.

Composition helper SHA-256: `ad8de9a9f22f9d6b0bf21cd1da4a2e90e1c1abb62894225ceb53f561a60f7ce2`.

`evidence/independent-review/artifact-checks.json` binds each inspected video, storyboard, native job, receipt, model, composition, input, audit and final encoded report. All receipt hashes independently match the retained bytes. Each video contains 2,340 frames at 30 FPS, divided into 28/26/24-second beats. Native diagnostics contain zero errors and warnings; QA reports zero pops; shuffled sampled seeks match. Render elapsed time is not treated as clip duration. `source-bindings.json` retains the reviewed source, document, checker and report hashes.

| Specimen | Current pipeline |
| --- | --- |
| delivery-ranks-landscape | `2026-10-03T09-30-57-734Z-371b0bf8` |
| delivery-ranks-vertical | `2026-10-03T09-31-23-222Z-77954651` |
| household-ranks-landscape | `2026-10-03T09-31-47-757Z-beb71801` |
| household-ranks-vertical | `2026-10-03T09-32-12-992Z-40001d2c` |

## Contract and mathematical evidence

The reviewer ran the focused suite: **4/4 pass**. The retained independent `contract-review.mjs` passes **76,588 assertions**: 74,640 ranking assertions across 9,344 cases, 1,938 geometry/guard assertions and 10 label regressions. This is independent bounded contract evidence, not a full-repository test run.

Ranking checks exhaust every two-, three- and four-member combination from eight values: negative/positive 1e12, negative/positive one, signed subnormal extremes, zero and null, in both directions. The reference computes competition rank as one plus the count of strictly better supplied values. It verifies stable ASCII ID order for ties, missing members at the end, all-missing ranking dates, retained full histories/domains, input immutability and order invariance. It does not use the implementation's subtraction comparator to derive ranks.

Geometry checks cover 1920×1080, 1080×1920, 640×640 and 4096×2160 with two to four panels and every possible selected panel. They independently derive the leap-year February position as 29/151 of the January–June interval, verify shared elapsed-date reveal times, disconnect null gaps, and check uniform selected-group scale and endpoint translation. Native canvas group-origin semantics were inspected against these equations. Invalid common grids, missing rank dates, unsupported directions/counts, nonfinite/out-of-range values and extra fields are rejected. Mathematical coverage of these extra dimensions does not establish native visual acceptance for those formats.

The delivery record ranks ascending: January order is Delta/Beta/Gamma/Alpha; June has Alpha and Gamma tied at rank 1, Beta at rank 3, and missing Delta unranked. Gamma's February gap remains disconnected. Household flows rank descending: January order is Steady/Seasonal/Reserve/Delayed; June ties Reserve and Seasonal at rank 1, then Steady at 3 and Delayed at 4. Reserve's March gap remains disconnected. The selected household series retains a negative June value. No last-known observation substitutes for a null.

Every compact panel uses the same dated x domain and numeric y domain within its case. The second snapshot changes only the declared ordering date and panel positions while retaining full history. The focus transform uniformly enlarges marks, axes and labels; it preserves domains but necessarily changes pixels per unit in the visibly enlarged panel. It does not animate data values or imply intermediate rankings, a publication vintage or a forecast. Original records are explicitly fictional; household net flows are not balances or investment returns.

## Encoded visual and mapping review

The reviewer independently decoded and inspected **52 actual 360px-wide PNGs**, thirteen per current video, at 0.1, 1.2, 3, 5, 27.9, 28.033333, 53.9, 54.1, 54.4, 54.7, 55.3, 56.1 and 77.9 seconds. These cover empty/revealing/full first grids, both sides of the rank cut, fade, pre-expansion, intermediate expansion and final hold.

Both cases remain readable in landscape and vertical. Titles, declared ranking dates, values and source qualifications fit the sampled frames. Portrait subtitles wrap above the unit line. Tied and missing ranks are explicit; names preserve identity across the cut. Shared zero baselines and signed household values remain visible. Missing observations remain gaps. The selected panel grows without stretching its aspect ratio; the delivery focus preserves Gamma's gap, and the household focus preserves the negative endpoint. No material clipping, overlap or unintended occlusion was found in these samples. Long holds provide reading time; they do not establish subjective pacing in continuous playback.

The producer-run encoded checker reports **2,572 native mapping checks, 724 sampled decoded frames, 11,426 point probes, 210 reveal-front probes, 736 missing-column checks, 3,808 disappearance probes and 176 intermediate expansion-point probes, with zero failures**. The reviewer inspected the checker and retained reports and independently bound all four reports to the current artifacts; its complete decode pass was not rerun by the reviewer.

The checker independently derives ranks and calendar-day positions, verifies equal native grid extents, numeric labels and values, group placement, missing segments and reveal timing. It checks source coordinates within 1e-7 pixels and decoded colored support within three pixels at 720px width. Missing-column probes use a one-pixel radius and disappeared-panel probes use two pixels. Intermediate focus positions apply the declared easing and uniform affine transform. These bounded pixel probes support geometric registration, not exhaustive raster equivalence, continuous playback or OCR proof.

The retained four-specimen critique reports zero warnings. Its generic movement suggestions are not grounds to retime deliberate reading holds. Automated scores do not substitute for visual review or final acceptance.

## Findings and resolutions

**Year-label issue, resolved:** a multiyear date domain previously displayed only the starting year beside the unit. The helper now displays the full year span. The independent single-year and multiyear regressions pass.

**Rank-label precision issue, resolved:** unrounded values such as 1.3 and 1.4 could have different ranks but identical zero-decimal displayed values. Rank labels now add precision up to six decimals and explicitly mark remaining rounding with `≈`. Independent exact, signed, rounded and subnormal label cases pass. Arbitrary long or extreme labels still require a fresh native layout review.

**Layout issues, resolved in current candidates:** the producer moved landscape rank values into a separate same-row header column and moved portrait unit/grid positions to accommodate wrapped subtitles. The current decoded samples show clear separation between rank values, maximum axis ticks, subtitles and units. Superseded layout candidates are not the basis of this verdict.

No further change is requested within the declared C18 prototype scope. These are reusable silent native comparison assets, not narrated finished films, continuous-playback approvals or final publication masters.
