import { edgeAnchor } from '../labels.mjs';

import { axisLabel, type AxisValue, type PlotSpec } from '../../plot-data.mjs';
import type { CanvasElement } from '../../types.mjs';
import { line, text } from './primitives.mjs';
import type { PlotLayout } from './contracts.mjs';

export function plotAxes({
  p,
  elements,
  left,
  py,
  right,
  font,
  L,
  px,
  bottom,
}: PlotAxesContext) {
  for (const [i, y] of p.y.ticks.entries()) {
    elements.push(
      line(`plot-y-grid-${i}`, left, py(y), right, py(y), {
        stroke: y === 0 && p.y.type !== 'log' ? 'muted' : 'line',
        width: y === 0 ? 2 : 1.25,
      }),
      text(
        `plot-y-tick-${i}`,
        axisLabel(y, p.y),
        left - font * 0.7,
        py(y) + font * 0.35,
        font,
        { anchor: 'end', font: 'figures', fill: 'muted', fit: left - L.margin },
      ),
    );
  }
  for (const [i, x] of p.x.ticks.entries()) {
    elements.push(
      line(`plot-x-tick-${i}`, px(x), bottom, px(x), bottom + font * 0.5, {
        stroke: 'muted',
      }),
      text(
        `plot-x-value-${i}`,
        axisLabel(x, p.x),
        px(x),
        bottom + font * 1.75,
        font,
        {
          anchor: edgeAnchor(i, p.x.ticks.length - 1),
          font: 'figures',
          fill: 'muted',
        },
      ),
    );
  }
}

export interface PlotAxesContext {
  p: PlotSpec;
  elements: CanvasElement[];
  left: number;
  py: (y: AxisValue) => number;
  right: number;
  font: number;
  L: PlotLayout;
  px: (x: AxisValue) => number;
  bottom: number;
}
