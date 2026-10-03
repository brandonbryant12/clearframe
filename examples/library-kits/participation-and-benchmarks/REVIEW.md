# Independent review: participation and benchmarks

## Verdict and actionable findings

**Prototype; no remaining material findings in the eight current specimens.** All three findings raised during this review are resolved in the final encoded outputs. This review covers the four original fictional cases in landscape and vertical only. **Continuous playback has not been observed.** Sampled frames, native geometry and encoded probes do not establish a finished-film playback verdict or approval for additional formats/data sets.

### Resolved findings

1. **Completion size needed an independent definition.** The initial Team D combined a 92% on-time completion rate with zero “completed cases” for the same period, leaving the apparent metric denominator inconsistent. Size is now explicitly “Open cases at period end,” and the input scene explains its independent basis. An observed period rate can coexist with zero cases still open at the end. Confirmed at 3s/9.9s and in the branch area heading in both formats. The author also clarified the price case as end-period holdings in a separate sample portfolio: zero means not held, rather than a fund with no assets. The observed fund return and separate zero holding are now unambiguous.
2. **Landscape last-row size text collided with the source block.** In the initial C08 compositions, “450 m USD” / “0 cases” overlapped the first source line around y=155–162 in the 360-pixel view. The largest price circle also nearly touched that line. Final branches put label and signed difference together on the left, size on the right, and reserve space below the plot. Inspected at 13s and 23.9s in both final formats: rows, circle, values and footnote are clearly separated. The author reported that an intermediate attempt also failed native inter-row checks; that discarded attempt is not final evidence and was not independently reviewed here.
3. **Count legend numbers were visually attached to the next category.** The initial right-aligned numbers read like “2 Other” and “10 Missing,” or “6 Other” and “4 Missing,” despite belonging to the preceding category. Final labels are grouped explicitly (“Meets: 2,” “Other: 10,” “Missing: 0,” and corresponding service values). Confirmed at 3s and 9.9s in all four C05 outputs. These grouped labels and the count summary arrive after the tiles settle.

Eight historical issue screenshots are preserved in `evidence/independent-review/before-fixes/`; they must not be mistaken for final delivery frames. No further structural change or renderer fix is requested for these fixtures.

## Evidence and exact artifact identity

Reviewed `DIRECTION.md`, original `inputs.json`, `audit.json`, `build.mjs`, `source/scenes.mjs`, `summarizeMembership` and `benchmarkDifferences` in `engine/lib/data-transforms.mjs`, the current native jobs, `verify.mjs`, `check-encoded.py`, and current receipts/reports. The audit input hash matches:

`b26b5f5c498b1850a20bc97f6c12bc0fa6a544422d608c3cbf797c0aa4e76ddc`

All eight video receipts match their current storyboard SHA-256. Each encoded geometry report also matches that storyboard hash and the exact pipeline ID. The current check/QA/seek records have no errors/warnings, zero detected pops and equal sequential/shuffled frame hashes. Final runs under `specimens/<variant>/build/pipeline/`:

| Variant | Run |
| --- | --- |
| narrow-leadership-landscape | `2026-10-03T04-02-56-467Z-333de6a5` |
| narrow-leadership-vertical | `2026-10-03T04-03-04-669Z-37d00365` |
| relative-completion-landscape | `2026-10-03T04-06-53-495Z-da505ce8` |
| relative-completion-vertical | `2026-10-03T04-07-02-166Z-4ef2f245` |
| relative-price-landscape | `2026-10-03T04-07-10-118Z-d9ec020d` |
| relative-price-vertical | `2026-10-03T04-07-18-559Z-757c5d82` |
| service-health-landscape | `2026-10-03T04-07-26-505Z-839b687e` |
| service-health-vertical | `2026-10-03T04-07-34-252Z-84aed0e3` |

Independently decoded and visually inspected seven actual encoded frames per variant at 360-pixel width: 1.2, 3, 9.9, 10.03, 10.65 and 13 seconds, plus 21.9s for C05 or 23.9s for C08. These 56 final images are retained in `evidence/independent-review/<variant>/`. They cover early arrivals, settled input/count scenes, both sides of the 10s cut, early second-scene marks, settled data and final holds. Requested sample times select the corresponding available video frame. Superseded or stale source hashes were excluded from final review.

## Independent original-input mathematics

### C05: full membership, two denominators

The adapter validates real membership/metric dates, finite values and nonnegative known weights, unique members and a positive total weight. Missing metrics remain a separate state; the count denominator is full membership and the weight denominator is total supplied weight. It does not discard missing observations, infer their condition, calculate a weighted mean, or change weights using later metrics.

