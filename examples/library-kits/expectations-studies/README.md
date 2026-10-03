# Expectations studies

Twelve native specimens separate forecast issue dates, remaining maturity and descriptive scenario ranges. Six original fictional cases have separate landscape and vertical layouts. C04 contains two 26-second information-cutoff views (52 seconds total); C06 and C12 contain a 20-second method view and a 26-second quantitative view (46 seconds total). Quantitative geometry settles by 4.95 seconds into each chart and holds for at least twenty seconds.

**Prototype.** Read `REVIEW.md` and `evidence/summary.json` for retained evidence. These silent draft examples are not narrated final films. Subjective continuous playback, audio/accessibility decisions and final master acceptance remain unverified. No real forecasts, official yield quotations or calibrated probabilities are depicted.

Open `preview.html`. To adapt the inputs, run from the repository root:

```sh
node examples/library-kits/expectations-studies/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/expectations-studies/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/expectations-studies/check-encoded.py
node examples/library-kits/expectations-studies/package.mjs
```

Use the equivalent resource gate elsewhere. Retain at least 20 GiB free before expensive work. The verifier runs one specimen at a time, copies and hashes compact evidence, then prunes only that specimen's generated build directory. Packaging also requires fresh independent review and regression evidence. Regeneration can require new domains, ticks, labels and reading time.

`engine/lib/expectations.mjs` exports publication-aware `vintageSnapshot`, supplied-quote `maturityCurves`, and descriptive `scenarioEnvelope`. `source/scene.mjs` composes native chart geometry, fixed-scale comparisons, explicit attribution and missing-data band gaps. Text, axes and marks remain editable; the MP4 is a retained preview.

The vintage fixture deliberately contains an unpublished future forecast that must not appear in either cutoff view. Actual revisions are selected by availability date; missing forecasts break their lines. Maturity is numeric months divided by twelve, never an equally spaced category or a future observation date. Connecting quote segments are visual guides; fitted curves and forward-rate derivation remain open.

Scenario paths share the last observed origin and an explicit date grid. The range case shows supplied min/max; the quantile case uses empirical type-7 25th/75th percentiles and median. Any missing path invalidates the entire band and median at that date. These equal-weight summaries have no confidence, coverage or likelihood interpretation. The band begins at the observed/scenario divider and cannot cross a missing observation.

`audit.json` binds unrounded outputs to the input hash. `check-encoded.py` independently recomputes chronology, maturity normalization and exact-rational rank interpolation, checks native coordinates, then samples encoded points, gaps, band interiors and exact reveal fronts. It retains explicit foreground-occlusion exclusions. One compressed gray front uses a palette-distance check at the same three-pixel position, only where other native geometry is more than six pixels away; the actual RGB and clearance are retained. This is bounded evidence, not an exhaustive pixel census. Shuffled native seeks separately check sampled frame determinism. `kit.json` binds every retained file. See `SOURCES.md` for primary methods and rights. Square and 4:5 remain uncomposed and unreviewed.
