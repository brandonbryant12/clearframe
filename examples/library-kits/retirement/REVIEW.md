# Independent retirement-kit review

Reviewed by a separate reviewer against `DIRECTION.md`, `source/fixtures.mjs`, `source/recipes.mjs`, `source/marks.mjs`, the recorded `audit.json`, and the library's mathematical and visual acceptance bar. This reviewer did not author the implementation.

Earlier rounds are retained as evidence. **Round 2** resolves the content notes for its identified replacements; **Round 3** closes the remaining R08 timing note for its two newer runs.

## Round 1 — encoded specimens

**Verdict: retain prototype.** The inspected fixtures have correct arithmetic and coherent proportional geometry. The encoded pictures are readable at 360 pixels wide. Two material explanatory omissions remain: selected-period identification in reservoir scenes and the visible deflation mechanism in R08. Continuous real-time playback was not observed. Source and pixel checks cannot replace that outstanding motion review.

### Exact output scope

All nine recipes were reviewed with both fictional fixtures in landscape and vertical. Initial sheets came from `build/inspection.json`; the actual encoded revisions below are authoritative for findings. In particular, the actual R08 videos have decimal thousands and USD/month units, and actual R03/R09 videos say orange rather than gold. Those earlier sheet differences are not defects in these encoded revisions.

| Recipe | Landscape pipeline run | Vertical pipeline run |
|---|---|---|
| R01 | `2026-10-03T02-10-16-893Z-25679a3e` | `2026-10-03T02-10-32-647Z-933896e5` |
| R02 | `2026-10-03T02-10-47-194Z-0c0285f5` | `2026-10-03T02-10-53-720Z-67fab474` |
| R03 | `2026-10-03T02-11-00-105Z-92af5d38` | `2026-10-03T02-11-07-419Z-a1398942` |
| R04 | `2026-10-03T02-11-14-177Z-d74f752d` | `2026-10-03T02-11-28-872Z-2db95cea` |
| R05 | `2026-10-03T02-11-42-618Z-a6fbbb55` | `2026-10-03T02-11-57-722Z-778f4f0f` |
| R06 | `2026-10-03T02-12-11-718Z-9b811bc8` | `2026-10-03T02-12-18-890Z-dbd1157e` |
| R07 | `2026-10-03T02-12-25-815Z-ee355450` | `2026-10-03T02-12-36-043Z-e113133a` |
| R08 | `2026-10-03T02-12-45-066Z-af886d6f` | `2026-10-03T02-12-52-565Z-46ac9267` |
| R09 | `2026-10-03T02-12-59-602Z-491b17a7` | `2026-10-03T02-13-15-872Z-b0647f28` |

Each run is under `specimens/rNN-FORMAT/build/pipeline/`. Source revisions or later renders require a scoped follow-up; they do not retroactively alter this review.

### What was actually inspected

- All 18 initial contact sheets, including both fixtures and every beat.
- Independently decoded 360-pixel-wide MP4 frames at local beat time 5.0 seconds for all 54 beats in the 18 clips, and inspected every settled frame.
- Representative independently decoded entrances at local 0.57 seconds for every recipe and both formats. For R04 these were the first waterfall entrances; for R09, the final shortfall-stack entrances. R06 shows the first factor before the final result; R03/R09 show complete-width first-row geometry while later rows are still absent.
- Boundary strips for R01 in both formats, R04 landscape, R05 vertical, R06 landscape and R09 vertical. These show clean sampled cuts and retained final quantitative pictures, not continuous playback.
- Recorded native-check/QA results in the completed-render manifest: no reported native errors and zero reported pops. These are author-generated checks, not a fresh independent full suite.

Temporary decoded review aids are in `/tmp/retirement-independent-review/`; they are not durable release artifacts. No new heavy rendering was started. No implementation was modified.

### Independent math and proportion checks

A focused independent calculation reproduced 42 values from the fixtures without calling the kit's finance helpers. For the supplied end-period accounts it applied return to opening balance, percentage fees after return, then additions and funded withdrawals, retaining any unmet request. Separate direct calculations covered marginal match bands, ownership fractions, benefit factors, base-price deflation and reordered returns. All 42 comparisons matched recorded results within `1e-7` dollars.

An additional source-geometry check recomputed the expected lengths and areas of all 80 recorded rectangular marks across both formats: `value/domain × span` for stacks, `value/capacity × box height` for reservoirs, and `abs(to−from)/(domain maximum−minimum) × span` for waterfall segments. Areas equal those dimensions times the common thickness/width. All matched the recorded geometry. This verifies recorded source geometry; it is not an independent all-frame encoded-pixel audit.

