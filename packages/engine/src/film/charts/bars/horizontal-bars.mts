import { type PlotLayout } from '../../plots.mjs';
import { type PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { horizontalBarTicks } from './horizontal-bar-ticks.mjs';
import { drawHorizontalBars } from './draw-horizontal-bars.mjs';
import { horizontalBarReference } from './horizontal-bar-reference.mjs';
import type { BarsSpec, BarValue } from './contracts.mjs';

export function horizontalBars({
  left,
  frac,
  right,
  p,
  fmt,
  font,
  elements,
  top,
  bottom,
  slot,
  motion,
  n,
  thickness,
  color,
  L,
  arrive,
  end,
}: HorizontalBarsContext) {
  const px = (v: number): number => left + frac(v) * (right - left),
    zero = px(0);
  // Tick labels that would collide are dropped (their grid lines stay); zero and the ends are kept first.
  horizontalBarTicks({ p, fmt, font, px, elements, top, bottom });
  drawHorizontalBars({
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
  });
  horizontalBarReference({
    p,
    px,
    elements,
    top,
    font,
    bottom,
    arrive,
    end,
    fmt,
  });
}

export interface HorizontalBarsContext {
  left: number;
  frac: (v: number) => number;
  right: number;
  p: BarsSpec;
  fmt: (v: number) => string;
  font: number;
  elements: CanvasElement[];
  top: number;
  bottom: number;
  slot: number;
  motion: 'none' | PlotMotion;
  n: number;
  thickness: number;
  color: (v: BarValue) => string;
  L: PlotLayout;
  arrive: (at: number) => ElementFields;
  end: number;
}
