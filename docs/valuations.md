# Native valuation sensitivities

`valuationGrid` in `fframes/valuation-data.mjs` computes explicit annual growing cash-flow cases. `valuationScene` in `fframes/valuations.mjs` prepares a flat native heatmap and a controlled cross-section using the same cells.

```js
import { valuationScene } from '../fframes/valuations.mjs';
const scene = valuationScene({
  title: 'Fictional payment model', source: 'Fictional assumptions.',
  asOf: '2026-09-30', unit: 'USD', cashFlowNow: 4, initialOutlay: 0,
  timing: 'annual-end', terminal: { kind: 'growing-perpetuity' },
  growthRates: [0, 2, 4], discountRates: [2, 4, 6, 8, 10], rateDecimals: 0,
  selected: { growth: 2, discount: 6 }, slice: 'discount',
  scale: { min: 0, max: 250, ticks: [0, 125, 250], decimals: 2 },
}, { width: 1080, height: 1920, id: 'assumptions', view: 'grid', reveal: true });
// Use scene.props on a canvas beat; retain storyboard.sources.
```

`cashFlowNow` is the annual time-zero basis, not a payment received at time zero. First future cash flow is C0 × (1+g). All future payments occur at year end. Growth and discount inputs are effective annual percentages. `initialOutlay` occurs at time zero and is subtracted once. The unit applies consistently to the basis, outlay and resulting net present value.

Two explicit rules are supported. `{kind:'none', periods:N}` sums N discounted end-year payments with no terminal receipt. Each nominal and discounted term is retained. `{kind:'growing-perpetuity'}` uses C0 × (1+g)/(r−g). It requires r>g; all other cells retain null and a reason, never zero or a clipped value. This declared domain rule also applies to a zero-flow input rather than extending the model with a separate degenerate-stream rule.

The finite calculation uses C0 × ((1+g)/(1+r))^t for each discounted term and compensated summation. Equal growth and discount therefore preserve the exact constant discounted payment. Finite horizons allow discount at or below growth. Negative cash-flow bases and negative values remain signed. There is no tax, inflation, leverage, default, reinvestment, probability or uncertainty model. These sensitivities are not market prices, forecasts or investment recommendations. Independently implemented method provenance is retained in [SOURCES.md](../examples/library-kits/valuation-studies/SOURCES.md).

The bounded contract requires 2–7 strictly increasing rates per dimension within −90% to 100%, explicit rate precision of 0–6 decimals, a declared value scale and exact ticks. A finite horizon contains 1–120 payments. Amounts are bounded by 1e12; nonzero starting flows must have magnitude at least 1e-9. Sparse arrays, unsupported properties, false tick precision, arithmetic outside the supported range and values outside the authored scale fail. Nothing is clipped or silently discarded. Signed scales label zero.

Native cell boundaries lie halfway between neighboring numeric rate coordinates, with a half-step extension at each outer edge. This preserves unequal rate spacing. Fills represent sampled cases, not a continuous interpolated surface or probability area. Native numbers are centered within their rectangles; rate ticks remain at their true coordinates. Color uses zero as its neutral reference, with pale orange/blue for negative/positive value and gray for undefined. Values remain visible numerically; color is not a good/bad judgment.

The selected row or column and cell are outlined. `view:'slice'` uses the same evaluated cells, changes only the declared varying dimension and retains every other assumption. Invalid cases break the line. Segments are visibly labeled guides: their intermediate heights are linear connections, not additional formula evaluations. A synchronized numeric-x reveal draws those guides and marks the supplied cases. Both views retain the model, source, units, outlay, timing and fixed assumption.

Crowded rate labels, y ticks and grid cells are rejected for the requested frame size. Value-axis ticks omit redundant decimal zeros without rounding their values; cell and selected values use the declared precision. New copy, scales, data density or units still require native review. The [valuation studies](../examples/library-kits/valuation-studies/README.md) retain two fictional subjects in landscape and vertical. Other formats, two-stage terminal models, subjective continuous playback and final master acceptance remain open; this is a prototype.
