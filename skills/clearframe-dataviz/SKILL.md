---
name: clearframe-dataviz
description: Choose, choreograph and honestly animate numbers and charts in ClearFrame videos — which form for which question (bars, lines, waffle/unit charts, meters, donuts, milestones, steps), the build order that matches narration, honesty rules (baselines, scales, units, as-of dates), number formatting, and binding figures to data. Use whenever a video shows a number, a comparison, a trend, a probability or a process.
---

# Numbers and charts in motion

A chart in a video is not a chart on a page. The viewer can't pause, re-read or hover, so every chart must answer **one question**, reveal it **in the order it's spoken**, and **point** at the answer.

## Pick the form

| Question | Form | Kit |
|---|---|---|
| How big is this one number? | Hero number + counter | `kit.counter`, `kit.reveal` |
| What share / what chance? | **Unit (waffle) chart**: "7 in 10" is countable, while 70% is abstract | `kit.waffle` |
| One proportion, compact | Meter bar or single donut | `kit.meter`, `kit.donut` |
| Compare a few values | Bars. Horizontal when labels are long; sorted unless order means something | `kit.bars` |
| Change over time | Line that draws itself; the value rides the tip | `kit.lineChart` |
| Before vs after | Two bars, or strike-and-replace text | `kit.bars`, `kit.mark` |
| Sequence of events | Milestones on a line | `kit.milestones` |
| A process | Steps with connectors | `kit.steps` |
| Is the forecast honest? | Reliability diagram (said vs happened) | custom SVG (see `examples/seventy-percent/scenes/calibration.js`) |

Don't use: pies with more than 3 slices, 3D anything, dual y-axes, radar charts, word clouds, or animated tables with more than 3 rows.

## Choreography: build it in the order you say it

1. **Frame:** axes, labels and the title question fade in (0.5 s). Say what we're looking at.
2. **Data:** the line draws or the bars grow (0.8–1.6 s), timed to the clause that describes it.
3. **Focus:** dim everything that isn't the story (`bars.focus(i)`, opacity 0.3) and **mark the point** (ring, label, band).
4. **Takeaway:** the number or sentence that answers the question lands on its word and **holds ≥ 2 s**.

One step per spoken clause. If the narration says one thing while the chart does another, the viewer follows the voice and misses the chart.

## Honesty rules

- **Bars start at zero. Always.**
- Lines may use a tighter range, but the axis must be labelled so the zoom is visible.
- **Same scale when comparing, or split the chart.** If one series would be flattened into invisibility (37.8× vs 0.03×), give each its own chart with its own labelled axis rather than hiding it (see `examples/one-percent`).
- Label the log scale if you use one, and say it.
- Units on every number (%, ×, $, days, ms). Show an **as-of date** or period on every data scene (`kit.source`).
- Consistent precision: don't show 37.8× next to 0.0255×. Round both to what the source supports.
- Animate from a true baseline. A counter from 0 is fine for a count; for a rate that moved from 4.1% to 4.3%, animate 4.1 → 4.3, not 0 → 4.3.
- Label hypothetical or illustrative data as such, on screen.
- Don't smooth away the story. `kit.lineChart` uses a monotone curve that never overshoots the data; pass `smooth: false` for jagged real series.

## Labels and colour

- Use **direct labels**, not legends: the value at the line's tip (`tip: true`) and the label next to its bar.
- **Context is neutral** (ink-2, line). **The story is the accent**, as one series or one bar. A second series gets `--down` or `--ink-2`, never a second bright hue.
- Up/down colour always comes with a sign or arrow.
- Gridlines are hairlines in `--line`, 3–5 of them at most. Use `kit.niceTicks` for round values.

## Numbers

- **Tabular figures** (`.cf-num`) for anything that changes, so digits don't jitter.
- Format for speech and sight: 1.2M, 37.8×, 30%, $4.5B, 2.4 s, and never 1,234,567.89 in motion.
- **A counter must land on exactly the displayed final value**, and that value must match the narration and the source.
- Big numbers carry little text: a number plus a 2–5 word label.

## Bind figures to data

Never type figures from memory into a scene. Put them in `data.json` next to the storyboard (loaded automatically as `ctx.data` / `CF.data`) or in the storyboard itself, and record each one in `storyboard.sources` with `{ claim, source, asOf }`. Then:

```js
export default function ({ el, b, data, kit }) {
  kit.counter(el.querySelector('.n'), b.say('grew'), { to: data.revenue.growthPct, decimals: 1, suffix: '%' });
}
```

Before delivery, check that every number in the narration appears in `data.json` or `sources` (the integrity skill).

## Kit quick reference

```js
kit.counter(el, at, { from, to, dur, decimals, prefix, suffix, format }).to(next, at2)   // chainable
kit.lineChart(el, { data, min, max, yFormat, tipFormat, xLabels, area, grid, color, pad })
   .axes(at).draw(at, { dur }).mark(i, at, { label }).band(i0, i1, at, { label }).hideTip(at)
kit.bars(el, { data: [{ label, value }], orientation, format, highlight }).grow(at).focus(i, at)
kit.waffle(el, { total: 100, cols: 10 }).show(at).fill(n, at, { color, order, start }).pulse(n, at)
kit.donut(el, { thickness }).sweep(at, { to: 0.7 })
kit.meter(el, { value: 0.7, label }).fill(at)
kit.milestones(el, { items: [{ label, sub }] }).play(at, { step }).focus(i, at)
kit.steps(el, { items: [{ label, sub }] }).play(at, { step }).focus(i, at)
kit.source(sceneEl, 'Source: … · as of Sep 2026', at)
```
