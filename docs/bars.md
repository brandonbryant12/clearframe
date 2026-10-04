# Signed bar charts

`canvas.props.bars` draws an editorial bar chart: annual returns, contributions to return, flows in and out, any comparison of signed values. It shares the line plot's frame, type and palette tokens, so bar and line beats cut together as one system.

```json
{
  "block": "canvas", "duration": 7, "camera": "none",
  "props": {
    "bars": {
      "title": "Most years are good. Some are not.",
      "unit": "Calendar-year total return",
      "values": [{"label": "2021", "value": 29}, {"label": "2022", "value": -18}, {"label": "2023", "value": 26}],
      "domain": [-20, 40], "ticks": [-20, 0, 20, 40], "suffix": "%",
      "reference": {"value": 15.8, "label": "Average"},
      "source": "Illustrative data", "asOf": "2026-10-04"
    }
  }
}
```

The storyboard needs a `sources` entry, and the source line with its as-of date is always visible.

- **Honest length.** `domain` must include zero; every bar starts on the zero line, and height is proportional to value. Values outside the domain fail.
- **Colour.** `colors: "sign"` (default) gives positive values `accent` and negative values `negative`; `"single"` uses `accent` for all. `highlight: true` marks a bar in `accent2`.
- **Orientation.** `vertical` (2–24 bars) for time; `horizontal` (2–12) for ranked categories with long names.
- **Labels that fit.** Category labels thin to what fits; when bars are too narrow to label every value, only the maximum, minimum and highlighted bars carry values. Horizontal tick labels that would collide are dropped (zero and the ends first), and a negative value moves past the zero line rather than run into its category name.
- **Reference.** `reference: {value, label}` draws a dashed line (an average, a target) after the bars settle.
- **Motion.** Bars grow from zero in order over `motion.duration` (default 1.6 s from 0.5 s); values fade in as each bar lands. A beat needs two seconds after the last bar settles. `motion: "none"` holds the finished chart.

Template beats: [`examples/finance-charts`](../examples/finance-charts/README.md). Tests: `node --test test/bars.test.mjs`.
