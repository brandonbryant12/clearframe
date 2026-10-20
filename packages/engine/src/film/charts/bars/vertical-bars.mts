import { type PlotLayout } from '../../plots.mjs';
import { type PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { check } from './check.mjs';
import { show, textWidth } from './primitives.mjs';
import { drawVerticalBars } from './draw-vertical-bars.mjs';
import { verticalBarReference } from './vertical-bar-reference.mjs';
import type { BarsSpec, BarValue } from './contracts.mjs';

export function verticalBars({
  bottom,
  frac,
  top,
  p,
  font,
  elements,
  left,
  right,
  fmt,
  L,
  slot,
  motion,
  n,
  thickness,
  color,
  arrive,
  end,
  width,
}: VerticalBarsContext) {
  const py = (v: number): number => bottom - frac(v) * (bottom - top),
    zero = py(0);
  for (let i = 1; i < p.ticks.length; i++)
    check(
      py(p.ticks[i - 1]) - py(p.ticks[i]) >= font * 1.35,
      'ticks would overlap; choose fewer ticks',
    );
  for (const [i, t] of p.ticks.entries())
    elements.push(
      {
        id: `bars-grid-${i}`,
        type: 'line',
        x1: left,
        y1: py(t),
        x2: right,
        y2: py(t),
        stroke: t === 0 ? 'muted' : 'line',
        width: t === 0 ? 2 : 1.25,
        ...show,
      },
      {
        id: `bars-tick-${i}`,
        type: 'text',
        text: fmt(t),
        x: left - font * 0.7,
        y: py(t) + font * 0.35,
        size: font,
        fill: 'muted',
        font: 'figures',
        anchor: 'end',
        fit: left - L.margin,
        ...show,
      },
    );
  const every = Math.ceil(
    (Math.max(...p.values.map((v) => textWidth(v.label, font))) + font * 0.6) /
      slot,
  );
  // Narrow bars label only the extremes and highlights; every value stays in the bar height.
  const allValues =
    textWidth(
      fmt(
        p.values.reduce((a, v) =>
          Math.abs(v.value) > Math.abs(a.value) ? v : a,
        ).value,
      ),
      font,
    ) <=
    slot * 0.95;
  const max = p.values.reduce((a, v) => (v.value > a.value ? v : a)),
    min = p.values.reduce((a, v) => (v.value < a.value ? v : a));
  drawVerticalBars({
    p,
    left,
    slot,
    py,
    motion,
    n,
    zero,
    elements,
    thickness,
    color,
    font,
    allValues,
    max,
    min,
    fmt,
    arrive,
    every,
    bottom,
  });
  verticalBarReference({
    p,
    py,
    elements,
    left,
    right,
    arrive,
    end,
    fmt,
    font,
    width,
    L,
  });
}

export interface VerticalBarsContext {
  bottom: number;
  frac: (v: number) => number;
  top: number;
  p: BarsSpec;
  font: number;
  elements: CanvasElement[];
  left: number;
  right: number;
  fmt: (v: number) => string;
  L: PlotLayout;
  slot: number;
  motion: 'none' | PlotMotion;
  n: number;
  thickness: number;
  color: (v: BarValue) => string;
  arrive: (at: number) => ElementFields;
  end: number;
  width: number;
}
