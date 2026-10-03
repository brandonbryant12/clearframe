# Provenance and assumptions

All cases, dates, values and native compositions are original fictional examples. No publisher chart imagery, market data, branding or proprietary code is included. C05 and C08 connect to the research inventory as reusable explanatory forms, not a claim of source-derived styling or endorsement.

The arithmetic is defined directly in [data-transforms.md](../../../docs/data-transforms.md): count share uses the full member count; weight share uses the sum of all nonnegative weights; each condition is applied to observed values only and missing values remain a third category. Signed difference subtracts the benchmark in the same unit. For percentage-valued inputs, that subtraction is in percentage points. Circle area is proportional to a separate nonnegative size, so its radius follows a square root. No financial index methodology or causal model is implemented.

The membership date is September 1, 2026 and the metric observation date September 30, 2026. The fund scenario uses fixed opening weight points and fictional period price returns, excluding income. The service scenario uses opening request-share points and measured uptime, with two missing observations. The separate branch cases use sample-portfolio holdings and end-period open cases as sizes; neither is the denominator of its period performance measure. Zero size is therefore compatible with an observed period metric.

The source SHA-256 in `audit.json`, per-video storyboard receipts and retained output hashes form the actual evidence chain. No external source is required to reproduce these fictional algebraic fixtures.
