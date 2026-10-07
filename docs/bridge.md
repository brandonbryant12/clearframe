# Metric bridges (waterfall charts)

`canvas.props.bridge` shows how a total moved from one value to another, driver by driver: revenue from one quarter to the next, a cost base between two years, revenue walked down to profit. It shares the line plot's and bar chart's frame, type and palette tokens, so a bridge cuts with `plot` and `bars` beats as one system.

```json
{
  "block": "canvas", "min": 8, "camera": "none",
  "vo": "New customers added six million, churn took three back, and revenue landed at fifty-four.",
  "props": {
    "bridge": {
      "title": "Revenue grew, even after churn",
      "unit": "Quarterly revenue, $ millions",
      "start": {"label": "Q1 revenue", "value": 48.2},
      "steps": [
        {"label": "New customers", "value": 6.1, "say": "customers"},
        {"label": "Expansion", "value": 2.4}, {"label": "Price", "value": 1.3},
        {"label": "Churn", "value": -3.0, "say": "churn"}, {"label": "Currency", "value": -0.9}
      ],
      "end": {"label": "Q2 revenue", "value": 54.1, "say": "landed"},
      "domain": [0, 60], "ticks": [0, 20, 40, 60], "prefix": "$", "decimals": 1,
      "source": "Company filings", "asOf": "2026-10-04"
    }
  }
}
```

The storyboard needs a `sources` entry, and the source line with its as-of date is always visible.

- **It must add up.** `start` plus every driver must equal `end` within display rounding (half the last shown decimal). A gap is refused with the amount to add as an explicit step (`{"label": "Other", "value": …}`); nothing is hidden as a residual. A driver of zero is refused (leave it out).
- **Honest baseline.** `domain` must include zero: the totals stand on zero and every bar is on one scale, so a driver's length is its share of the total. Small drivers stay small; when they are what the story is about, show them separately with `bars`.
- **Subtotals.** `{"label": "Gross profit", "total": true}` restates the running total as a full bar (a P&L walk). A `value` on a subtotal must match the running total.
- **Good news.** `good: "up"` (default) colours increases `accent` and decreases `negative`; `good: "down"` swaps them, for costs. Start and subtotals are `muted`; the end is `accent2`.
- **Orientation.** `auto` (default) draws columns on wide frames while every name fits in two lines of its column, and rows otherwise. Rows keep names beside the bars on wide frames and on their own line above each bar on tall frames, so bars use the full width. Long names switch a wide frame to rows instead of shrinking; `orientation: "vertical"` with names that would need three lines is refused.
- **Motion.** Columns arrive in reading order: the opening total, then each driver growing from the running total with the dashed connector into it, then the end. `say` cues a driver or the end to a word of the narration; uncued columns are placed in order around the cued ones (the opening total moves earlier if the first cue is early). Spoken cues out of order are refused. Without cues, `motion: {at, duration}` spreads the columns evenly (default from 0.5 s); a timed bridge needs two seconds after it settles, and `check` warns when the last total lands less than 1.5 s before the beat ends. `motion: "none"` holds the finished chart.
- **Room.** Up to ten drivers and subtotals. Columns need room for their values; a crowded frame is refused with a message that says what to change (fewer drivers, fewer decimals, rows).

Text widths for layout decisions are estimated; the renderer measures the real glyphs, `fit` caps each value and name at its room, and the native frame audit in `check` is what establishes that nothing overflows or collides. Run `check` on every shape you ship.

Template beats: `revenue-bridge` and `profit-walk` in [`examples/finance-charts`](../examples/finance-charts/README.md). Tests: `node --test test/bridge.test.mjs`.
