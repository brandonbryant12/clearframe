import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round, tall } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { coinDrawing } from './coins.mjs';
import { matchDrawing } from './drawing.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const you = params.you ?? 5,
    match = params.match ?? 4,
    suffix = params.suffix ?? '%';
  // What if: the picture opens on the current state (fromYou, fromMatch) and only the coins
  // the change adds drop in on their words, so one beat shows the before and the after.
  const fromYou = Math.min(params.fromYou ?? 0, you),
    fromMatch = Math.min(params.fromMatch ?? 0, match),
    again = params.again ?? 0;
  // Today's coins drop on their own words first, and the rest of the beat follows them.
  const grow = params.start === 'empty' && (fromYou > 0 || fromMatch > 0);
  const M = grow
    ? {
        ...AT,
        YOU: AT.YOU + 1.6,
        MATCH: AT.MATCH + 1.6,
        TOTAL: AT.TOTAL + 1.6,
        AGAIN: AT.AGAIN + 1.6,
      }
    : AT;
  const T = tall(w, h);
  const rx = T ? 190 : 150,
    ry = T ? 50 : 40,
    t = T ? 34 : 32,
    step = t + 10;
  const base = T ? 1300 : 760;
  const gap = T ? 430 : 520;
  const [x1, x2] = [round(w / 2 - gap / 2), round(w / 2 + gap / 2)];
  // When the stacks merge, both travel to the middle and the company's coins sit on yours.
  const mid = round(w / 2);
  const coin = (
    x: number,
    i: number,
    fill: string,
    at: number,
    cue: 'YOU' | 'MATCH',
    ready = false,
  ): CanvasElement => {
    const y = round(base - i * step);
    return coinDrawing({ ready, grow, cue, M, i, at, x, y, t, rx, ry, fill });
  };

  const yours = Array.from({ length: you }, (_, i) =>
    coin(
      x1,
      i,
      'accent',
      round(M.YOU + Math.max(0, i - fromYou) * 0.14),
      'YOU',
      i < fromYou,
    ),
  );
  const theirs = Array.from({ length: match }, (_, i) =>
    coin(
      x2,
      i,
      'accent2',
      round(M.MATCH + Math.max(0, i - fromMatch) * 0.14),
      'MATCH',
      i < fromMatch,
    ),
  );
  // The count above a stack: the current one from the first frame, the new one on its word.
  const counts = (
    x: number,
    from: number,
    to: number,
    prefix: string,
    fill: string,
    cue: 'YOU' | 'MATCH',
  ) => {
    const landed = round((to - from) * 0.14 + 0.2);
    const now = {
      enter: 'rise',
      cue,
      at: round(M[cue] + landed),
      after: landed,
      exit: 'fade',
      exitCue: 'TOTAL',
      exitAt: M.TOTAL,
      exitDur: 0.25,
    };
    if (!from || from === to)
      return [
        label(`${prefix}${to}${suffix}`, x, top(to), 64, 'bold', fill, now),
      ];
    return [
      label(`${prefix}${from}${suffix}`, x, top(from), 64, 'bold', fill, {
        ...(grow
          ? {
              enter: 'rise',
              cue: `NOW${cue}`,
              at: round(M[`NOW${cue}`] + from * 0.14 + 0.2),
              after: round(from * 0.14 + 0.2),
            }
          : { enter: 'fade', at: 0.2 }),
        exit: 'fade',
        exitCue: cue,
        exitAt: M[cue],
        exitDur: 0.2,
      }),
      label(`${prefix}${to}${suffix}`, x, top(to), 64, 'bold', fill, now),
    ];
  };
  const top = (n: number) => round(base - Math.max(n - 1, 0) * step - ry - 40);
  const label = (
    text: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text,
      x,
      y,
      size,
      font,
      fill,
      anchor: 'middle',
      ...extra,
    }) satisfies CanvasElement;
  const merge = { cue: 'TOTAL', at: M.TOTAL, dur: 1.1, ease: 'inOut' };
  const total = you + match;
  return matchDrawing({
    mid,
    base,
    t,
    gap,
    rx,
    ry,
    x1,
    x2,
    M,
    merge,
    yours,
    counts,
    fromYou,
    you,
    step,
    theirs,
    fromMatch,
    match,
    label,
    total,
    suffix,
    top,
    w,
    again,
    T,
  });
}
