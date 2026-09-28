---
name: clearframe-dataviz
description: Choose, choreograph and honestly animate numbers and charts in ClearFrame videos — which native block answers which question (stat, kpis, delta, bars, line, waffle, ring, donut, funnel, magnitude), the build order that matches narration, honesty rules (baselines, scales, units, as-of dates), number formatting, and binding figures to sources. Use whenever a video shows a number, a comparison, a trend, a share, a probability or a process.
---

# Numbers and charts in motion

A chart in a video is not a chart on a page. The viewer can't pause, re-read or hover, so every chart must answer **one question**, reveal it **in the order it is spoken**, and **point** at the answer. All numeric blocks are native FFFrames renderers; run `node engine/cli.mjs blocks NAME` for exact props.

## Pick the form

| Question | Block | Notes |
|---|---|---|
| How big is this one number? | `stat` | Tabular-figure counter from a truthful `from`; word units (" days") set small, symbols ("%") larger |
| Two to four headline metrics | `kpis` | Cards count up in order; keep units comparable |
| What changed? | `delta` | The new value counts from the old one; `better: up/down` colors the change chip, never the only signal (sign + arrow remain) |
| Compare a few values | `bars` | Zero baseline always; horizontal for long labels; `sort: desc` unless order means something; `focus` dims the rest |
| Change over time | `line` | Draws left to right with an area wash; round-number ticks; the final value appears at the tip |
| What share, what chance? | `waffle` | "7 in 10" is countable where 70% is abstract; `icon: user` makes a pictogram |
| One proportion, compact | `ring` | Percent when `max` is 100, otherwise "value of max" |
| Parts of a whole | `donut` | Two to six segments; the legend states value and share; avoid for more than four similar slices |
| Stages that lose people | `funnel` | Derived step rates ("↓ 62%") are computed from your data; turn off with `rates: false` |
| Orders of magnitude | `magnitude` | Area-true squares; tiny squares keep their true size and get a locator ring |
| A process or sequence | `steps`, `timeline`, `flow` | Not charts: use them when order, not quantity, is the point |

Don't use: 3D, dual axes, radar charts, word clouds, or tables with more than four rows in motion. Use `matrix` for qualitative comparison grids.

## Choreography: build it in the order you say it

1. **Frame:** the header rises; axes, baselines and gridlines draw first.
2. **Data:** bars grow, lines draw, segments sweep, timed to the clause that describes them with `growSay`, `drawSay` or `land` (an exact spoken word, or local seconds).
3. **Focus:** dim what is not the story (`bars.focus` with authored `dim` and `dur`, `matrix.highlight`) and mark the point (`focus.note`, `annotate` pins).
4. **Takeaway:** the answering number or sentence lands on its word and holds at least two seconds.

Every counter and bar settles on the exact authored value. `check` fails a final render when a beat ends before its numbers finish counting (drafts warn), because the true figure would never be on screen. Extend the beat or cue earlier.

## Honesty rules

- **Bars start at zero. Always.** Negative bars are rejected; use `delta` or an explicit `line` domain for signed change.
- Line domains may be tighter than zero, but they are explicit (`min`, `max`) and every data point must lie inside them. Tick labels are round values inside the domain, never rounded-off odd steps.
- **Same scale when comparing, or split the chart.** When one value would be invisible next to another, use `magnitude` (area) or give each its own chart with its own labelled scale.
- Units on every number (%, ×, $, days, ms), and an as-of date or period in `props.source` on every data scene.
- Consistent precision: `decimals` is inferred from the data; set it explicitly when the source supports less.
- Animate from a true baseline: a count may start at 0; a rate that moved from 4.1% to 4.3% should use `from: 4.1`.
- Label hypothetical or illustrative data as such, on screen. Playbook samples already say so; replace them.
- Derived figures (funnel step rates, donut shares) are computed from your inputs; the inputs still need a source.

## Labels and color

- Direct labels, not legends, except `donut`, whose legend doubles as the data table.
- Context is neutral (`muted`, hairlines); the story is the `accent`. `accent2` is for a genuinely second series.
- Positive/negative colors appear only when `better` states which direction is good, and always alongside a sign.

## Numbers

- Counters use Inter's own tabular figures, so digits never jitter and the suffix settles in place.
- Format for speech and sight: 1.2M, 37.8×, 30%, $4.5B, 2.4 s — never 1,234,567.89 in motion.
- A number plus a two-to-five word label; context goes in `context`/`support`, not in the figure.

## Bind figures to sources

Never type figures from memory. Put them in block props and record each in `storyboard.sources` with `{ claim, source, asOf }`; the visible `props.source` is required for every numeric block. Before delivery, check that every number in the narration appears in the props and the sources (see the integrity skill).
