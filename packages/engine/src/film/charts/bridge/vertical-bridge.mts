import { type PlotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields, Point } from '../../types.mjs';
import { check } from './check.mjs';
import { textWidth, show } from './primitives.mjs';
import { drawBridgeColumns } from './draw-bridge-columns.mjs';
import type { BridgeColumn, BridgeSpec } from './contracts.mjs';

export function verticalBridge({
  L,
  width,
  n,
  bottom,
  frac,
  top,
  font,
  cols,
  valueText,
  p,
  elements,
  tick,
  color,
  grow,
  fadeIn,
  link,
}: VerticalBridgeContext) {
  const left = L.left,
    right = L.right + width * 0.06,
    slot = (right - left) / n,
    thickness = slot * 0.64;
  const py = (v: number): number => bottom - frac(v) * (bottom - top),
    zero = py(0);
  check(
    thickness >= font * 1.6,
    'too many columns for this frame; group small drivers or use orientation horizontal',
  );
  check(
    cols.every((c) => textWidth(valueText(c), font) <= slot * 0.96),
    'values are too wide for their columns; use fewer decimals, a shorter unit or orientation horizontal',
  );
  for (let i = 1; i < p.ticks.length; i++)
    check(
      py(p.ticks[i - 1]) - py(p.ticks[i]) >= font * 1.35,
      'ticks would overlap; choose fewer ticks',
    );
  for (const [i, t] of p.ticks.entries())
    elements.push(
      {
        id: `bridge-grid-${i}`,
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
        id: `bridge-tick-${i}`,
        type: 'text',
        text: tick(t),
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
  drawBridgeColumns({
    cols,
    left,
    slot,
    py,
    elements,
    thickness,
    color,
    grow,
    valueText,
    font,
    fadeIn,
    bottom,
    zero,
    n,
    link,
  });
}

export interface VerticalBridgeContext {
  L: PlotLayout;
  width: number;
  n: number;
  bottom: number;
  frac: (v: number) => number;
  top: number;
  font: number;
  cols: BridgeColumn[];
  valueText: (c: BridgeColumn) => string;
  p: BridgeSpec;
  elements: CanvasElement[];
  tick: (v: number) => string;
  color: (c: BridgeColumn) => string;
  grow: (
    c: BridgeColumn,
    i: number,
    axis: string,
    origin: Point,
  ) => ElementFields;
  fadeIn: (c: BridgeColumn, i: number) => ElementFields;
  link: (i: number) => ElementFields;
}
