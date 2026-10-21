import type { CanvasElement, Point } from '../types.mjs';
import type { ResolvedCue } from './shared.mjs';
import { round } from './shared.mjs';
export function fieldArrows(
  F: (u: number, v: number) => Point,
  P: (u: number, v: number) => Point,
  bw: number,
  bh: number,
  T: boolean,
  show: ResolvedCue,
): CanvasElement {
  const aspect = bh / bw;
  const cols = T ? 6 : 11,
    rows = Math.max(3, Math.round(cols * aspect));
  const arrows: CanvasElement[] = [];
  let peak = 0;
  const grid: [number, number, number, number][] = [];
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const u = -1 + (2 * (i + 0.5)) / cols,
        v = -1 + (2 * (j + 0.5)) / rows,
        [vu, vv] = F(u, v);
      grid.push([u, v, vu, vv]);
      peak = Math.max(peak, Math.hypot(vu, vv));
    }
  const cell = Math.min(bw / cols, bh / rows) * 0.42;
  for (const [u, v, vu, vv] of grid) {
    const m = Math.hypot(vu, vv) / (peak || 1),
      [x, y] = P(u, v);
    if (m < 0.04) continue;
    // The field's (u, v) map to the box's pixels at different scales: angle in screen space.
    const len = cell * (0.35 + 0.65 * m),
      ang = Math.atan2(-vv * bh, vu * bw);
    arrows.push({
      type: 'line',
      x1: round(x - (Math.cos(ang) * len) / 2),
      y1: round(y - (Math.sin(ang) * len) / 2),
      x2: round(x + (Math.cos(ang) * len) / 2),
      y2: round(y + (Math.sin(ang) * len) / 2),
      stroke: 'muted',
      width: 3,
      arrow: 'end',
      head: 12,
      opacity: 0.4 + 0.5 * m,
      enter: 'fade',
      dur: 0.3,
    });
  }
  return {
    type: 'group',
    enter: 'none',
    ...show,
    stagger: 0.01,
    children: arrows,
  };
}
