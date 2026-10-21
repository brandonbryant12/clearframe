import type { CanvasElement, ElementFields } from '../../types.mjs';
import { textWidth } from './primitives.mjs';
import type { BridgeColumn } from './contracts.mjs';

export function drawBridgeRowLink({
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
}: DrawBridgeRowLinkContext) {
  if (i < n - 1) {
    const x = px(c.to),
      y1 = cy + thickness / 2,
      y2 = cy + slot - thickness / 2,
      nameBase = y2 - font * 0.45;
    // The next row's name sits in the gap: break the line around it rather than strike through the words.
    const name = cols[i + 1].label,
      crosses =
        !beside &&
        x >= left + font * 0.2 &&
        x <= left + font * 0.5 + textWidth(name, font * 0.92) + font * 0.3;
    const spans = crosses
      ? [
          [y1, nameBase - font * 1.05],
          [nameBase + font * 0.3, y2],
        ]
      : [[y1, y2]];
    spans
      .filter(([a, b]) => b - a > 4)
      .forEach(([a, b], k) =>
        elements.push({
          id: `bridge-link-${i}${k ? `-${k}` : ''}`,
          type: 'line',
          x1: x,
          y1: a,
          x2: x,
          y2: b,
          stroke: 'muted',
          width: 1.5,
          dash: [6, 6],
          ...link(i),
        }),
      );
  }
}

export interface DrawBridgeRowLinkContext {
  i: number;
  n: number;
  px: (v: number) => number;
  c: BridgeColumn;
  cy: number;
  thickness: number;
  slot: number;
  font: number;
  cols: BridgeColumn[];
  beside: boolean;
  left: number;
  elements: CanvasElement[];
  link: (i: number) => ElementFields;
}
