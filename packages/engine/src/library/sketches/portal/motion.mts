import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round, tall } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { portalFields } from './fields.mjs';

export function portalMotion(context: ReturnType<typeof portalFields>) {
  const { w, h, phone, T, win, bar, item, centre, card, save, toast, vx, vy } =
    context;

  // The lean-in keeps the app's name below the top of the title-safe area and the confirmation
  // above the caption band: no larger, and no further toward the middle, than both allow.
  const appTop = win.y + bar / 2 + (phone ? 22 : 10) - 26,
    floor = h * (tall(w, h) ? 0.8 : 0.75) - 16,
    ceiling = h * (tall(w, h) ? 0.06 : 0.05) + 32;

  const lean = Math.min(
    T ? 1.18 : 1.3,
    (floor - ceiling) / (toast.y + toast.h - appTop),
  );

  const drift = Math.min(
    Math.max((h / 2 - vy) * 0.55, ceiling - vy - (appTop - vy) * lean),
    floor - vy - (toast.y + toast.h - vy) * lean,
  );

  // The cursor starts low in the window and visits each target before its click.
  const start: [number, number] = T
    ? [win.x + win.w - 160, win.y + win.h - 260]
    : [win.x + win.w - 220, win.y + win.h - 200];

  const targets: [number, number][] = [
    centre(item(1)),
    centre(card(0)),
    [vx, vy],
    centre(save),
  ];

  const move = (i: number, cue: string | null, at: number) => ({
    ...(cue ? { cue, after: 0.45 } : {}),
    at,
    dur: 0.85,
    ease: 'inOut',
    x: round(targets[i][0] - start[0] + 4),
    y: round(targets[i][1] - start[1] + 6),
  });

  const ripple = (i: number, cue: keyof typeof AT): CanvasElement =>
    ({
      type: 'circle',
      cx: targets[i][0],
      cy: targets[i][1],
      r: 46,
      fill: 'accent',
      enter: 'none',
      at: 0,
      origin: targets[i],
      // Keys multiply the element's own opacity, so the ripple starts hidden by a key, not by
      // `opacity: 0` (which no key could lift).
      keys: [
        { at: 0, dur: 0, opacity: 0 },
        { cue, at: AT[cue], dur: 0, opacity: 0.35, scale: 0.3 },
        { cue, at: AT[cue], dur: 0.55, ease: 'out', opacity: 0, scale: 1.5 },
      ],
    }) satisfies CanvasElement;

  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;
  return {
    ...context,
    w,
    phone,
    T,
    win,
    bar,
    item,
    centre,
    card,
    save,
    toast,
    vx,
    vy,
    lean,
    drift,
    start,
    move,
    ripple,
    text,
  };
}