| Recipe | Independently checked result and visual finding |
|---|---|
| R01 | Final balances $76,963.05796096 and $52,918.44096. The loss fixture preserves the −$6,200 year-2 loss, even with $4,000 added. Reservoir fill heights and areas share each case's capacity and baseline. |
| R02 | Single-tier match $1,800. Marginal-tier match $2,400 + $800 = $3,200, with $2,400 of employee contributions above the tiers earning zero match. The zero row has no colored amount fill. |
| R03 | Graded ownership $20,000/$26,000/$30,000; cliff ownership $12,000/$12,000/$18,000. Total rectangles remain equal in length within each case. Source copy distinguishes employee ownership, employer ownership, unvested amount, and withdrawal eligibility. |
| R04 | Ending gaps $10,236.29143470 and $7,097.00001815. Extra fees and the gain difference reconcile to each ending gap. Floating waterfall segments use their own exact heights; the small growth contribution is not given an artificial minimum size. |
| R05 | Depleted account pays $30,000 total and retains a $6,000 unfunded request. Funded case ends at $94,583.67744 after $25,000 paid. Zero balance has zero reservoir fill. The chart's unfunded-request trace is a per-period amount, not cumulative debt. |
| R06 | $80,000 × 30 × 1.5% × 90% = $32,400/year = $2,700/month. $70,000 × 20 × 2% × 100% = $28,000/year ≈ $2,333/month. Formula result is withheld during the first-factor entrance. |
| R07 | Supplied quotes and conditions are preserved as text with their distinct one-time/monthly bases. There is no shared proportional bar, fabricated lifetime total, or actuarial-equivalence claim. No independent valuation was attempted or implied. |
| R08 | Rising-price real values: $3,000, $2,857.142857, $2,727.272727, $2,500, $2,400 per month. Falling-price final real value: $2,659.574468 per month. Latest encoded keys correctly show $3.0k/$2.4k and $2.5k/$2.7k with monthly units. |
| R09 | First return order ends at $32,952 versus $49,046.25 with the same return multiset and $60,000 requested. Depletion case pays $49,625/$70,254 and retains $30,375/$9,746 unfunded. Both balance traces reaching zero does not erase those differences. Final request stacks use the same $80,000 domain. |

No arithmetic or source-proportion defect was found in these bounded checks. Lines interpolate annual observations; this review does not assert that intermediate screen positions are measured intra-year account balances.

### Material explanatory issues

1. **Identify the selected year in each reservoir scene.** R01 at 10–21 seconds and 31–42 seconds (both formats; decoded examples at 15 and 36 seconds) shows only “One period.” The preceding six-year chart ends near $77k/$53k, while the reservoir instead shows year 5 ending at $64,116 or year 2 ending at $28,800. Those figures are correct but the unmarked change of period can appear contradictory. Label the exact inspected year and maintain that cue through the reading hold. Apply the same explicit period identification to R05's year-3 and year-5 reservoir scenes at 10–21 and 31–42 seconds. **Classification: composition/context omission; no calculation change needed.**
2. **Show the price-index assumption and deflation operation in R08.** At 5 and 15 seconds in both formats, the picture shows nominal and real outputs and the Y0 base, but never shows the supplied price-index values or how they transform the payment. The operation the recipe is intended to explain is therefore hidden. Add a concise equation or explanatory beat: price index Y0=100; $3,000 × 100/125 = $2,400 per month in Y0 prices, and $2,500 × 100/94 ≈ $2,660 for the falling-price case. Retain the monthly units and no-forecast framing. **Classification: explanatory omission; the existing arithmetic is correct.**

### Smaller presentation improvements

- R01's “Two contributions” title never identifies the employee/employer split in the encoded picture; its reservoir only names the combined amount. At 15/36 seconds, add the $6,000+$3,000 or $3,000+$1,000 breakdown in a readable native line. This would make the stated mechanism explicit.
- R04's rate/path inputs remain in retained fixtures but are not visible in its source copy. At 5/25 seconds, disclose the first case's 5% return and the second case's supplied return path and $6,000 annual additions without shrinking the type. The comparison does correctly hold returns/additions equal between its two fee scenarios.
- R05's label “Unfunded request” could be more explicit as “This year's unfunded request.” Its current data is per period; it should never be presented as a cumulative shortfall without changing the series calculation.
- Tall formats have generous whitespace. This is not a defect by itself: the labels, sources, quote conditions and quantitative differences remain readable. Do not enlarge quantities by changing their relative geometry merely to fill the frame.

### Motion and acceptance boundary

The sampled entrances preserve fixed quantitative dimensions and introduce marks through visibility/opacity. Later rows may still be absent while their labels are present; this was treated as an authored reveal, not a zero-valued data state. The reviewed formula entrance does not show a final benefit before the factors. Sampled plot entrances keep the series identities and units visible while withholding terminal values.

**No continuous real-time playback was observed.** This is decoded-frame, source, arithmetic, and selected-boundary evidence. It does not establish every-frame proportions, subjective pacing, continuous temporal smoothness, or speech synchronization. These are silent reusable specimens, so a long reading hold is legitimate and a cinematic-film verdict is out of scope. Keep the lifecycle at prototype until the material explanatory notes and applicable motion requirements are resolved for the exact supported outputs.

## Round 2 — focused final content review

**Verdict: the two material explanatory omissions are resolved in the inspected replacements. No material calculation-copy, clipping, or phone-legibility defect was found in this focused pass. Retain prototype status: continuous real-time playback remains unverified.** This review does not promote the kit to accepted artwork.

