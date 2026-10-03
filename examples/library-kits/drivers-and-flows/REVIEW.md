# Independent review: drivers, histories and flows

## Verdict

**Prototype; no remaining material findings in the inspected twelve specimens.** The two source-unit issues raised in this review are resolved in the current encoded outputs. This is a bounded review of the original six cases in separately composed landscape and vertical formats. **Continuous playback has not been observed.** Source arithmetic, sampled frames and automated geometry checks do not promote these to accepted finished-film assets or approve other aspect ratios.

## Scope and artifact identity

Reviewed `DIRECTION.md`, `inputs.json`, `audit.json`, `build.mjs`, `source/bridge.mjs`, `engine/lib/data-transforms.mjs`, `verify.mjs`, `check-encoded.py`, current native jobs and encoded receipts. The audit input hash matches the current original input file:

`b04684c1e0c2b320ef9d992aa3c1a189ce37cda9492bba9644c9ba49a28a80ad`

Each video receipt's storyboard SHA-256 matches its current specimen storyboard. All twelve current verification records contain no check errors/warnings, zero detected QA pops, and matching sequential/shuffled seek hashes. Exact final runs under `specimens/<variant>/build/pipeline/`:

| Variant | Run |
| --- | --- |
| cohort-adoption-landscape | `2026-10-03T03-33-10-294Z-7c92f0a1` |
| cohort-adoption-vertical | `2026-10-03T03-33-18-837Z-4111a046` |
| earnings-and-income-landscape | `2026-10-03T03-33-26-974Z-e0e14af5` |
| earnings-and-income-vertical | `2026-10-03T03-33-36-317Z-f4b670c1` |
| fund-assets-landscape | `2026-10-03T03-33-44-843Z-132ec23d` |
| fund-assets-vertical | `2026-10-03T03-33-53-334Z-4d180333` |
| price-and-volume-landscape | `2026-10-03T03-34-01-333Z-5652e866` |
| price-and-volume-vertical | `2026-10-03T03-34-10-124Z-0942b233` |
| project-recovery-landscape | `2026-10-03T03-34-19-121Z-74d72c98` |
| project-recovery-vertical | `2026-10-03T03-34-27-422Z-7cdb1dcb` |
| warehouse-units-landscape | `2026-10-03T03-34-35-247Z-a98b02d7` |
| warehouse-units-vertical | `2026-10-03T03-34-43-615Z-807db683` |

The reviewer independently decoded and visually inspected six actual encoded frames per variant at 360-pixel width, retained in `evidence/independent-review/<variant>/`:

- C02: 3, 8.9, 9.03, 11, 14 and 22.9 seconds.
- C03: 4.5, 11.9, 12.03, 13.45, 16 and 25.9 seconds.
- C16: 1.45, 3.5, 13.9, 14.03, 17 and 23.9 seconds.

These 72 images cover both scenes, frames on both sides of the cut, partial quantitative reveals, settled quantitative marks and final holds. The requested times are sampling positions; decoding selects the corresponding available video frame. This is not continuous observation, a frame-by-frame subjective audit or proof of every entrance phase. Earlier stale receipts were explicitly excluded after storyboard hash comparison.

## Findings raised and resolved

1. **C02 original anchor units were unspecified.** The first source version supplied dated bases such as 100/80 and 200/50 without defining the original measure. The corrected inputs and anchor scenes now explicitly show “Active subscriptions” for the cohort case and “Daily output · units/day” for the project case. Confirmed in both encoded formats at 3s and 8.9s. The later index remains dimensionless with its own clear normalization label.
2. **C16 equations lost their unit after the cut.** The initial fund reconciliation scene showed 132−120 and 132−127 after removing the preceding USD-millions label. The corrected check scene carries `c.unit` through the cut. Both asset and inventory units are visible at 14.03s, 17s and 23.9s in both formats. The historical uncorrected fund samples remain only in the ignored `build/independent-review/` review scratch directory; they are not final evidence.

The author also reported removing redundant C02 base-value copy that overlapped the landscape violet-region explanation before the final render. The reviewer did not inspect that superseded overlap as an independent finding; the final chart layouts show the explanation clearly separated from the key and axis label.

No renderer defect or additional structural change is requested for the current fixtures.

## Independent arithmetic and semantic review

### C02: dated historical normalization

`rebaseSeries` requires an exact observed positive base and positive base index, validates ordered real dates, retains nulls, and computes elapsed UTC days and unrounded ratios. The source does not invent a newer continuation or substitute a missing older value. Independent rational-arithmetic/date checks agree with the audit:

- Cohort anchors: newer 100 on 2026-01-01; older 80 on 2024-01-01. Both normalize to 100. Newer ends on elapsed day 90 at 123; older ends on day 180 at 142.5. The older peak is 147.5 on day 150. Leap-year dates still map to the declared 30-day observations.
- Project anchors: newer 200 on 2026-02-01; older 50 on 2023-02-01. Newer indices are 100, 95, 110 and 125 through day 90. Older indices are 100, 110, 120, 136, missing, 125 and 130 through day 180. The missing observation is day 120, not zero.

