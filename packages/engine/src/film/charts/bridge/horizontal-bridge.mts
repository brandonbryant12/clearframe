import { type PlotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields, Point } from '../../types.mjs';
import { textWidth } from './primitives.mjs';
import { check } from './check.mjs';
import { horizontalBridgeTicks } from './horizontal-bridge-ticks.mjs';
import { drawBridgeRows } from './draw-bridge-rows.mjs';
import type { BridgeColumn, BridgeSpec } from './contracts.mjs';

export function horizontalBridge({
  width,
  height,
  cols,
  font,
  L,
  valueText,
  bottom,
  top,
  n,
  frac,
  p,
  tick,
  elements,
  color,
  grow,
  fadeIn,
  link,
}: HorizontalBridgeContext) {
  const beside = width >= height;
  const labelW = beside
    ? Math.min(
        width * 0.34,
        Math.max(...cols.map((c) => textWidth(c.label, font))) + font,
      )
    : 0;
  const left = L.margin + labelW,
    right =
      width -
      L.margin -
      Math.max(...cols.map((c) => textWidth(valueText(c), font))) -
      font;
  const slot = (bottom - top) / n,
    thickness = beside
      ? slot * 0.6
      : Math.min(slot * 0.48, font * 2.2, slot - font * 1.5),
    px = (v: number): number => left + frac(v) * (right - left),
    zero = px(0);
  check(
    right - left >= width * (beside ? 0.3 : 0.5),
    'names or values are too wide for this frame; shorten them',
  );
  check(
    beside
      ? slot >= font * 1.35 && thickness >= font * 0.75
      : thickness >= font * 0.8,
    'too many rows for this frame; group small drivers',
  );
  // Tick labels that would collide are dropped (their grid lines stay); zero and the ends are kept first.
  horizontalBridgeTicks({ p, tick, font, px, elements, top, bottom });
  drawBridgeRows({
    cols,
    top,
    slot,
    beside,
    font,
    px,
    elements,
    thickness,
    color,
    grow,
    left,
    labelW,
    right,
    valueText,
    zero,
    width,
    L,
    fadeIn,
    n,
    link,
  });
}

export interface HorizontalBridgeContext {
  width: number;
  height: number;
  cols: BridgeColumn[];
  font: number;
  L: PlotLayout;
  valueText: (c: BridgeColumn) => string;
  bottom: number;
  top: number;
  n: number;
  frac: (v: number) => number;
  p: BridgeSpec;
  tick: (v: number) => string;
  elements: CanvasElement[];
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
