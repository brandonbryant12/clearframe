import type { ElementKey } from '../../../film/contracts/canvas-effects.mjs';
import type { Point } from '../../../film/contracts/primitives.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp, round } from '../../../film/sketch-kit.mjs';
import { cursorPath } from './common.mjs';
import type { composeLink } from './link.mjs';

export function composeFinish(
  context: ReturnType<typeof composeLink>,
): SketchDrawing {
  const {
    expires,
    send,
    phone,
    cued,
    text,
    k,
    s,
    win,
    toast,
    tb,
    oldTile,
    newTile,
    centre,
    ui,
    ncx,
    ncy,
    sendAt,
  } = context;

  // The confirmation.
  if (toast) {
    const [tcx, tcy] = centre(toast);
    ui.push({
      type: 'group',
      enter: 'pop',
      dur: 0.4,
      origin: [tcx, tcy],
      ...cued('SEND', 0.35),
      children: [
        {
          type: 'rect',
          ...toast,
          r: round(toast.h / 2),
          fill: 'ink',
          enter: 'none',
          shadow: { blur: 24, dy: 10, opacity: 0.18 },
        } satisfies CanvasElement,
        {
          type: 'circle',
          cx: toast.x + round(toast.h / 2),
          cy: tcy,
          r: round(s.toastFs * 0.72),
          fill: 'positive',
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'icon',
          name: 'check',
          x: toast.x + round(toast.h / 2),
          y: tcy,
          size: round(s.toastFs * 0.9),
          stroke: 'bg',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'DONE',
          toast.x + toast.h + 6,
          tcy + s.toastFs * 0.36,
          s.toastFs,
          'semibold',
          'bg',
          { fit: toast.w - toast.h - 6 - 32 },
        ),
      ],
    } satisfies CanvasElement);
  }

  // A ring where a press lands.
  const ripple = (at: Point, cue: string) =>
    ({
      type: 'circle',
      cx: at[0],
      cy: at[1],
      r: round(48 * k),
      fill: 'accent',
      enter: 'none',
      at: 0,
      origin: at,
      keys: [
        { at: 0, dur: 0, opacity: 0 },
        cued(cue, 0, { dur: 0, opacity: 0.35, scale: 0.3 }),
        cued(cue, 0, { dur: 0.55, ease: 'out', opacity: 0, scale: 1.5 }),
      ],
    }) satisfies CanvasElement;

  // The strike through the old button: drawn by hand, so it keeps the film's own line.
  const strike = {
    type: 'path',
    d: `M ${oldTile.x - 8} ${round(oldTile.y + oldTile.h * 0.78)} C ${round(oldTile.x + oldTile.w * 0.3)} ${round(oldTile.y + oldTile.h * 0.62)} ${round(oldTile.x + oldTile.w * 0.62)} ${round(oldTile.y + oldTile.h * 0.42)} ${oldTile.x + oldTile.w + 8} ${round(oldTile.y + oldTile.h * 0.2)}`,
    fill: 'none',
    stroke: 'negative',
    width: round(7 * k),
    cap: 'round',
    enter: 'draw',
    dur: 0.4,
    ...cued('OLD', 0.1),
  } satisfies CanvasElement;

  // The pointer (a fingertip on a phone): it rests on the old button, moves to the new one and
  // presses it, steps aside while the file goes up, then presses Send (or leaves).
  const [ocx, ocy] = centre(oldTile);

  const start: Point = phone
    ? [ocx + round(40 * k), ocy - round(150 * k)]
    : [ocx + round(260 * k), tb.y - round(120 * k)];

  // Out of the way: beside the toolbar's last button when the window has room there, else just above it.
  let rest: Point;
  if (phone) rest = [ncx + round(90 * k), tb.y - round(70 * k)];
  else if (win.x + win.w - (newTile.x + newTile.w) > 200 * k)
    rest = [newTile.x + newTile.w + round(110 * k), ncy + round(20 * k)];
  else rest = [round(newTile.x + newTile.w * 0.7), tb.y - round(64 * k)];

  const to = ([x, y]: Point, extra: ElementKey = {}) => ({
    dur: 0.6,
    ease: 'inOut',
    x: round(x - start[0] + (phone ? 0 : 6)),
    y: round(y - start[1] + (phone ? 0 : 8)),
    ...extra,
  });

  const last = expires ? 'EXPIRES' : 'LINK';

  const pointer: CanvasElement = {
    ...(phone
      ? ({
          type: 'circle',
          cx: start[0],
          cy: start[1],
          r: round(32 * k),
          fill: 'ink',
          opacity: 0.28,
          stroke: 'surface',
          width: 3,
        } satisfies CanvasElement)
      : ({
          type: 'path',
          d: cursorPath(start[0], start[1], 1.15 * k),
          fill: 'ink',
          stroke: 'surface',
          width: 3,
          join: 'round',
        } satisfies CanvasElement)),
    enter: 'fade',
    at: 0.15,
    dur: 0.3,
    keys: [
      { at: 0.3, ...to([ocx, ocy], { dur: 0.75 }) },
      cued('OLD', 0.2, to([ncx, ncy], { dur: 0.5 })),
      cued('NEW', 0.45, to(rest)),
      ...(send
        ? [
            cued(last, 0.35, to(sendAt, { dur: 0.7 })),
            cued('SEND', 0.7, { dur: 0.3, opacity: 0 }),
          ]
        : [cued(last, 0.5, { dur: 0.35, opacity: 0 })]),
    ],
  };

  return {
    elements: [
      ...crisp([
        {
          type: 'group',
          enter: 'none',
          at: 0,
          shadow: { blur: 48, dy: 24, opacity: 0.2 },
          origin: centre(win),
          keys: [
            { at: 0, dur: 0, scale: 0.985 },
            { at: 0, dur: 1.2, ease: 'out', scale: 1 },
          ],
          children: ui,
        } satisfies CanvasElement,
        ripple([ncx, ncy], 'NEW'),
        ...(send ? [ripple(sendAt, 'SEND')] : []),
      ]),
      strike,
      ...crisp([pointer]),
    ],
  };
}
