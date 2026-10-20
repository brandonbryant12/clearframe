import type { Rectangle } from '.././drawing/contracts.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { clipPath, planePath } from './common.mjs';
import type { composeRows } from './rows.mjs';

export function composeIcons(context: ReturnType<typeof composeRows>) {
  const { text, k, s, centre } = context;

  // A toolbar button: its icon over its label, both centred, so any word sits right in it.
  const tileFace = (
    r: Rectangle,
    label: string,
    icon: (cx: number, cy: number, color: string) => CanvasElement,
    color: string,
  ): CanvasElement[] => {
    const [cx] = centre(r);
    const iy = round(r.y + r.h * 0.36),
      ly = round(r.y + r.h * 0.8);
    return [
      icon(cx, iy, color),
      text(label, cx, ly, s.tileFs, 'semibold', color, {
        anchor: 'middle',
        fit: r.w - 28,
      }),
    ];
  };

  const clipIcon = (cx: number, cy: number, color: string) =>
    ({
      type: 'path',
      d: clipPath(cx, cy, s.icon),
      fill: 'none',
      stroke: color,
      width: round(2.6 * k),
      cap: 'round',
      join: 'round',
      enter: 'none',
      rotate: 40,
      origin: [cx, cy],
    }) satisfies CanvasElement;

  const lockIcon = (cx: number, cy: number, color: string) =>
    ({
      type: 'icon',
      name: 'lock',
      x: cx,
      y: cy,
      size: s.icon,
      stroke: color,
      enter: 'none',
    }) satisfies CanvasElement;

  const planeIcon = (cx: number, cy: number, color: string, size = s.icon) =>
    ({
      type: 'path',
      d: planePath(cx, cy, size * 0.9),
      fill: 'none',
      stroke: color,
      width: round(2.6 * k),
      cap: 'round',
      join: 'round',
      enter: 'none',
    }) satisfies CanvasElement;

  const ui: CanvasElement[] = [];
  return {
    ...context,
    text,
    k,
    s,
    centre,
    tileFace,
    clipIcon,
    lockIcon,
    planeIcon,
    ui,
  };
}
