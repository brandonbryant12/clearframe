# Native distributions and exact thresholds

`distribution` in `fframes/distribution-data.mjs` counts supplied observations into explicit bins. `distributionScene` in `fframes/distributions.mjs` prepares a native histogram and exact observation strip, with optional threshold focus.

```js
import { distributionScene } from '../fframes/distributions.mjs';
const scene = distributionScene({
  title: 'Sample changes', source: 'Fictional observations.',
  asOf: '2026-09-30', unit: 'dollars',
  observations: [-2, -1, 0, 1, 2, null],
  edges: [-2, 0, 2], mode: 'count',
  threshold: { value: 0, relation: 'gte' },
  y: { max: 4, ticks: [0, 2, 4], decimals: 0 },
}, { width: 1080, height: 1920, id: 'sample', focus: true });
// Use scene.props on a canvas beat; retain storyboard.sources.
```

The contract accepts 1–240 supplied finite numbers or explicit nulls, and 2–12 strictly increasing bins. At least one observed value is required. Numeric observations/edges are bounded to ±1e9; bin width must be at least 1e-9. Values outside the bin range are rejected rather than silently discarded. Bins contain the left edge and exclude the right; the final bin includes the right endpoint. The model retains every observation's original index, bin, threshold membership, and each bin's member indices.

`mode: 'count'` requires equal-width bins within relative tolerance 1e-12. Bar height is the count. `mode: 'density'` supports unequal widths; height is count / observed sample size / bin width. Its total area is one. Explicit y ticks start at zero and end at the authored maximum. All bars must fit. Declared decimal precision must represent each tick exactly. A normalized sample histogram does not establish the population distribution or a future probability.

The threshold must lie inside the supplied edge range. `gte`, `gt`, `lte` and `lt` compare each original numeric observation directly, including exact equality. The numerator counts qualifying observed values; the denominator excludes nulls and the missing count remains explicit. No estimate of within-bin uniformity or partial-bin area is used. Returned threshold members and full-precision sample fraction are auditable; the specimen displays the exact numerator and denominator.

Native bars use their real bin widths and a zero baseline. A linear scaleY reveal grows each bar about that baseline; labels appear only after settlement. Every original observed value is a dot on the same x domain. Deterministic collision packing changes only dot y, which carries no quantity. Both stages reserve clearance for selection outlines so the data does not move at the focus cut. The scene rejects insufficient strip room, bins below 12 native pixels and positive bars below one native pixel. It does not silently hide cramped quantitative geometry.

Focus retains the complete histogram, adds two segments of the exact threshold line clear of axis/strip labels, outlines qualifying dots and states the direct count. Native count labels have background clearance from the threshold stroke. There is no fitted bell curve, partial-bin shading, tail-area interpolation, weighted sample or prediction. All copy, bins, scales, observations, timing and source remain editable.

The [distribution studies](../examples/library-kits/distribution-studies/README.md) demonstrate equal-width signed monthly changes and unequal-width service delays in landscape and vertical. NIST's formula is linked in the [method provenance](../examples/library-kits/distribution-studies/SOURCES.md). Other aspect ratios, arbitrary copy/data density, subjective continuous playback and final master acceptance remain unreviewed. The library asset stays a prototype.