- **Narrow leadership:** membership is 12, dated 2026-09-01; metrics are dated 2026-09-30. Only A and B have period price return strictly above zero. E's zero return is correctly “Other,” not positive. Counts are 2/10/0, with qualifying count share 2/12 = 16.666…%, displayed as 16.67%. Opening weights are 65/35/0 out of 100, so qualifying weight share is 65%. These are count and membership-weight shares, not a portfolio return calculation.
- **Service health:** the inclusive threshold is uptime ≥99.9%; C and D at exactly 99.9 qualify. A–F give six qualifying services, G–J give four other observed services, and K/L are missing. Counts are 6/4/2 out of 12; weights are 84/14/2 out of 100. Observed-only totals would be 10 members and 98 weight points, but neither replaces the full denominators. Thus the displayed qualifying shares are 50% by count and 84% by weight, not 60% or 84/98.

Both final C05 formats show twelve labeled, equal-area tiles after settlement, with the two service missing tiles visibly violet. The weight scene keeps that missing group as a narrow 2% violet segment. The narrow-leadership zero missing share has no filled segment. Categories use fixed colors, not a magnitude gradient. Membership, condition and weighting basis remain readable on screen; raw price returns explicitly exclude income in the retained fixture basis.

### C08: signed difference and a separate size measure

`benchmarkDifferences` computes metric minus benchmark in the metric's original units, preserving null differences for missing metrics and rejecting negative size. These percentage metrics therefore produce percentage-point differences, never metric/benchmark ratios or total-return indices.

- **Relative price:** benchmark 4%; returns 8%, 1%, 4% and −2% give +4, −3, 0 and −6 pp. Separate sample-portfolio holdings are 50, 200, 0 and 450 million USD at period end. Positive circle areas follow 1:4:9, hence radii 1:2:3. Fund C's zero holding has no filled circle; its observed 0 pp endpoint is a small cross.
- **Relative completion:** target 92%; observed rates 98%, 88%, missing and 92% give +6, −4, missing and 0 pp. Separate open-case stocks are 80, 20, 45 and 0. Team A/B areas follow 4:1, with radii 2:1. Team C retains the printed known size of 45 cases, but has no stem, circle or endpoint cross because its metric is missing. Team D has a genuine observed 0 pp endpoint with zero open cases and only a small cross.

The final diagrams explicitly label circle area and percentage-point position. Their fixed signed axis is −8 to +8; below/above color represents sign, not desirability. Missing and zero are visually different in both formats. All four input scenes preserve metric, benchmark, period, separate size and their fictional basis.

Reviewer-run checks against the current original inputs/audit passed 72 membership, threshold, denominator and benchmark-difference assertions. These checks do not establish the meaning of arbitrary replacement metrics; the explicit size-definition fix above remains part of the reusable contract.

## Native and encoded quantitative geometry

Reviewer-run checks on the actual compiled native jobs passed 120 assertions for equal tile dimensions, weighted segment length/area, fixed-height bars, absent zero segments, circle area ratios, signed x positions, fade-only entrances and zero/missing endpoint semantics. For nonzero circles, `r² / r_max² = size / maxSize`; the square root is applied to radius. The cross is an endpoint locator, not a minimum-area substitute for zero. Missing metric rows have no quantitative endpoint. Native geometry does not move endpoints or scale quantities to create an entrance.

The current eight-case encoded checker report records:

- 5,520 decoded frames.
- 48 equal-tile, 10 weighted-area, 10 circle-area, 40 position and 8 absence native checks.
- 30,672 rectangle-edge and 11,160 circle-chord probes; 718 probes occur during visible fades.
- 1,378 zero-marker and 782 missing-endpoint probes.
- Zero failures and zero additional faint/small exclusions after the timing filters.

The reviewer inspected the checker and matched every report's pipeline ID/storyboard hash to the current receipt; the full pixel decode was not rerun by the reviewer. The check uses 720-pixel decoded width and 2.5-pixel edge/chord tolerance. Native area/mapping tolerance is 1e−7. Scene first/last half-seconds and the faint beginning of each entrance are outside eligible pixel probes; very small/faint marks would also be excluded, and zero-marker checks begin after their fade. Native mappings establish rectangle/circle area ratios; encoded edges and chords corroborate visible geometry at bounded samples. **This is not an exhaustive encoded pixel-area census**, a proof of every possible future input or observed continuous playback. Row y positions are nonquantitative layout; their readback is distinct from the original-input verification of signed x and radius.

## Craft, joins and remaining boundaries

The cuts make one clear change of question: C05 moves from equal member counts to fixed opening weights; C08 moves from stated inputs to a signed comparison with independent size. Both sides of each cut are valid and the next phase retains its own relevant headings/units. Native type, data values, membership dates, source text, grouped legends and small-size explanations remain readable at 360 pixels. Portrait is separately composed, rather than a crop. The smallest holdings circle, the 2% missing-weight segment and the zero cross remain small as their quantities require; nearby numbers preserve precision without distorting them.

The staged count result avoids announcing a complete census while some tiles are still absent. All observed quantitative entrances retain fixed geometry; later holds support reading. The five boundaries before promotion or reuse are: record an observed continuous-playback pass; preserve full membership and missing denominators; keep percentage-point differences distinct from ratios; maintain independent size definitions and zero/missing semantics; and recheck source arithmetic plus native/encoded geometry after data or aspect-ratio changes. Keep prototype status until the separately required playback/final-quality review is complete.
