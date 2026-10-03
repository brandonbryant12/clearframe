# Distribution studies

Two original fictional cases, each in landscape and vertical. Every 64-second specimen first builds an explicit histogram, then keeps the full distribution visible while focusing on a supplied threshold. Both beats last 32 seconds for reading and review.

- **Monthly change:** equal-width count bins contain 23 observed signed values and two nulls. Ten observed changes are at most −25 dollars. Exact endpoint handling includes both −100 and +100.
- **Service delay:** unequal-width density bins contain 25 observed delays and one null. Seven delays exceed 35 minutes. The value exactly equal to 35 is excluded from that threshold. Bin area is observed share; height is density per minute.

These are fictional software/design specimens, not financial evidence or a probability forecast. Input provenance and the independently implemented NIST density formula are in [SOURCES.md](SOURCES.md). Original assets are MIT; existing engine font notices still apply. No paid or generated media is used.

## Rebuild and inspect

```sh
node examples/library-kits/distribution-studies/build.mjs
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node examples/library-kits/distribution-studies/verify.mjs
/Users/brandon/.local/bin/codex-heavy -- python3 examples/library-kits/distribution-studies/check-encoded.py
node examples/library-kits/distribution-studies/package.mjs
```

Run from the repository root with at least 20 GiB free. The verifier uses one native renderer with two encoder workers, checks shuffled seek order, retains compact artifacts, and removes only its own generated specimen build after verifying the copies. Do not run the packager until current independent review and full test evidence exist.

[Inputs](inputs.json), [computed model and geometry](audit.json), [composition](build.mjs), [native helper contract](../../../docs/distributions.md), [direction](DIRECTION.md), [independent review](REVIEW.md), [preview](preview.html) and [file manifest](kit.json) retain the editable source and evidence trail.

Bars start at zero. Count mode requires equal widths; density allows unequal widths. Each dot retains its exact x value, with vertical rows for separation only. The focus view outlines individual observations and gives the exact numerator/denominator instead of interpolating a shaded tail within a bin. Nulls stay in the source and explicit missing count. Native count labels remain readable at the threshold line.

Status: **prototype**. Independent arithmetic, bounded encoded probes and sampled phone frames do not establish subjective continuous playback or final master acceptance. More crowded observations, different text, square/4:5 and arbitrary new compositions require fresh review.
