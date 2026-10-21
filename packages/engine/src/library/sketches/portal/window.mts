import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { PortalContext } from './contracts.mjs';
export function portalWindow(context: PortalContext): CanvasElement[] {
  const { phone, T, win, corner, bar, nav, text } = context;
  return [
    {
      type: 'rect',
      ...win,
      r: corner,
      fill: 'surface',
      stroke: phone ? 'ink' : 'line',
      width: phone ? 10 : 2,
      enter: 'none',
    } satisfies CanvasElement,

    {
      type: 'rect',
      x: win.x,
      y: win.y,
      w: win.w,
      h: bar,
      r: corner,
      fill: 'bg',
      enter: 'none',
    } satisfies CanvasElement,

    {
      type: 'rect',
      x: win.x,
      y: win.y + bar - 24,
      w: win.w,
      h: 24,
      fill: 'bg',
      enter: 'none',
    } satisfies CanvasElement,

    {
      type: 'line',
      x1: win.x,
      y1: win.y + bar,
      x2: win.x + win.w,
      y2: win.y + bar,
      stroke: 'line',
      width: 2,
      enter: 'none',
    } satisfies CanvasElement,

    ...(phone
      ? [
          {
            type: 'rect',
            x: round(win.x + win.w / 2 - 60),
            y: win.y + 14,
            w: 120,
            h: 14,
            r: 7,
            fill: 'ink',
            enter: 'none',
          } satisfies CanvasElement,
        ]
      : [0, 1, 2].map(
          (i): CanvasElement =>
            ({
              type: 'circle',
              cx: win.x + 36 + i * 26,
              cy: win.y + bar / 2,
              r: 8,
              fill: 'line',
              enter: 'none',
            }) satisfies CanvasElement,
        )),

    text(
      'APP',
      round(win.x + win.w / 2),
      win.y + bar / 2 + (phone ? 22 : 10),
      28,
      'semibold',
      'muted',
      { anchor: 'middle', fit: win.w - 120, enter: 'none' },
    ),

    T
      ? ({
          type: 'line',
          x1: nav.x,
          y1: nav.y + nav.h,
          x2: nav.x + nav.w,
          y2: nav.y + nav.h,
          stroke: 'line',
          width: 2,
          enter: 'none',
        } satisfies CanvasElement)
      : ({
          type: 'rect',
          x: nav.x,
          y: nav.y,
          w: nav.w,
          h: nav.h - 24,
          fill: 'bg',
          enter: 'none',
        } satisfies CanvasElement),
  ];
}