### Replacement revisions

| Recipe | Landscape pipeline run | Vertical pipeline run |
|---|---|---|
| R01 | `2026-10-03T02-16-52-823Z-cad815c6` | `2026-10-03T02-17-07-491Z-dd72fb4f` |
| R04 | `2026-10-03T02-17-21-281Z-9f4a3cf7` | `2026-10-03T02-17-34-752Z-5c935bf9` |
| R05 | `2026-10-03T02-14-49-616Z-550fed7f` | `2026-10-03T02-15-04-197Z-b39c31b9` |
| R08 | `2026-10-03T02-15-18-277Z-7cef3cf2` | `2026-10-03T02-15-31-827Z-36c9786b` |

The other five recipes retain their Round 1 visual findings. R08 now lasts 40 seconds in each format, with a separate equation beat after each chart. R01/R05 remain 42 seconds and R04 remains 40 seconds.

### Focused evidence and resolution

Independently decoded the replacement MP4s to 360 pixels wide. Inspected R01/R05 reservoir frames at 15 and 36 seconds in both formats; all R04 and R08 beats at 5, 15, 25 and 35 seconds; and the first R08 equation entrance at 10.57 seconds in both formats. Read the changed native copy and its source inputs. Temporary decoded aids are under `/tmp/retirement-independent-review-final/`.

- **Selected reservoir periods: resolved.** R01 now says “Year 5 reconciles” and “Year 2 reconciles,” with the same year on each connector. R05 names year 3 and year 5 on its connectors. These labels make the relationship to the preceding full-path chart explicit. They remain readable at 360 pixels without obscuring the opening/closing labels or quantity geometry.
- **Employee/employer contribution identity: resolved.** At 15 seconds R01 names employee $6,000 plus employer $3,000; at 36 seconds it names $3,000 plus $1,000. Both sum to the respective existing additions line. The added line is readable in both formats and does not collide with the reservoir labels.
- **Fee assumptions: resolved.** R04 now states 5% annual return and no cashflows for the reserve case; the loss case states the annual return sequence −15/8/5/10/6/4% and $6,000 year-end additions. Fee timing and no-forecast status remain visible. The source fits at 360 pixels in both the trace and waterfall beats. The prior independent fee-gap arithmetic remains applicable; no quantity change was needed for this disclosure.
- **Deflation mechanism: resolved.** R08's new beats identify year 4, the Y0=100 base and current index 125 or 94, the general rule, substituted inputs, and a monthly result in Y0 dollars. A fresh direct calculation gives `3000 × 100 / 125 = 2400` and `2500 × 100 / 94 = 2659.574468…`, correctly displayed as approximately $2,400 and $2,660 per month. The second result agrees with the chart's coarser $2.7k label. At 15/35 seconds the full equation and units remain readable in both formats; portrait wraps the general rule cleanly.

### Remaining bounded notes

The new R08 equation cards show all components simultaneously at their entrance. This is mathematically truthful, but differs from the direction brief's stated temporal treatment that formula factors appear before the result (already implemented for R06). Treat this as a minor direction/pacing decision: either record the intended simultaneous R08 readout in `DIRECTION.md` or stage its result after the inputs. It does not reopen the resolved deflation-content issue.

The optional R05 wording improvement (“This year's unfunded request”) remains a clarity suggestion; the source still uses a per-period shortfall, and this review does not reinterpret it as cumulative debt.

An updated encoded-geometry checker was still running separately when this focused review was completed. This report does not claim its eventual results, a new independent all-frame pixel audit, or observed continuous playback. The successful first-round independent calculations and source-geometry checks remain bounded evidence. Keep the final lifecycle distinction explicit: **content revisions reviewed; continuous motion acceptance unverified; prototype retained.**

## Round 3 — R08 equation timing

**The minor staged-formula direction note is resolved in the sampled phases.** Independently decoded the first equation beat at local 1, 2 and 3 seconds (clip timestamps 11, 12 and 13 seconds) to 360 pixels wide in these final replacements:

- Landscape: `2026-10-03T02-20-39-961Z-0a7e5a79`.
- Vertical: `2026-10-03T02-20-53-783Z-30d755c3`.

At 11 seconds the price indices and general rule are visible, with neither the substituted numbers nor result present. At 12 seconds the substituted numbers are visible and the result remains absent. At 13 seconds the monthly result appears. Existing text keeps its location; both formats remain readable. This establishes the requested ordering in those representative encoded phases. It does not establish continuous playback or inspect every fade frame. Temporary decoded aids are under `/tmp/retirement-independent-review-timing/`.

No settled-math or unrelated review was repeated. The author separately reports 156/156 Node tests and 32,836 rectangle-edge checks across 12,420 decoded frames, including 464 checks during fades, with zero failures. These are reported engineering results, not newly rerun independent checks in this timing pass.

**Final bounded verdict: recorded material content notes and the R08 timing note are resolved; continuous real-time playback remains unverified; retain prototype status.**
