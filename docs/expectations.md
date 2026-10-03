# Expectations and information dates

`engine/lib/expectations.mjs` prepares auditable native chart inputs. The [expectations studies kit](../examples/library-kits/expectations-studies/README.md) retains original fictional fixtures, unrounded calculations, twelve landscape/vertical clips and independent review. Its lifecycle is prototype.

## Available information

`vintageSnapshot({asOf, vintages, releases})` distinguishes the forecast issue date, target date and actual release date. A vintage contains `{id, issuedAt, values: [{targetDate, value}]}`. An actual release contains `{targetDate, releasedAt, value}`. Dates are strict UTC calendar dates. A forecast cannot precede its issue date; an actual cannot be released before its observation date.

The snapshot includes issues and actual releases on or before the inclusive cutoff. It selects the latest available revision for each target. A null revision withdraws a value instead of reviving an older one. Unreleased values stay null, and hidden future records cannot introduce target dates. Issue IDs and dates remain attached to forecast lines; changing information states does not interpolate a fictitious intermediate forecast.

## Remaining maturity

`maturityCurves({tenors, snapshots, kind, unit})` accepts increasing `{months, label}` tenors and increasing dated `{date, values}` quote snapshots, with null placeholders. `kind` is `par`, `spot` or `quoted`; `unit` must be `percent-per-year`. The helper positions each supplied tenor at `months / 12` years and rejects normalized underflow or duplicate positions. Negative quotes remain signed.

Maturity is not a future observation date. The helper does not fit yields, bootstrap discount factors or derive implied forwards. Native connecting segments are explicitly labelled visual guides. C06 remains partial until those additional models have their own assumptions and validation.

## Supplied scenario envelopes

`scenarioEnvelope({history, scenarios, band})` requires a non-null last historical origin, two or more named paths beginning exactly at that origin, and the same increasing date grid in every path. Each path has `{id, label, values: [{date, value}]}`. Weights are equal and descriptive.

A `{kind: 'range'}` band uses min/max. A `{kind: 'quantile', lower, upper}` band uses empirical type 7: sort n values, compute zero-based rank `(n - 1) * p`, then interpolate adjacent ranks. The median uses the same convention. Quantile bounds satisfy `0 <= lower < upper <= 1`. Any null path value makes all summaries null for that date; the denominator never shrinks. Native fill joins only consecutive complete dates, with no fill before the origin or across gaps.

These are summaries of supplied scenarios, not probabilities or confidence intervals. Finite input values are bounded to ±10^12; arrays and dates are validated. The kit's Python checker independently verifies its calculations and native/encoded geometry, while a separate reviewer exercises chronology and numerical edge cases. Sampled evidence does not establish continuous subjective playback or final master acceptance.
