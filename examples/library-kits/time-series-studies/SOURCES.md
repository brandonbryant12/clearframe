# Sources, calculations and rights

All trajectories and labels in `inputs.json` are original fictional teaching records, authored for this kit. They are neither historical evidence nor forecasts. The kit contains no imported market, pay or household dataset. Figures on screen come from these records through `engine/lib/time-series.mjs` version 1; the unrounded results and native point coordinates are retained in `audit.json`.

Primary methodological references, accessed 2026-10-03:

- [BLS: Income and inflation](https://www.bls.gov/cpi/factsheets/income.htm) and [purchasing power and constant dollars](https://www.bls.gov/cpi/factsheets/purchasing-power-constant-dollars.htm): divide nominal amounts by a current-to-base price-index ratio. Our price indexes are fictional, not CPI. Currency units in C09 are thousands of dollars; real amounts retain the supplied base year's price basis.
- [BEA: Calculating quarterly growth rates](https://www.bea.gov/help/faq/122) and [NIPA Handbook, chapter 4](https://www.bea.gov/resources/methodologies/nipa-handbook/pdf/chapter-04.pdf): compound a period's level ratio when explicitly annualizing. The API supports this operation. The kit shows unannualized one-month growth, so it makes no annual pace claim.
- [NIST: Sample standard deviation](https://www.itl.nist.gov/div898/handbook/prc/section2/prc23.htm): sample SD uses the n−1 denominator. The kit uses three consecutive monthly percentage changes, requiring all three; values are percentage points, with no annualization or risk-model claim.

Definitions and assumptions:

- Relative growth is ending/base − 1. Change in growth subtracts consecutive growth fractions; multiplying by 100 expresses percentage points. It is a discrete change, not a continuous second derivative.
- Monthly, quarterly and annual series require an explicit record at each scheduled date. The first date anchors the schedule. If it is month-end, all dates are month-end; otherwise its day is preserved or clamped to the shorter month's final day, then restored. These fixtures use month-start dates. Missing observations are `null`, never omitted or interpolated. Lagged growth needs observed endpoints; an interior null does not invalidate an explicitly chosen longer endpoint lag.
- Drawdown is observed level / highest level observed so far − 1. Levels must be nonnegative and some level positive. Equal peaks choose the most recent observed date. Recovery is first subsequent observed level at or above that peak. Unknown intra-period or missing-date highs/lows remain unknown. Calendar duration measures dates, not trading sessions or time below a continuously monitored peak.
- The orange observed-peak line may remain present across a missing blue level. This retains known history; it does not impute the missing level or an unseen peak.
- The rolling sample SD is variation of monthly **percent changes**, not variation of raw levels, and not annualized volatility. A missing level can invalidate two adjacent returns and multiple rolling windows. No denominator shrinks around a gap.

Original source, fixtures, geometry and reports: MIT. No GitHub artwork or trajectory copied. Native fonts retain the repository's bundled OFL notices. No AI-generated images, voice, music or paid media calls. Native renderer and codec licensing remain as documented by ClearFrame.
