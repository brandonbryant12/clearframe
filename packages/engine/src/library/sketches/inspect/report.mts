import { inspectMetrics } from './metrics.mjs';
import type { Point } from '../../../film/contracts/primitives.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { inspectView } from './view.mjs';

export function inspectReport(context: ReturnType<typeof inspectView>) {
  const { w, side, compact, labelW, cw, ch, card, lx, text, STEP, cued, O } =
    context;

  const metrics = inspectMetrics(side, compact);

  // REPORT. The view settles back square (so the steps below are drawn where they land) and the
  // marks fade; a shield pops up clear of the message (where the labels stood in a wide frame,
  // above the card in a narrow one), and the message, toolbar and all, travels into it and
  // shrinks to nothing. In a wide frame the shield pulses and a confirmation pops up in the
  // message's place beside it; in a narrow one the shield settles to the middle and the
  // confirmation pops up under it.
  const R = metrics.shieldRadius;

  const C: Point = [round(card.x + cw / 2), round(card.y + ch / 2)];

  const shieldGap = compact ? 36 : 56;
  const narrowToastWidth = Math.min(cw - 40, compact ? 820 : 880);

  const D: Point = side
    ? [round(Math.min(lx + labelW / 2, w - 120 - R)), C[1]]
    : [round(w / 2), round(Math.max(R + 40, card.y - shieldGap - R))];

  const toast = {
    x: 0,
    y: 0,
    w: side ? 780 : narrowToastWidth,
    h: metrics.toastHeight,
  };

  const toastFs = metrics.toastFont;

  const gapT = compact ? 40 : 52;

  const F: Point = side
    ? D
    : [D[0], round(C[1] - (2 * R + gapT + toast.h) / 2 + R)];

  Object.assign(toast, {
    x: round((side ? C[0] : w / 2) - toast.w / 2),
    y: side ? round(C[1] - toast.h / 2) : F[1] + R + gapT,
  });

  const tcy = round(toast.y + toast.h / 2);

  // The message leaves about the view's own origin O (which shares the card's centre line):
  // scaled to almost nothing, its centre lands on the shield's.
  const fly = 0.05;

  const leave = [
    cued(STEP.fly, {
      dur: round(STEP.land - STEP.fly),
      ease: 'inOut',
      scale: fly,
      x: round(D[0] - O[0] - fly * (C[0] - O[0])),
      y: round(D[1] - O[1] - fly * (C[1] - O[1])),
    }),
    cued(STEP.land - 0.12, { dur: 0.12, opacity: 0 }),
  ];

  // A ring that spreads from a point and fades: the press, and the message landing (in the shield).
  const ripple = (at: Point, r: number, dt: number, stroke = false) =>
    ({
      type: 'circle',
      cx: at[0],
      cy: at[1],
      r,
      ...(stroke
        ? { fill: 'none', stroke: 'positive', width: 6 }
        : { fill: 'positive' }),
      enter: 'none',
      at: 0,
      origin: at,
      keys: [
        { at: 0, dur: 0, opacity: 0 },
        cued(dt, {
          dur: 0,
          opacity: stroke ? 0.6 : 0.35,
          scale: stroke ? 1 : 0.3,
        }),
        cued(dt, {
          dur: 0.55,
          ease: 'out',
          opacity: 0,
          scale: stroke ? 1.7 : 1.5,
        }),
      ],
    }) satisfies CanvasElement;

  const shield = {
    type: 'group',
    enter: 'pop',
    dur: 0.35,
    ...cued(STEP.shield),
    origin: D,
    keys: side
      ? [cued(STEP.land, { dur: 0.4, ease: 'thereAndBack', scale: 1.14 })]
      : [
          cued(STEP.land + 0.05, {
            dur: 0.45,
            ease: 'inOut',
            x: F[0] - D[0],
            y: F[1] - D[1],
          }),
        ],
    children: [
      {
        type: 'circle',
        cx: D[0],
        cy: D[1],
        r: R,
        fill: 'positive',
        enter: 'none',
        glow: { blur: 36, opacity: 0.4 },
        shadow: { blur: 30, dy: 12, opacity: 0.18 },
      } satisfies CanvasElement,
      {
        type: 'icon',
        name: 'shield',
        x: D[0],
        y: D[1],
        size: round(R * 1.08),
        stroke: 'bg',
        enter: 'none',
      } satisfies CanvasElement,
      // The ring travels with the shield as it settles.
      ripple(D, R, STEP.land, true),
    ],
  } satisfies CanvasElement;

  const done = {
    type: 'group',
    enter: 'pop',
    dur: 0.4,
    origin: [round(toast.x + toast.w / 2), tcy],
    ...cued(side ? STEP.toast : STEP.land + 0.35),
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
        r: round(toastFs * 0.75),
        fill: 'positive',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'icon',
        name: 'check',
        x: toast.x + round(toast.h / 2),
        y: tcy,
        size: round(toastFs * 0.95),
        stroke: 'bg',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'REPORTED',
        toast.x + toast.h + 4,
        round(tcy + toastFs * 0.36),
        toastFs,
        'semibold',
        'bg',
        { fit: toast.w - toast.h - 4 - 36 },
      ),
    ],
  } satisfies CanvasElement;
  return {
    ...context,
    w,
    side,
    compact,
    STEP,
    cued,
    O,
    leave,
    ripple,
    shield,
    done,
  };
}
