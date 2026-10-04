# Distribution charts

`canvas.props.distribution` shows how often outcomes landed in each range: calendar-year returns, monthly changes, wait times. Counting comes from [`fframes/distribution-data.mjs`](distributions.md) (explicit bins, left-closed edges, nulls excluded and disclosed); the layout shares the plot's frame and type.

```json
{
  "block": "canvas", "duration": 8, "camera": "none",
  "props": {
    "distribution": {
      "title": "How often a year ends in each range",
      "unit": "Calendar-year returns, 1990–2025",
      "observations": [-3, 30, 8, 10, 1, 37, 23, 33],
      "edges": [-40, -30, -20, -10, 0, 10, 20, 30, 40], "suffix": "%",
      "threshold": {"value": 0, "relation": "lt", "label": "Losing years"},
      "marker": {"value": 17, "label": "2025"},
      "source": "Illustrative data", "asOf": "2026-10-04"
    }
  }
}
```

- Bins are equal width (2–12). An observation outside the bins fails rather than being dropped; `null` is excluded and disclosed in the source line.
- Counts sit on the bars; there is no y axis to read. Bins wholly on the qualifying side of the threshold take `tone` (`negative`, default, or `highlight`).
- The threshold sentence (`label: count of n`) sits in the header with a dashed key; the dashed line marks the value on the chart.
- `marker` points at the bin holding one observation, such as the latest year.
- Bars grow left to right; the threshold and marker arrive after. A beat needs two seconds after they land.

Template beat: `return-distribution` in [`examples/finance-charts`](../examples/finance-charts/README.md). Tests: `node --test test/histogram.test.mjs`.
