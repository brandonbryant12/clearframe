import { labelStart } from '../labels.mjs';

import { axisLabel, type AxisValue, type PlotSpec } from '../../plot-data.mjs';

import type { PlotLayout } from './contracts.mjs';
import { check } from './check.mjs';
import { textWidth } from './primitives.mjs';

/** Labels that would print over each other are an authoring error, not something to discover in review. */
export function checkSpacing(
  p: PlotSpec,
  L: PlotLayout,
  px: (x: AxisValue) => number,
  py: (y: AxisValue) => number,
): void {
  const yPos = p.y.ticks.map(py);
  for (let i = 1; i < yPos.length; i++)
    check(
      Math.abs(yPos[i] - yPos[i - 1]) >= L.type * 1.35,
      `y ticks ${axisLabel(p.y.ticks[i - 1], p.y)} and ${axisLabel(p.y.ticks[i], p.y)} would overlap; choose ticks further apart`,
    );
  const spans = p.x.ticks.map((t, i) => {
    const w = textWidth(axisLabel(t, p.x), L.type),
      x = px(t);
    const a = labelStart(i, p.x.ticks.length - 1, x, w);
    return [a, a + w];
  });
  for (let i = 1; i < spans.length; i++)
    check(
      spans[i][0] - spans[i - 1][1] >= L.type * 0.6,
      `x ticks ${axisLabel(p.x.ticks[i - 1], p.x)} and ${axisLabel(p.x.ticks[i], p.x)} would overlap; choose ticks further apart`,
    );
}
