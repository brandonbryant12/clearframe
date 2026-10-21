import {
  axisPosition,
  axisLabel,
  type AxisValue,
  type ObservedPoint,
  type PlotMotion,
  type PlotSpec,
} from '../../plot-data.mjs';
import { type PlotLayout } from '../../plots.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { drawPanelAxes } from './draw-panel-axes.mjs';
import { panelLabelColor } from './panel-label-color.mjs';
import { show } from './primitives.mjs';
import { drawPanelSegments } from './draw-panel-segments.mjs';
import { check } from './check.mjs';
import type { MultiplesSpec } from './contracts.mjs';

export function drawMultiplePanel({
  panel,
  k,
  cols,
  L,
  tickW,
  panelW,
  gapX,
  gridTop,
  font,
  panelH,
  gapY,
  p,
  yEnds,
  elements,
  rows,
  n,
  xEnds,
  stroke,
  motion,
  time,
  arrive,
  end,
}: DrawMultiplePanelContext) {
  const s = panel.series[0],
    col = k % cols,
    row = Math.floor(k / cols);
  const left = L.margin + tickW + col * (panelW + gapX),
    top = gridTop + font * 1.6 + row * (panelH + gapY),
    bottom = top + panelH,
    right = left + panelW;
  const px = (x: AxisValue): number =>
      left + axisPosition(x, p.x) * (right - left),
    py = (y: AxisValue): number =>
      bottom - axisPosition(y, p.y) * (bottom - top);
  const hot = p.highlight === s.id,
    dim = p.highlight != null && !hot,
    color = hot ? 'accent2' : 'accent';
  const id = `multiples-${s.id}`;
  // Shared scale: ticks on the outer edges only, light grid in every panel.
  drawPanelAxes({
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
  });
  elements.push({
    id: `${id}-label`,
    type: 'text',
    text: s.label,
    x: left,
    y: top - font * 0.6,
    size: font * 1.05,
    fill: panelLabelColor(hot, dim),
    font: 'semibold',
    fit: panelW * 0.66,
    ...show,
  });
  let last: ObservedPoint | null = null;
  last = drawPanelSegments({
    s,
    last,
    elements,
    id,
    px,
    py,
    dim,
    color,
    stroke,
    motion,
    time,
  });
  const terminal = s.values.findLast((v): v is ObservedPoint => v.y !== null);
  check(terminal, 'an all-missing series has no drawable evidence');
  elements.push(
    {
      id: `${id}-end`,
      type: 'circle',
      cx: px(terminal.x),
      cy: py(terminal.y),
      r: stroke * 1.8,
      fill: dim ? 'muted' : color,
      ...arrive(time(terminal.x)),
    },
    {
      id: `${id}-value`,
      type: 'text',
      text: axisLabel(terminal.y, p.y),
      x: right,
      y: top - font * 0.6,
      size: font * 1.05,
      fill: panelLabelColor(hot, dim),
      font: 'figures',
      anchor: 'end',
      fit: panelW * 0.32,
      ...arrive(end),
    },
  );
}

export interface DrawMultiplePanelContext {
  panel: PlotSpec;
  k: number;
  cols: number;
  L: PlotLayout;
  tickW: number;
  panelW: number;
  gapX: number;
  gridTop: number;
  font: number;
  panelH: number;
  gapY: number;
  p: MultiplesSpec;
  yEnds: AxisValue[];
  elements: CanvasElement[];
  rows: number;
  n: number;
  xEnds: AxisValue[];
  stroke: number;
  motion: 'none' | PlotMotion;
  time: (x: AxisValue) => number;
  arrive: (at: number) => ElementFields;
  end: number;
}
