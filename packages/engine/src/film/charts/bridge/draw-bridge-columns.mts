import type { CanvasElement, ElementFields, Point } from '../../types.mjs';
import { show } from './primitives.mjs';
import type { BridgeColumn } from './contracts.mjs';

export function drawBridgeColumns({
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
}: DrawBridgeColumnsContext) {
  for (const [i, c] of cols.entries()) {
    const cx = left + slot * (i + 0.5),
      y0 = py(c.from),
      y1 = py(c.to),
      up = c.to >= c.from;
    elements.push({
      id: `bridge-bar-${i}`,
      type: 'rect',
      x: cx - thickness / 2,
      y: Math.min(y0, y1),
      w: thickness,
      h: Math.max(Math.abs(y1 - y0), 2),
      r: Math.min(4, thickness * 0.06),
      fill: color(c),
      ...grow(c, i, 'grow-y', [cx, y0]),
    });
    // A value sits at the end the bar grew to: above a rise, below a fall.
    elements.push({
      id: `bridge-value-${i}`,
      type: 'text',
      text: valueText(c),
      x: cx,
      y: up ? Math.min(y0, y1) - font * 0.55 : Math.max(y0, y1) + font * 1.25,
      size: font,
      fill: c.kind === 'end' ? 'accent2' : 'ink',
      font: 'figures',
      anchor: 'middle',
      fit: slot * 0.96,
      ...fadeIn(c, i),
    });
    elements.push({
      id: `bridge-label-${i}`,
      type: 'text',
      text: c.label,
      x: cx,
      y: Math.max(bottom, zero) + font * 1.75,
      size: font * 0.92,
      fill: c.kind === 'step' ? 'muted' : 'ink',
      font: c.kind === 'step' ? 'semibold' : 'strong',
      anchor: 'middle',
      width: slot * 0.94,
      leading: 1.1,
      ...show,
    });
    // The connector carries the running total across to where the next column starts.
    if (i < n - 1) {
      const level = py(c.to);
      elements.push({
        id: `bridge-link-${i}`,
        type: 'line',
        x1: cx + thickness / 2,
        y1: level,
        x2: left + slot * (i + 1.5) - thickness / 2,
        y2: level,
        stroke: 'muted',
        width: 1.5,
        dash: [6, 6],
        ...link(i),
      });
    }
  }
}

export interface DrawBridgeColumnsContext {
  cols: BridgeColumn[];
  left: number;
  slot: number;
  py: (v: number) => number;
  elements: CanvasElement[];
  thickness: number;
  color: (c: BridgeColumn) => string;
  grow: (
    c: BridgeColumn,
    i: number,
    axis: string,
    origin: Point,
  ) => ElementFields;
  valueText: (c: BridgeColumn) => string;
  font: number;
  fadeIn: (c: BridgeColumn, i: number) => ElementFields;
  bottom: number;
  zero: number;
  n: number;
  link: (i: number) => ElementFields;
}
