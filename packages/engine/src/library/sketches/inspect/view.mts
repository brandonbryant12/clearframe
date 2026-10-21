import type { Point } from '../../../film/contracts/primitives.mjs';

import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES, AT } from './common.mjs';
import type { inspectMarks } from './marks.mjs';

export function inspectView(context: ReturnType<typeof inspectMarks>) {
  const {
    w,
    h,
    T,
    b,
    side,
    labelW,
    cw,
    callout,
    ch,
    card,
    lx,
    ringOf,
    cardEls,
    right,
  } = context;

  // The view leans in on each mark: a slight push about the annotation, kept inside the body.
  const O: Point = [round(w / 2), round(card.y + ch / 2)];

  const box = {
    x1: card.x - 10,
    y1: card.y - 10,
    x2: side ? Math.min(right, lx + labelW) : card.x + cw + 10,
    y2: card.y + ch + 30,
  };

  const room = side
    ? { x1: 90, y1: 290, x2: w - 90, y2: h - 140 }
    : {
        x1: 24,
        y1: T ? b.y - 160 : 150,
        x2: w - 24,
        y2: T ? b.y + b.h + 80 : h - 110,
      };

  const scale = side ? 1.06 : 1.03;

  const clamp = (v: number, lo: number, hi: number) =>
    lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));

  const lean = (part: string | undefined, i: number) => {
    const r = ringOf(required(part, 'marked part'));
    const F: Point = side
      ? [(r.x + box.x2) / 2, r.y + r.h / 2]
      : [w / 2, r.y + r.h / 2 + callout / 2];
    const C: Point = [w / 2, (room.y1 + room.y2) / 2];
    const after = (v: number, o: number) => o + scale * (v - o);
    const dx = clamp(
      (1 - scale) * (F[0] - O[0]) + 0.12 * (C[0] - F[0]),
      room.x1 - after(box.x1, O[0]),
      room.x2 - after(box.x2, O[0]),
    );
    const dy = clamp(
      (1 - scale) * (F[1] - O[1]) + 0.12 * (C[1] - F[1]),
      room.y1 - after(box.y1, O[1]),
      room.y2 - after(box.y2, O[1]),
    );
    return {
      cue: NAMES[i],
      at: AT[NAMES[i]],
      dur: 1.0,
      ease: 'inOut',
      scale,
      x: round(dx),
      y: round(dy),
    };
  };

  const cardGroup = {
    type: 'group',
    enter: 'rise',
    cue: 'OPEN',
    at: AT.OPEN,
    dur: 0.6,
    dist: 40,
    children: cardEls,
  } satisfies CanvasElement;
  return {
    ...context,
    w,
    h,
    side,
    labelW,
    cw,
    ch,
    card,
    lx,
    O,
    lean,
    cardGroup,
  };
}
