import { axisLabel, type AxisValue } from '../../plot-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { show, hasSign } from './primitives.mjs';
import type { MultiplesSpec } from './contracts.mjs';

export function drawPanelAxes({
  yEnds,
  elements,
  id,
  left,
  py,
  right,
  col,
  p,
  font,
  tickW,
  row,
  rows,
  k,
  cols,
  n,
  xEnds,
  bottom,
}: DrawPanelAxesContext) {
  for (const [i, y] of yEnds.entries()) {
    elements.push({
      id: `${id}-grid-${i}`,
      type: 'line',
      x1: left,
      y1: py(y),
      x2: right,
      y2: py(y),
      stroke: 'line',
      width: 1.25,
      ...show,
    });
    if (col === 0)
      elements.push({
        id: `${id}-tick-${i}`,
        type: 'text',
        text: axisLabel(y, p.y),
        x: left - font * 0.5,
        y: py(y) + font * 0.35,
        size: font * 0.9,
        fill: 'muted',
        font: 'figures',
        anchor: 'end',
        fit: tickW - font * 0.3,
        ...show,
      });
  }
  if (hasSign(p.y.domain[0], -1) && hasSign(p.y.domain[1], 1))
    elements.push({
      id: `${id}-zero`,
      type: 'line',
      x1: left,
      y1: py(0),
      x2: right,
      y2: py(0),
      stroke: 'muted',
      width: 1.5,
      ...show,
    });
  if (row === rows - 1 || k + cols >= n)
    for (const [i, x] of xEnds.entries())
      elements.push({
        id: `${id}-x-${i}`,
        type: 'text',
        text: axisLabel(x, p.x),
        x: i ? right : left,
        y: bottom + font * 1.45,
        size: font * 0.9,
        fill: 'muted',
        font: 'figures',
        anchor: i ? 'end' : 'start',
        ...show,
      });
}

export interface DrawPanelAxesContext {
  yEnds: AxisValue[];
  elements: CanvasElement[];
  id: string;
  left: number;
  py: (y: AxisValue) => number;
  right: number;
  col: number;
  p: MultiplesSpec;
  font: number;
  tickW: number;
  row: number;
  rows: number;
  k: number;
  cols: number;
  n: number;
  xEnds: AxisValue[];
  bottom: number;
}
