import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeIcons } from './icons.mjs';

export function composeWindow(context: ReturnType<typeof composeIcons>) {
  const { phone, text, k, s, win, inner, corner, bar, ui } = context;

  // The window: a desktop's title bar or a phone's bezel, notch and app bar.
  ui.push({
    type: 'rect',
    ...win,
    r: corner,
    fill: 'surface',
    stroke: phone ? 'ink' : 'line',
    width: phone ? round(10 * k) : 2,
    enter: 'none',
  } satisfies CanvasElement);

  if (phone) {
    ui.push({
      type: 'rect',
      x: round(win.x + win.w / 2 - 64 * k),
      y: win.y + round(18 * k),
      w: round(128 * k),
      h: round(16 * k),
      r: round(8 * k),
      fill: 'ink',
      enter: 'none',
    } satisfies CanvasElement);
    ui.push(
      text(
        'Cancel',
        inner.x,
        bar.y + bar.h / 2 + s.label * 0.36,
        s.label,
        'semibold',
        'muted',
      ),
    );
    ui.push(
      text(
        'New message',
        win.x + win.w / 2,
        bar.y + bar.h / 2 + s.value * 0.36,
        s.value,
        'bold',
        'ink',
        { anchor: 'middle', fit: round(inner.w - 2 * (s.label * 3.4 + 20)) },
      ),
    );
    ui.push({
      type: 'rect',
      x: round(win.x + win.w / 2 - 70 * k),
      y: win.y + win.h - round(24 * k),
      w: round(140 * k),
      h: round(8 * k),
      r: round(4 * k),
      fill: 'muted',
      opacity: 0.5,
      enter: 'none',
    } satisfies CanvasElement);
  } else {
    ui.push({
      type: 'rect',
      x: win.x,
      y: win.y,
      w: win.w,
      h: bar.h,
      r: corner,
      fill: 'bg',
      enter: 'none',
    } satisfies CanvasElement);
    ui.push({
      type: 'rect',
      x: win.x,
      y: win.y + bar.h - corner,
      w: win.w,
      h: corner,
      fill: 'bg',
      enter: 'none',
    } satisfies CanvasElement);
    [0, 1, 2].forEach((i) =>
      ui.push({
        type: 'circle',
        cx: win.x + 34 + i * 26,
        cy: round(bar.y + bar.h / 2),
        r: 8,
        fill: 'line',
        enter: 'none',
      } satisfies CanvasElement),
    );
    ui.push(
      text(
        'New message',
        win.x + win.w / 2,
        bar.y + bar.h / 2 + 28 * k * 0.36,
        28 * k,
        'semibold',
        'muted',
        { anchor: 'middle', fit: win.w - 240 },
      ),
    );
  }

  ui.push({
    type: 'line',
    x1: win.x,
    y1: bar.y + bar.h,
    x2: win.x + win.w,
    y2: bar.y + bar.h,
    stroke: 'line',
    width: 2,
    enter: 'none',
  } satisfies CanvasElement);
  return { ...context, phone, text, k, s, win, inner, ui };
}
