# Auditable data transformations

`engine/lib/data-transforms.mjs` exports `DATA_MODEL_VERSION = 1` and five deterministic helpers. They retain unrounded values for drawing and expose the assumptions a composition must label. These are algebraic contracts, not forecasts, causal models or a published investment-index methodology.

## Observed-anchor rebasing

```js
rebaseSeries({
  observations: [{date: '2026-01-01', value: 80}, {date: '2026-01-31', value: 100}],
  baseDate: '2026-01-01', baseIndex: 100
})
```

Returns the original date/value, `elapsedDays` from the anchor and `index = value / baseValue × baseIndex`. The anchor must name an actual positive observation. Dates must be real UTC calendar dates in strictly increasing order. Null observations remain null; no date or value is interpolated. Dates before the anchor produce negative elapsed days. Ordinary values may be negative, so the caller must select an appropriate domain. Each rebased series needs its original unit, dated base and explicit index label. Equal elapsed time does not establish that two episodes will follow the same path.

## Two-factor decomposition

`decomposeProduct({first, second, additions})` takes factors with `id`, `label`, `start`, `end` and optional separately named additive amounts. Both factor starts must be positive; ends must be nonnegative. For factors a and b:

```
opening = a0 × b0
ending product = a1 × b1
change = (a1 − a0) × b0 + (b1 − b0) × a0
       + (a1 − a0) × (b1 − b0) + sum(additions)
```

The interaction stays explicit. Each part returns its amount and fraction of the opening product; multiply the fraction by 100 for percentage-point contributions. `changeFraction` is the combined relative change. `arithmeticDifference` exposes floating-point reconciliation error instead of assigning it to a factor. The factors, units and addition timing are caller assumptions. An earnings-times-multiple example with separate cash is a value bridge: cash is not reinvested and this is not a total-return index. S&P's [Index Mathematics Methodology](https://www.spglobal.com/spdji/en/methodology/article/index-mathematics-methodology/) is a reference for that distinction, not a claim that this helper implements its methodology.

## Stock reconciliation

`reconcileStock({opening, closing, components})` takes independently observed signed stocks and named signed changes. It returns the supplied net change, explained closing and `residual = closing − explainedClosing`. The output always contains a separately labeled **Unexplained** component, including when it is zero. Never silently rename a residual as subscriptions, valuation or transactions. The [IMF discussion of the GFSM framework](https://blog-pfm.imf.org/en/pfmblog/2014/08/purpose-of-the-government-finance-statistics-manual-2014-gfsm-2014-the-gfsm-2014) provides conceptual context for relating opening/closing stocks to transactions and other economic flows; these fictional examples are not government-finance statistics.

## Full-membership participation

`summarizeMembership({membershipDate, metricAsOf, condition, members})` preserves a dated member list. Each member has a unique ID, label, observed `value` or explicit `null`, and a nonnegative weight. The condition names `gt`, `gte`, `lt` or `lte` and a finite threshold. The total weight must be positive. The helper returns three categories—meets, other observed, and missing—with counts, weights and fractions of the **full** member count and total weight. It also reports observed count/weight separately. Missing members are never silently dropped, treated as failures or renormalized away. A zero-weight member still counts as one member. The helper does not compute a weighted mean or infer membership changes.

## Benchmark differences and separate size

`benchmarkDifferences({benchmark, items})` subtracts a named benchmark from each observed metric. An item has an ID, label, finite value or explicit null, and an optional nonnegative size. The result preserves `difference = value − benchmark`; missing values keep a null endpoint. Size does not affect that subtraction. When inputs are percentages, the result is percentage points, not a ratio or percent relative change. Size zero remains zero, and an omitted size returns null.

The [participation-and-benchmarks kit](../examples/library-kits/participation-and-benchmarks/README.md) uses equal member tiles, weighted segments and signed branches with circle areas. Counts and weights have separate denominators. Circle radius is proportional to the square root of the independent size; a zero-size cross is a locator, not a filled quantity. Define the size independently enough that a zero amount can coexist with the observed metric. A missing metric cannot acquire an endpoint from a known size. Both formats retain units, dates and full denominator/missingness labels.

## Bounds and drawing obligations

All numeric inputs and returned derived numbers must be finite and within ±10¹². Rebasing accepts 1–1,200 observations; a component list accepts at most 12 items. Membership summaries accept 1–100 members; benchmark comparisons accept 1–12 items. The example compositions support smaller, explicitly stated densities. Objects reject unknown keys. IDs are unique lowercase identifiers; product/reconciliation components reserve `interaction` and `residual`. Labels are 1–60 characters. Signed summation uses compensation, with no intermediate display rounding. Overflow and underflow that eliminate a positive product are rejected. These bounds are engineering limits, not a promise of financial decimal precision.

The [drivers-and-flows kit](../examples/library-kits/drivers-and-flows/README.md) gives each helper two substantive fictional subjects in landscape and vertical. Its horizontal bridges keep one shared zero-including domain and equal bar thickness, so both length and rectangle area preserve each signed amount's magnitude. Fades reveal full quantities; the animation never grows a partially sized bar while showing a completed value. Explicit missing data break lines. The native source and bounded encoded-pixel checks are retained separately from subjective motion review.

T02 remains partial. Rolling statistics, annualization, vintage alignment and a general financial return-index methodology are not implemented by this module.
