# Ranked native small multiples

`rankSeries` in `fframes/multiple-data.mjs` orders two to four comparable series by their value on one explicit common date. `multipleScene` in `fframes/small-multiples.mjs` composes those records as equal-size native panels and can enlarge one named panel through a uniform transform. No new renderer or chart rasterization is involved.

```js
import { multipleScene } from '../fframes/small-multiples.mjs';
const scene = multipleScene({
  plot, // Existing plot contract: source, asOf, dated x, linear y, series.
  rankAt: '2024-06-30',
  direction: 'ascending',
}, {
  width: 1080, height: 1920,
  id: 'june-rank', subtitle: 'Full history; ranked on June 30',
  expandedId: null, reveal: true,
});
// Use scene.props on a native canvas beat, with a storyboard.sources entry.
```

All panels require the same explicit date grid, including null observations. The existing plot contract validates unique IDs/labels, source, dates, units, explicit domains/ticks and at most 240 total observations. This helper supports dated x and linear y; each series must have at least one observed value. It does not resample, interpolate missing values, choose domains, aggregate observations or infer which direction is desirable.

Ranks use the unrounded value on `rankAt`. Exact ties share a competition rank (1, 1, 3); their display order is stable by series ID. Missing values have no rank, appear last, and never use a carried-forward observation. All-missing ranking dates remain an unranked collection. Reordering the input array cannot change a tied display order. The output retains the complete original history and domains. A rank date is not a publication cutoff or information-vintage claim.

Rank-value labels add decimal places as needed, up to six; remaining rounding is explicitly marked `≈`. Axis tick formatting remains as declared. Month labels abbreviate only for a single-year domain, while the visible footer retains the full date range. Multiyear unit labels show the year span. Arbitrary new copy and extreme numeric labels need a fresh native layout and phone review.

`multipleScene` returns the model, layout, local plot rectangle, observation geometry and native canvas props. Equal plotting rectangles preserve the same pixels per unit in every compact panel. The optional shared reveal follows elapsed calendar days. Nulls break adjoining segments. Selection fades the other panels, then uniformly scales/translates the selected panel—including its axes, text and marks—between .6 and 2 seconds. The larger panel keeps the identical numeric and date domains. It has a different pixel density, visibly explained by the enlargement.

Each first shows the full January–June record ordered by January, then cuts to the same record ordered by June. Names and IDs stay consistent. A selected panel expands with no interpolated ranking or data values. The delivery example exposes tied leaders and a missing final member; the household example focuses on a negative flow rather than the highest-ranked series.

This is a C18 prototype. Independent scales, more than four panels, arbitrary format/layout combinations, continuous subjective playback and final master acceptance remain outside the retained evidence. The native source, encoded clips, exact receipts and independent review are retained. These silent specimens are reusable assets rather than narrated finished films.
