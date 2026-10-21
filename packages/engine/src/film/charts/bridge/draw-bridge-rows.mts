import { type PlotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields, Point } from '../../types.mjs';
import { show } from './primitives.mjs';
import { drawBridgeRowLink } from './draw-bridge-row-link.mjs';
import type { BridgeColumn } from './contracts.mjs';

export function drawBridgeRows({
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
}: DrawBridgeRowsContext) {
  for (const [i, c] of cols.entries()) {
    drawBridgeRow({
      top,
      slot,
      i,
      beside,
      font,
      px,
      c,
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
      cols,
      link,
    });
  }
}

export interface DrawBridgeRowsContext {
  cols: BridgeColumn[];
  top: number;
  slot: number;
  beside: boolean;
  font: number;
  px: (v: number) => number;
  elements: CanvasElement[];
  thickness: number;
  color: (c: BridgeColumn) => string;
  grow: (
    c: BridgeColumn,
    i: number,
    axis: string,
    origin: Point,
  ) => ElementFields;
  left: number;
  labelW: number;
  right: number;
  valueText: (c: BridgeColumn) => string;
  zero: number;
  width: number;
  L: PlotLayout;
  fadeIn: (c: BridgeColumn, i: number) => ElementFields;
  n: number;
  link: (i: number) => ElementFields;
}

function drawBridgeRow({
  top,
  slot,
  i,
  beside,
  font,
  px,
  c,
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
  cols,
  link,
}: DrawBridgeRowContext) {
  const cy = top + slot * (i + 0.5) + (beside ? 0 : font * 0.55),
    x0 = px(c.from),
    x1 = px(c.to);
  elements.push(
    {
      id: `bridge-bar-${i}`,
      type: 'rect',
      x: Math.min(x0, x1),
      y: cy - thickness / 2,
      w: Math.max(Math.abs(x1 - x0), 2),
      h: thickness,
      r: Math.min(4, thickness * 0.06),
      fill: color(c),
      ...grow(c, i, 'grow-x', [x0, cy]),
    },
    beside
      ? {
          id: `bridge-label-${i}`,
          type: 'text',
          text: c.label,
          x: left - font * 0.7,
          y: cy + font * 0.35,
          size: font,
          fill: c.kind === 'step' ? 'muted' : 'ink',
          font: c.kind === 'step' ? 'semibold' : 'strong',
          anchor: 'end',
          fit: labelW - font * 0.7,
          ...show,
        }
      : {
          id: `bridge-label-${i}`,
          type: 'text',
          text: c.label,
          x: left + font * 0.5,
          y: cy - thickness / 2 - font * 0.45,
          size: font * 0.92,
          fill: c.kind === 'step' ? 'muted' : 'ink',
          font: c.kind === 'step' ? 'semibold' : 'strong',
          fit: (right - left) * 0.6,
          ...show,
        },
    {
      id: `bridge-value-${i}`,
      type: 'text',
      text: valueText(c),
      x: Math.max(x0, x1, zero) + font * 0.5,
      y: cy + font * 0.35,
      size: font,
      fill: c.kind === 'end' ? 'accent2' : 'ink',
      font: 'figures',
      anchor: 'start',
      fit: width - L.margin - Math.max(x0, x1, zero) - font * 0.5,
      ...fadeIn(c, i),
    },
  );
  drawBridgeRowLink({
    i,
    n,
    px,
    c,
    cy,
    thickness,
    slot,
    font,
    cols,
    beside,
    left,
    elements,
    link,
  });
}

interface DrawBridgeRowContext {
  top: number;
  slot: number;
  i: number;
  beside: boolean;
  font: number;
  px: (v: number) => number;
  c: BridgeColumn;
  elements: CanvasElement[];
  thickness: number;
  color: (c: BridgeColumn) => string;
  grow: (
    c: BridgeColumn,
    i: number,
    axis: string,
    origin: Point,
  ) => ElementFields;
  left: number;
  labelW: number;
  right: number;
  valueText: (c: BridgeColumn) => string;
  zero: number;
  width: number;
  L: PlotLayout;
  fadeIn: (c: BridgeColumn, i: number) => ElementFields;
  n: number;
  cols: BridgeColumn[];
  link: (i: number) => ElementFields;
}