Both encoded formats end the newer blue series at day 90 and keep the older-only violet region on the same fixed elapsed-day axis. Project-recovery's orange path visibly breaks between day 90 and day 150, and the day-120 gap stays empty. “Newer record ends” points to the actual endpoint. The source explains that the displayed key values are each series' last observation, so their differing horizons are not silently presented as same-date values. Connecting supplied observations is a visual path; it does not create new observations. Original calendar anchors stay in the preceding scene, while the comparison uses elapsed time.

### C03: exact product attribution with separate interaction

The transform uses `(a1−a0)b0 + (b1−b0)a0 + (a1−a0)(b1−b0)` and keeps the interaction as its own row. Additive amounts are separate. It rejects nonpositive starting factors and negative ending factors. No interaction is silently allocated to either factor.

- Earnings/multiple: 10×20 = 200; 11×18 = 198; unreinvested cash +4 gives 202. Effects are +20, −20, −2 and +4 in value units, or +10, −10, −1 and +2 percentage points of opening value. They sum to the displayed +1% net change.
- Volume/price: 100×50 = 5,000; 120×45 = 5,400. Effects are +1,000, −500 and −100, or +20, −10 and −2 percentage points. They sum to +8%.

Factor units, starting/ending inputs and result formulas are readable before the bridge. The share source explicitly states one hypothetical share, cash held without reinvestment, no fees/tax, and no total-return-index claim. The revenue source states units times USD/unit and rejects causal interpretation. Bridge component labels use `pp`, while baseline/net change use `%`, consistent with the on-screen qualification. Zero baseline has no filled rectangle.

### C16: supplied changes versus unexplained remainder

The observed closing amount remains an independent input. The residual is the observed close minus the supplied explanation, not an inferred transaction:

- Assets: 120 +40 −25 −8 = 127 explained; observed close 132 leaves +5 unexplained. Total observed change is +12 USD million.
- Inventory: 80 +35 −50 −5 = 60 explained; observed count 58 leaves −2 unexplained. Total observed change is −22 units.

Both encoded residuals are visibly separate violet rows and retain their signs. Neither is renamed as a flow, loss or valuation effect. The inventory footnote says the shortfall has no assigned cause. Opening/closing amounts and contributions are visually distinct, and the row-order qualification prevents interpreting arithmetic ordering as transaction chronology.

Across all twelve audit cases, reviewer-run independent checks passed 110 assertions for original-input normalization, elapsed dates, missingness, attribution and reconciliation. These checks use the supplied fixtures, not invented financial or operational data.

## Native proportions and encoded geometry

For each nonzero bridge row, reviewer-run checks compared actual compiled native rectangles with the declared source-bound audit: width equals absolute amount divided by domain span, times plotting width; x begins at the lesser mapped endpoint; all row heights match; and rectangle area has the same amount ratio because height is constant. Opening/closing totals begin at zero, while changes float between cumulative levels. Zero amounts have no filled rectangle. The rows use opacity fade, not moving quantitative endpoints. All 214 width/height/area/endpoint/fade and zero-mark checks passed across the eight bridge specimens.

Read the independent pixel-check implementation and its current twelve-case report in `build/encoded-proportions.json`. It reports:

- 8,760 decoded frames and 160 original-input/native mapping checks.
- 29,820 encoded rectangle-edge probes, including 344 during fades.
- 11,226 visible point probes and 3,062 reveal-front probes.
- 2,036 future-column and 782 missing-column probes.
- Zero failures; 3,112 faint, small or occluded samples excluded.

The encoded audit width is 720 pixels, with 3-pixel point and 2.5-pixel edge tolerances. It probes quantitative scenes, excludes their first/last half-second, skips rectangles under 4 pixels or too faint to distinguish, and skips overlapping points/fronts. All frames are decoded, but this is bounded edge/point evidence rather than a full visible-area pixel census. The native equal-thickness area calculation is exact within floating-point tolerance; do not describe the encoded audit as exhaustive pixel-area proof. The reviewer inspected the checker and results rather than rerunning its full decode pass.

## Visual craft and review limits

The six cases perform distinct explanatory work: historical alignment, product interaction and stock reconciliation each have two different subjects and assumptions. The cuts move between a stated calculation and its corresponding picture. At 360 pixels, native titles, units, labels, signed values, qualifiers and source text are readable in both formats. Landscape is compact but does not overlap; portrait uses its own expanded geometry. The small residual and net-change bars remain small as the quantities require, with a separate numeric column preserving their exact values. Enlarging those bars for emphasis would break the scale.

The long settled holds are consistent with the declared silent review specimens. This review does not establish narrated-film pacing or continuous visual smoothness. The five boundaries that matter before promotion/reuse are: complete an observed playback pass; retain original units and dated positive anchors; recompute interaction and residuals after input changes; preserve missingness and older-only history without forecasting; and separately compose/review new aspect ratios or materially denser inputs. Keep prototype status while those broader requirements are unverified.
