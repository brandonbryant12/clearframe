# Shared-scale native plots

`canvas.props.plot` turns explicit numeric inputs into native lines, observation markers, axes, a stable series key, final values and an optional annotation. It prepares editable geometry; text and quantities stay outside Blender. It is the workhorse for market history, real-versus-nominal, yields and any series over time; see the [finance chart kit](../examples/finance-charts/README.md).

```json
{
  "block": "canvas",
  "duration": 7,
  "camera": "none",
  "props": {
    "plot": {
      "title": "Two paths, one scale",
      "source": "Hypothetical illustration",
      "asOf": "2026-10-02",
      "x": {"type":"linear","label":"Years","domain":[0,10],"ticks":[0,5,10]},
      "y": {"type":"linear","label":"Balance · USD thousands","domain":[0,100],"ticks":[0,50,100]},
      "series": [
        {"id":"a","label":"Path A","values":[{"x":0,"y":10},{"x":5,"y":40},{"x":10,"y":90}]},
        {"id":"b","label":"Path B","values":[{"x":0,"y":10},{"x":2,"y":20},{"x":10,"y":60}]}
      ],
      "motion": {"at":0.5,"duration":3}
    }
  }
}
```

The storyboard must also contain a `sources` entry. The plot source and as-of date are always visible; the same data should back narration and any other displayed numbers.

## Quantities and missing observations

- `x.type`: `linear` or `date`; `y.type`: `linear` or `log`. Both axes require an increasing explicit domain and a unit-bearing label. Logarithmic y axes require positive values and display their scale type.
- Each axis has 2–6 ordered tick values including both domain endpoints. Numeric tick formatting uses `decimals` (0–6), `prefix` and `suffix`; decimals must preserve actual tick values. Date ticks use real `YYYY-MM-DD` dates, with `dateFormat: date|month|year`. Duplicate formatted tick labels fail.
- Dates represent UTC calendar days with real elapsed spacing. February is not stretched to the same width as January. Invalid dates and mixed numeric/date inputs fail.
- 1–4 uniquely identified series share the same scales. Values must be ordered, unique in x, finite, and inside both domains. At most 240 observations fit one picture; aggregate explicitly instead of silently sampling or clipping.
- A null `y` breaks the line. It is never turned into zero or bridged. Isolated observations retain visible markers. Omitted or nonfinite y values fail. An all-missing series fails instead of drawing false evidence.
- Lines end at actual observations. The stable series key identifies colors throughout the reveal and keeps final values separate from near-coincident endpoints. An early final observation is disclosed. For multiple units, use separate plots instead of a dual axis.

## Animation and annotation

`motion: "none"` shows a held picture. Otherwise every segment starts and ends according to its x coordinates on the same reveal clock. Native `drawEase: "linear"` ensures sampling density does not change the apparent passage of time. Other canvas drawings retain their existing easing. The piecewise-linear line describes interpolation between observations, not measured intermediate values.

Series names appear from the start. Final numeric values arrive only when the reveal completes. A beat must retain two seconds after value settlement. Plot sources use a larger three-line native footer, including missing observation dates where present. Annotation is optional: `{seriesId, x, label, dx, dy}` names an exact nonmissing observation; offsets are fractions of plotting width/height in `[-0.5,0.5]`. Its anchor must remain in the plot with enough room for text. Inspect placement to avoid collisions with data.

Do not combine plot shorthand with KPI, teaching, legacy chart, sketch, plates, worlds or depth cameras. Authored extra `elements` can add reviewed callouts. Generated element IDs are scoped to each beat so unrelated plots cannot accidentally morph into one another.

## Layout

The plot fills the frame's middle band: one-line title (two lines in vertical frames), a series key, the unit label, then the plot. Terminal values sit at the line ends and are pushed apart so close endpoints never collide. Long series (more than 16 observations) draw as a clean line with an end dot; short series keep a dot per observation. Tick labels that would print over each other fail at authoring time with the offending pair named, so choose fewer or wider ticks rather than discovering the collision in review.

- `bands: [{from, to, label?}]` (1–8, increasing, non-overlapping x ranges) shade regimes such as recessions or rate cycles behind the line.
- `area: true` adds a soft fill under the first series.

Tests: `node --test test/plots.test.mjs`. Check a layout with `node engine/cli.mjs still DIR --at SECONDS --draft` in every format you will ship.
