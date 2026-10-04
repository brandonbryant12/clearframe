# Headline figures

`canvas.props.stat` puts one sourced number on screen: what it is, what it measures, and how it changed. It shares the plot's frame and type, so a figure can open a section and cut straight into the chart behind it.

```json
{
  "block": "canvas", "duration": 6, "camera": "none",
  "props": {
    "stat": {
      "kicker": "Inflation, last twelve months",
      "value": 3.1, "decimals": 1, "suffix": "%",
      "label": "Consumer prices rose more slowly than a year ago",
      "change": {"value": -0.6, "suffix": " pts", "context": "vs a year earlier", "good": "down"},
      "source": "Illustrative data", "asOf": "2026-10-04"
    }
  }
}
```

- The value counts up natively from zero over `motion.duration` (`count: false` fades it in instead). Money and large values use thousands separators; negative values use a true minus.
- `label` says what the number measures and over what period. Keep it to one or two lines.
- `change.good` decides the colour: `up` (returns, balances), `down` (inflation, fees, unemployment) or `neutral`. A zero change is grey.
- The storyboard needs a `sources` entry; the source line and as-of date are always visible. A beat needs two seconds after the change line lands.

Template beats: [`examples/finance-charts`](../examples/finance-charts/README.md). Tests: `node --test test/stat.test.mjs`.
