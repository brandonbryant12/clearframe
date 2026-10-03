# Independent expectations contract review

The current contract source has no remaining material finding in the reviewed scope. The retained `data-review.mjs` passes 1,204 independent assertions and binds the tested source SHA in `data-review.json`.

The checks cover cutoff inclusion, out-of-order release records, withdrawal without resurrection, zero rereleases, and invariance after removing unavailable future records. They also check nonuniform maturity spacing, all-null snapshots, independent type-7 quantiles across 2–25 scenarios, equal weights, and missing dates that suppress the band without changing the supplied scenario denominator.

Two numeric findings were fixed before this snapshot:

- Positive distinct month tenors could divide into zero or identical normalized years. The contract now rejects normalized underflow and collapse. Both reported counterexamples are retained.
- Weighted endpoint interpolation could turn equal subnormal values into zero or round equal bounded values outside the permitted range. Difference interpolation with rank clamping now preserves equal values exactly. Twenty-four endpoint assertions are retained.

The focused repository expectations suite passed 3/3 in the earlier source review. The retained independent run is 1,178 general assertions plus 26 regression assertions. This is source/math evidence, not an exhaustive proof of every floating-point input.

The first capacity-vintages landscape and portrait candidates were also inspected through 20 actual MP4-decoded 360-pixel-wide images at 0.1, 1.2, 3, 5, 25.9, 26.033333, 27.2, 29, 31 and 51.9 seconds. Both source and video hashes match the receipts. The sampled states correctly retain the forecast vintages and target-date axes while the cutoff changes from May 1 to August 1; the March actual revises from 98 to 101 and the June actual 108 becomes available. No material visual defect was found in this pair. Bindings are in `artifact-checks.json`.

The remaining candidates and final encoded evidence have now been reviewed; see the kit REVIEW.md and artifact-checks.json for the complete twelve-candidate prototype verdict. No continuous playback or browser/server acceptance was performed.
