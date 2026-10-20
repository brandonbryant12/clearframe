import { type PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { show } from './primitives.mjs';
import type { BarValue } from './contracts.mjs';

export function drawVerticalBar({
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
}: DrawVerticalBarContext) {
  const cx = left + slot * (i + 0.5),
    y = py(v.value),
    at =
      motion === 'none'
        ? 0
        : motion.at + (motion.duration * 0.6 * i) / Math.max(n - 1, 1);
  const h = Math.max(Math.abs(y - zero), 1.5);
  elements.push({
    id: `bars-bar-${i}`,
    type: 'rect',
    x: cx - thickness / 2,
    y: Math.min(y, zero),
    w: thickness,
    h,
    r: Math.min(4, thickness * 0.08),
    fill: color(v),
    ...(motion === 'none'
      ? show
      : {
          at,
          enter: 'grow-y',
          origin: [cx, zero],
          dur: motion.duration * 0.4,
        }),
  });
  const labelY = v.value >= 0 ? y - font * 0.55 : y + font * 1.25;
  if (allValues || v.highlight || v === max || v === min)
    elements.push({
      id: `bars-value-${i}`,
      type: 'text',
      text: fmt(v.value),
      x: cx,
      y: labelY,
      size: font,
      fill: v.highlight ? 'accent2' : 'ink',
      font: 'figures',
      anchor: 'middle',
      ...arrive(at + (motion === 'none' ? 0 : motion.duration * 0.4)),
    });
  if ((i % every === 0 && n - 1 - i >= every) || i === n - 1)
    elements.push({
      id: `bars-label-${i}`,
      type: 'text',
      text: v.label,
      x: cx,
      y: Math.max(bottom, zero) + font * 1.75,
      size: font,
      fill: v.highlight ? 'ink' : 'muted',
      font: 'figures',
      anchor: 'middle',
      fit: slot * every * 0.95,
      ...show,
    });
}

export interface DrawVerticalBarContext {
  left: number;
  slot: number;
  i: number;
  py: (v: number) => number;
  v: BarValue;
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
