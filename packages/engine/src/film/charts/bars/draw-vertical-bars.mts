import { type PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { drawVerticalBar } from './draw-vertical-bar.mjs';
import type { BarsSpec, BarValue } from './contracts.mjs';

export function drawVerticalBars({
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
}: DrawVerticalBarsContext) {
  for (const [i, v] of p.values.entries()) {
    drawVerticalBar({
      left,
      slot,
      i,
      py,
      v,
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
  }
}

export interface DrawVerticalBarsContext {
  p: BarsSpec;
  left: number;
  slot: number;
  py: (v: number) => number;
  motion: 'none' | PlotMotion;
  n: number;
  zero: number;
  elements: CanvasElement[];
  thickness: number;
  color: (v: BarValue) => string;
  font: number;
  allValues: boolean;
  max: BarValue;
  min: BarValue;
  fmt: (v: number) => string;
  arrive: (at: number) => ElementFields;
  every: number;
  bottom: number;
}
