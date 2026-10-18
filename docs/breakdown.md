# Breakdowns: part to whole, opened and gathered

`canvas.props.breakdown` shows what a total is made of, then opens one part to show what *it* is made of, and puts it back. The parts are rows on one scale: the total is the full bar, and each part is its share of it. Use it for cost or budget composition, headcount by organisation and then by team, returned requests by reason and then by cause, or assets by class and then by holding. To show how a total *moved* from one value to another (signed drivers), use a [bridge](bridge.md) instead.

```json
{
  "block": "canvas", "min": 7,
  "vo": "Operating costs came to forty-one point eight million. People were the largest part.",
  "props": {
    "source": "Example figures",
    "breakdown": {
      "id": "opex", "title": "Where operating costs go", "unit": "Operating costs, $ millions", "asOf": "2026-09-30",
      "decimals": 1, "prefix": "$",
      "total": {"label": "Operating costs", "value": 41.8},
      "parts": [
        {"id": "people", "label": "People", "value": 24.1, "highlight": true, "say": "People",
         "parts": [{"label": "Salaries", "value": 18.0}, {"label": "Benefits", "value": 4.2}, {"label": "Contractors", "value": 1.9}]},
        {"label": "Technology", "value": 9.6},
        {"label": "Facilities", "value": 8.1}
      ]
    }
  }
}
```

The storyboard needs a `sources` entry, and the source line with its as-of date is always visible.

## Everything adds up

- **Every parent reconciles exactly.** The parts of the total, and the parts of every part, must add up to it (floating-point noise aside). A gap, however small, is refused with its amount; authored values are never adjusted.
- **What is printed adds up too.** At the chosen `decimals`, no part (remainder included) may print as zero, and the printed parts must add up to the printed parent: 33.3 + 33.3 + 33.4 = 100 printed at 0 decimals reads 33 + 33 + 33 beside 100, so it is refused with a request for more decimals.
- **An explicit remainder.** When the source really does leave some of a total unexplained, set `residual: true` on the breakdown (or on a part, for its own parts). The gap is drawn as a dashed "Not explained" share, or with your label (`"residual": "Reason not recorded"`). It is never folded silently into another part.
- **No negative remainder.** If the parts add up to *more* than their total, the difference is not a share of anything, so it is refused. That reconciliation is a bridge.
- **Positive parts only.** A part of zero draws nothing, so leave it out. A negative part is a signed change, which belongs in a bridge.
- **One level per beat, 2–8 parts per parent.** To open a part's part, give it a breakdown of its own.

## Opening and gathering

A part with `parts` can be opened in three ways.

- **`open: {part, say|cue|at}`: opens it in the same beat, on a word.**
  1. The rest of the whole steps away.
  2. The part's bar breaks into its parts, each starting as its own slice of the bar and travelling to its row.
  3. The part's name and value become the header.
- **`focus: PART`: the beat starts opened.** If the beat before drew the same breakdown (same `id`), the parts come out of the part's bar across the cut (`morphFrom`, below); otherwise they grow in on their words.
- **`gather: PART`: the beat shows the whole again.** The parts of the beat before slide back into their slices of the part's bar, which takes their place the frame they meet. Then the rest of the whole returns around it.

**Bars are exactly proportional, however small a share.** A part too thin to see keeps its exact width; its name, its value and a small outline marker at its end (not a filled bar, so not a quantity) are how it is found.

**In the opened view, the part is an outline and its parts fill it on their own scale.** A part's bar is never on screen at the same time as its parts, so no quantity is drawn twice, even mid-transition. The outline, and the part's own value in the header, mark the change of scale.

Ids are stable (`bd-ID-PART-bar`, `-label` and `-value`; `bd-ID-PART-CHILD-bar` for a part's part), so a whole beat, an opened beat and a gathered beat cut into one another. Give each breakdown in a film its own `id`.

## Dividing an element across a cut: `morphFrom`

Any rect can come out of a slice of a rect drawn in the beat before:

```json
{"id": "salaries", "type": "rect", "x": 400, "y": 500, "w": 700, "h": 60, "fill": "accent", "morphFrom": {"id": "people-bar", "slice": [0, 0.75]}}
```

`slice` is the fraction of that element along `axis` (`x`, the default, or `y`).

- **The slices of one source must not overlap.** Overlapping slices would show part of it twice.
- **The source cannot also stay on screen under its own id.**
- **The source must be a still, unscaled rect** in the beat before. If that beat does not draw the source at all, there is no morph: the element arrives as authored.

## Timing

Parts and opened parts land on `say`, on a [named moment](moments.md) (`cue`), or at seconds (`at`). The last value needs about 1.5 s to be read; `check` warns otherwise. `motion: "none"` holds the finished picture.

## Layout

- **Wide frames.** Names sit in a column beside the bars, with values at their ends.
- **Tall frames.** Each name sits above its bar, and its value at the right. A long name wraps onto a second line instead of shrinking; a name that would need three lines is refused.
- **Too many rows.** A frame without room for every row is refused with a message.

Text widths for layout are estimates; `check` runs the native frame audit, which is what establishes that nothing overflows.

Example: `examples/breakdown`. Tests: `node --test test/breakdown.test.mjs`.
