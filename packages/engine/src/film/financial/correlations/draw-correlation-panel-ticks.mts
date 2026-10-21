import type { AxisValue, PlotSpec } from '../../plot-data.mjs';

import { axisLabel } from '../../plot-data.mjs';
import { text, line } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawCorrelationPanelTicks({
  p,
  children,
  id,
  sid,
  local,
  py,
  size,
  xAxis,
  px,
}: DrawCorrelationPanelTicksContext) {
  for (const [j, v] of p.y.ticks.entries())
    children.push(
      line(`${id}-${sid}-grid-${j}`, local.left, py(v), local.right, py(v), {
        stroke: v === 0 ? 'muted' : 'line',
        width: v === 0 ? 2 : 1,
      }),
      text(
        `${id}-${sid}-y-${j}`,
        axisLabel(v, p.y),
        local.left - size * 0.3,
        py(v) + size * 0.3,
        size * 0.85,
        { anchor: 'end', font: 'figures', fit: local.left - size * 0.4 },
      ),
    );
  for (const [j, d] of xAxis.ticks.entries())
    children.push(
      text(
        `${id}-${sid}-x-${j}`,
        axisLabel(d, { ...xAxis, dateFormat: 'month' }),
        px(d),
        local.bottom + size * 1.2,
        size * 0.85,
        { anchor: j ? 'end' : 'start', font: 'figures' },
      ),
    );
}

export interface DrawCorrelationPanelTicksContext {
  p: PlotSpec;
  children: CanvasElement[];
  id: string;
  sid: string;
  local: { left: number; right: number; top: number; bottom: number };
  py: (v: AxisValue) => number;
  size: number;
  xAxis: {
    domain: string[];
    ticks: string[];
    type: 'linear' | 'date' | 'log';
    label: string;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    dateFormat?: string;
  };
  px: (d: AxisValue) => number;
}
