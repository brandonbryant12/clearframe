import type { CanvasElement } from '../types.mjs';
import type { ResolvedNode, Status, Metrics } from './contracts.mjs';
import { COLOR, BADGE } from './shared.mjs';
/** One component drawn around (0, 0): its outline, kind mark, label and status badge. */
export function drawNode(
  n: ResolvedNode,
  status: Status,
  { hw, hh, nw, nh, size, nameSize, u }: Metrics,
): CanvasElement[] {
  const color = COLOR[status],
    stroke = u * 0.0028;
  const out: CanvasElement[] = [];
  if (n.kind === 'database') {
    const ry = nh * 0.13;
    out.push(
      {
        type: 'path',
        d: `M ${-hw} ${-hh + ry} C ${-hw} ${-hh - ry} ${hw} ${-hh - ry} ${hw} ${-hh + ry} V ${hh - ry} C ${hw} ${hh + ry} ${-hw} ${hh + ry} ${-hw} ${hh - ry} Z`,
        fill: 'surface',
        stroke: color,
        width: stroke,
      },
      {
        type: 'ellipse',
        cx: 0,
        cy: -hh + ry,
        rx: hw,
        ry,
        fill: 'none',
        stroke: color,
        width: stroke,
      },
    );
  } else
    out.push({
      type: 'rect',
      x: -hw,
      y: -hh,
      w: nw,
      h: nh,
      r: n.kind === 'state' ? hh : u * 0.012,
      fill: 'surface',
      stroke: color,
      width: stroke,
      ...(n.kind === 'external' ? { dash: [u * 0.01, u * 0.007] } : {}),
    });
  if (n.kind === 'user')
    out.push(
      {
        type: 'circle',
        cx: -hw + nw * 0.16,
        cy: -nh * 0.1,
        r: nh * 0.11,
        fill: 'none',
        stroke: color,
        width: stroke,
      },
      {
        type: 'path',
        d: `M ${-hw + nw * 0.07} ${nh * 0.22} Q ${-hw + nw * 0.16} ${-nh * 0.08} ${-hw + nw * 0.25} ${nh * 0.22}`,
        fill: 'none',
        stroke: color,
        width: stroke,
      },
    );
  if (n.kind === 'queue')
    for (let j = 0; j < 3; j++)
      out.push({
        type: 'line',
        x1: -hw + nw * 0.12,
        y1: -hh + nh * (0.28 + j * 0.21),
        x2: -hw + nw * 0.24,
        y2: -hh + nh * (0.28 + j * 0.21),
        stroke: color,
        width: stroke,
      });
  const icon = ['user', 'queue'].includes(n.kind);
  out.push({
    type: 'text',
    text: n.label,
    x: icon ? nw * 0.12 : 0,
    y: nameSize * 0.34,
    size: nameSize,
    fit: nw * (icon ? 0.63 : 0.85),
    anchor: 'middle',
    fill: 'ink',
    font: 'strong',
  });
  // A status badge sits on the outline's top-right, like a notification dot.
  if (BADGE[status]) {
    const r = size * 0.46,
      [cx, cy] = badgePosition(n.kind, hw, hh, nh);
    out.push(
      {
        type: 'circle',
        cx,
        cy,
        r,
        fill: color,
        stroke: 'surface',
        width: u * 0.002,
      },
      {
        type: 'text',
        text: BADGE[status],
        x: cx,
        y: cy + r * 0.52,
        size: r * 1.5,
        anchor: 'middle',
        fill: 'surface',
        font: 'bold',
      },
    );
  }
  // The base drawing arrives with its group; a change fades in as one piece.
  for (const el of out) el.enter = 'none';
  return out;
}

function badgePosition(
  kind: ResolvedNode['kind'],
  hw: number,
  hh: number,
  nh: number,
): [number, number] {
  if (kind === 'state') return [hw - hh * 0.3, -hh * 0.95];
  if (kind === 'database') return [hw, -hh + nh * 0.13];
  return [hw - 2, -hh + 2];
}
