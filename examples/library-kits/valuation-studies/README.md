# Valuation studies

Two original fictional models, each in landscape and vertical. Every 72-second specimen shows a complete flat heatmap for 36 seconds, followed by a controlled slice for 36 seconds. The selected row or column and cell remain explicit.

- **Perpetual payments:** annual basis 4 USD, no upfront outlay, growth [0,2,4]% and discount [2,4,6,8,10]%. Three cells lie outside the declared perpetual domain. The selected value is 102 USD at 2% growth and 6% discount. The slice varies discount while growth stays 2%.
- **Finite project:** annual basis 100 USD, initial outlay 500 USD, five year-end payments and no terminal value. Growth [−10,0,10]% and discount [0,5,10,15,20]% produce negative, zero and positive values. The selected value is approximately −120.92 USD; the slice varies growth while discount stays 10%.

Inputs are assumptions for software/design validation, not observations, forecasts, probabilities or investment recommendations. The first future payment equals the annual basis times (1+growth). Native copy states the timing, outlay, fixed assumption and model rule. Exact source calculations precede display rounding. [SOURCES.md](SOURCES.md) links the independently implemented formulas and rights.

## Rebuild and inspect

```sh
node examples/library-kits/valuation-studies/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/valuation-studies/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/valuation-studies/check-encoded.py
node examples/library-kits/valuation-studies/package.mjs
```

Run from the repository root with at least 20 GiB free. One native renderer uses two encoder workers. The verifier checks shuffled native seeks, copies and hashes compact evidence, then prunes only its own generated specimen build. Package only after the current independent review and full test log exist.

[Inputs](inputs.json), [model and geometry](audit.json), [builder](build.mjs), [helper contract](../../../docs/valuations.md), [direction](DIRECTION.md), [independent review](REVIEW.md), [preview](preview.html) and [manifest](kit.json) retain the evidence trail. All figures and labels remain native and editable. No external dataset, generated media or paid calls are used.

Cell boundaries preserve numeric rate spacing; each fill is one sampled case. The cross-section reuses those exact cells. Connecting segments are labeled guides and never bridge invalid values. Zero is a valid numeric result; gray em dashes represent the separate perpetual domain restriction. Negative finite outcomes remain visible.

Status: **prototype**. Bounded source/calculation checks, encoded probes and sampled phone frames do not establish subjective continuous playback or final master acceptance. New copy/data density, square/4:5, two-stage terminal models and broader financial assumptions need further review.
