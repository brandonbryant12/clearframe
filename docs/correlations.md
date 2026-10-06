# Native correlation windows

`correlationMatrix` in `film/correlation-data.mjs` computes a descriptive Pearson matrix from supplied monthly simple returns. `correlationScene` in `film/correlations.mjs` makes an editable native matrix or a synchronized pair of return charts.

```js
import { correlationScene } from '../film/correlations.mjs';
const scene = correlationScene({
  plot, // Dated x, linear y with suffix '%', source/asOf, 2–4 series.
  method: 'pearson', frequency: 'monthly', returnType: 'simple-percent',
  window: { start: '2024-07-31', end: '2024-12-31' },
  minObservations: 4,
}, {
  width: 1080, height: 1920, id: 'second-window',
  selectedPair: ['alpha', 'beta'], view: 'matrix', reveal: false,
});
// Use scene.props on a canvas beat; retain a storyboard.sources entry.
```

Each supplied value is a simple return in percent for its labeled calendar month, not a price, balance, growth index or cumulative return. All series must use the same consecutive month-end grid with explicit nulls. Missing months, mismatched dates, values below −100%, unsupported methods/frequencies and an as-of date before the data are rejected. The plot contract bounds the total data to 240 observations. Input labels, domains, ticks and source remain authored and validated.

The window includes both endpoints and must name supplied month-end dates. Every pair uses only months where both values exist. No fill, carry-forward, smoothing, annualization or conversion from price levels occurs. `minObservations` is an integer of at least three; it is an authored display threshold, not a significance guarantee. The returned cell retains its full coefficient, count, included dates and missing dates. The return object preserves the full supplied plot and declared window/method/policy.

Pearson r is the centered cross-product divided by the product of the centered-vector lengths. Positive affine min/range normalization before centering protects tiny and large-offset inputs. Only floating-point roundoff just outside [−1,+1] is clamped. Too few pairs yields `insufficient-pairs`; a zero-variance member yields `zero-variance`. Both return null, including on the diagonal. A valid zero correlation remains numeric zero. No heuristic replaces constant data with a self-correlation of one.

The matrix uses one fixed −1/0/+1 color scale across all windows. Signs and native values carry the meaning; blue/orange mean positive/negative relation, not good/bad. Coefficients display to two decimals. Undefined cells are gray with an em dash; their pair counts and `few` or `flat` reason remain visible. `flat` means zero variance within that paired sample. The selected off-diagonal pair has an outline in both symmetric positions. Member order stays unchanged.

`view: 'pair'` shows the two original return histories in that window, on identical explicit percent and calendar-date domains. Both use the same elapsed-date drawing clock. Nulls disconnect line segments. Hollow points are observed values excluded from the selected correlation because their counterpart was missing; filled points were paired. Landscape places charts beside each other and portrait stacks them. Window changes use explicit cuts in the retained specimens, without invented intermediate coefficients.

Correlation does not establish causation, prediction or significance. Pairwise deletion can yield a matrix that is not positive semidefinite; do not treat this result as a validated portfolio covariance model. Other return conventions, frequencies, methods, statistical inference, arbitrary labels/layouts and continuous playback acceptance remain outside the reviewed prototype.

The two fictional three-member cases are reviewed independently in landscape and portrait. Four-member math coverage is distinct from visual acceptance of a four-member specimen.
