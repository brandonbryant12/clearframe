import { plotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields, FrameSize } from '../../types.mjs';
import type { StatSpec } from './contracts.mjs';
import { show, number } from './primitives.mjs';
import { drawStatKicker } from './draw-stat-kicker.mjs';
import { drawStatChange } from './draw-stat-change.mjs';

export function statElements(p: StatSpec, frame: FrameSize): CanvasElement[] {
  const { width, height } = frame,
    L = plotLayout(frame),
    tall = L.orientation !== 'landscape';
  const W = width - 2 * L.margin,
    x = L.margin;
  const at = p.motion === 'none' ? 0 : p.motion.at,
    dur = p.motion === 'none' ? 0 : p.motion.duration;
  const arrive = (t: number): ElementFields =>
    t === 0 ? show : { at: t, enter: 'rise', dur: 0.45 };
  const valueSize = width * (tall ? 0.22 : 0.135),
    text = `${p.value < 0 ? '−' : ''}${p.prefix}${number(p.value, p.decimals)}${p.suffix}`;
  const valueY = height * (tall ? 0.5 : 0.56);
  const elements: CanvasElement[] = [];
  drawStatKicker({ p, L, W, valueY, valueSize, arrive, at, elements });
  // Tabular figures while counting: proportional digits make the suffix jump as widths change.
  elements.push({
    id: 'stat-value',
    type: 'text',
    text,
    x,
    y: valueY,
    size: valueSize,
    fill: 'ink',
    font: p.count && p.motion !== 'none' ? 'figures' : 'display',
    fit: W,
    ...(p.count && p.motion !== 'none'
      ? {
          at,
          enter: 'fade',
          dur: 0.2,
          count: {
            from: 0,
            to: Math.abs(p.value),
            decimals: p.decimals,
            prefix: `${p.value < 0 ? '−' : ''}${p.prefix}`,
            suffix: p.suffix,
            dur,
          },
        }
      : arrive(at)),
  });
  const labelSize = width * (tall ? 0.045 : 0.026);
  elements.push({
    id: 'stat-label',
    type: 'text',
    text: p.label,
    x,
    y: valueY + labelSize * 1.9,
    size: labelSize,
    fill: 'ink',
    font: 'semibold',
    width: W,
    height: labelSize * 2.6,
    ...arrive(at + dur * 0.5),
  });
  drawStatChange({
    p,
    elements,
    x,
    valueY,
    labelSize,
    tall,
    W,
    arrive,
    at,
    dur,
  });
  return elements;
}
