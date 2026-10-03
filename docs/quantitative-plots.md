# Shared-scale native plots

`canvas.props.plot` turns explicit numeric inputs into native lines, observation markers, axes, a stable series key, final values and an optional annotation. It prepares editable geometry; text and quantities stay outside Blender. Inventory scope: T01/C01 foundation. Status: prototype; three [rendered review](../examples/quantitative-plots/REVIEW.md) rounds resolved the sampled presentation defects, but continuous playback remains unverified. Do not promote these examples as accepted assets.

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

## Reproduction and evidence

```sh
node examples/quantitative-plots/build.mjs
node --test --test-concurrency=2 test/plots.test.mjs
node engine/cli.mjs critique examples/quantitative-plots/landscape
# After the disk/resource preflight:
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node engine/cli.mjs sheet examples/quantitative-plots/landscape --draft
```

The specimens include a retirement ledger and a monitoring example with irregular dates and missing data, in landscape and vertical layouts. Long-label/close-value and log/annotation stress clips are rendered in all four presets. [Direction and review brief](../examples/quantitative-plots/DIRECTION.md). [Retained evidence](../examples/quantitative-plots/README.md) separates source checks, encoded quantitative checks, sampled visual review and the outstanding continuous-playback review. Three/four-series layouts need their own visual review.
