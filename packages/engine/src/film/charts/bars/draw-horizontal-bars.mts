import { type PlotLayout } from '../../plots.mjs';
import { type PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { textWidth, show } from './primitives.mjs';
import { barValueX } from './bar-value-x.mjs';
import { check } from './check.mjs';
import type { BarsSpec, BarValue } from './contracts.mjs';

export function drawHorizontalBars({
  p,
  top,
  slot,
  px,
  motion,
  n,
  fmt,
  font,
  left,
  elements,
  zero,
  thickness,
  color,
  L,
  arrive,
}: DrawHorizontalBarsContext) {
  for (const [i, v] of p.values.entries()) {
    const cy = top + slot * (i + 0.5),
      x = px(v.value),
      at =
        motion === 'none'
          ? 0
          : motion.at + (motion.duration * 0.6 * i) / Math.max(n - 1, 1);
    const w = textWidth(fmt(v.value), font),
      outside = v.value >= 0 || x - font * 0.5 - w >= left + font * 0.3;
    elements.push(
      {
        id: `bars-bar-${i}`,
        type: 'rect',
        x: Math.min(x, zero),
        y: cy - thickness / 2,
        w: Math.max(Math.abs(x - zero), 1.5),
        h: thickness,
        r: Math.min(4, thickness * 0.08),
        fill: color(v),
        ...(motion === 'none'
          ? show
          : {
              at,
              enter: 'grow-x',
              origin: [zero, cy],
              dur: motion.duration * 0.4,
            }),
      },
      {
        id: `bars-label-${i}`,
        type: 'text',
        text: v.label,
        x: left - font * 0.7,
        y: cy + font * 0.35,
        size: font,
        fill: v.highlight ? 'ink' : 'muted',
        font: 'semibold',
        anchor: 'end',
        fit: left - L.margin - font * 0.7,
        ...show,
      },
      // A negative value sits left of its bar unless that would reach the category names; then it moves past zero.
      {
        id: `bars-value-${i}`,
        type: 'text',
        text: fmt(v.value),
        x: barValueX(v.value, x, font, outside, zero),
        y: cy + font * 0.35,
        size: font,
        fill: v.highlight ? 'accent2' : 'ink',
        font: 'figures',
        anchor: v.value >= 0 || !outside ? 'start' : 'end',
        ...arrive(at + (motion === 'none' ? 0 : motion.duration * 0.4)),
      },
    );
    check(
      thickness >= font * 1.1,
      'horizontal bars need room for one line of label; use fewer bars',
    );
  }
}

export interface DrawHorizontalBarsContext {
  p: BarsSpec;
  top: number;
  slot: number;
  px: (v: number) => number;
  motion: 'none' | PlotMotion;
  n: number;
  fmt: (v: number) => string;
  font: number;
  left: number;
  elements: CanvasElement[];
  zero: number;
  thickness: number;
  color: (v: BarValue) => string;
  L: PlotLayout;
  arrive: (at: number) => ElementFields;
}
