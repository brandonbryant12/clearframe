# Dated series: price basis, growth and observed risk

`engine/lib/time-series.mjs` provides versioned, pure transformations of observed records. The [time-series studies kit](../examples/library-kits/time-series-studies/README.md) retains original fictional input, native sources, exact results and reviewed landscape/vertical drafts. These are prototypes; continuous subjective playback and final master acceptance remain pending.

```js
import {deflateSeries,growthSeries,rollingStatistics,drawdownSeries} from '../engine/lib/time-series.mjs';
const observations=[
  {date:'2024-01-01',value:100},
  {date:'2024-02-01',value:110},
  {date:'2024-03-01',value:118.8},
];
const growth=growthSeries({observations,frequency:'monthly',lag:1,annualize:false});
// Relative growth: null, 0.10, 0.08. Growth change: null, null, -0.02.
// Multiplying by 100 gives 10%, 8%, and -2 percentage points.
const risk=drawdownSeries({observations,frequency:'monthly'});
```

| Operation | Required basis | Result and limitations |
|---|---|---|
| `deflateSeries({observations,baseDate})` | Each record has `date`, `nominal`, `priceIndex`; base needs a positive observed index | Real = nominal / (current index / base index). Signed amounts preserved; missing nominal/index stays null. Base index can be any positive scale. Same-date matching is required; dates need not be equally spaced. |
| `growthSeries({observations,frequency,lag,annualize})` | Monthly/quarterly/annual schedule, positive observed base, nonnegative observed ending value; explicit boolean annualize | Endpoint change, optional compounded annualized pace, and difference between consecutive growth results. Interior nulls do not invalidate an explicitly selected longer lag. No smoothing, interpolation or forecast. |
| `rollingStatistics({observations,frequency,window})` | Complete fixed window of at least two supplied values | Mean and sample SD (n−1), count, window start and missing reason. No automatic annualization or denominator reduction. Callers must say whether values are levels, changes or returns. |
| `drawdownSeries({observations,frequency})` | Nonnegative levels, at least one positive observation | Known observed running peak, negative drawdown, trough, first observed recovery, open episodes and calendar duration. Missing levels remain null while the known peak is retained; unseen highs and lows are unknown. Equal peaks choose the most recent observation. |

All inputs use strict UTC ISO dates, increasing unique records, explicit nulls and finite bounded values. The first date anchors the period schedule: a month-end stays month-end; otherwise its day is preserved, clamped in short months, then restored. Omitted periods fail; add a null record. The calculation fixtures cover leap years, endpoint annualization, nonpositive bases, incomplete windows, recovery and open drawdowns. Annualized pace compounds the observed ratio by periods-per-year / lag; it is not a prediction.

The kit's rolling SD measures three consecutive monthly **percent changes** in percentage points, unannualized. It is not a risk-adjusted return or a risk-free benchmark comparison. C11's broader risk-adjusted branch remains open, as do vintage alignment and broader statistical transforms in T02.

## Native source placement and linked panels

`source/panels.mjs` in the kit reuses the shared dated-axis validation to compose three panels with one x scale, independently labelled y scales, linear synchronized reveals and exact null gaps. Underwater fill uses the same zero and drawdown boundary as the line and only fades in after the boundary settles. Geometry does not stretch during the reading hold. It is a source module for reuse, not a new renderer or a general dashboard layout engine.

A canvas can use `props.sourceElement: 'credit-id'` when an explicit source element fits its composition better than the automatic footer. It must name one top-level native text element, present at time zero with `enter:'none'`, size at least 28, opaque `ink` fill, and no visual effects or opacity reduction, transformations, keys or exits. A storyboard source record is required. It cannot combine with `source` or `sourceSize`. Native frame audits still check visible bounds, overlap and rendered font size. This names actual attribution text; it is not an exemption from showing a source.

Use ordinary `props.source` / `sourceSize` for the automatic footer. For either mode, reserve enough reading time and inspect the encoded phone frames. See the kit's [methodological sources](../examples/library-kits/time-series-studies/SOURCES.md), [direction](../examples/library-kits/time-series-studies/DIRECTION.md) and [review](../examples/library-kits/time-series-studies/REVIEW.md).
