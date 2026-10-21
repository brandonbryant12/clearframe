import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round, smoothPath } from '../../../film/sketch-kit.mjs';

import type { holdLock } from './lock.mjs';

export function holdMarket(context: ReturnType<typeof holdLock>) {
  const {
    steps,
    AT,
    x0,
    x1,
    top,
    axisY,
    lockY,
    lowY,
    pts,
    cued,
    els,
    phases,
    tip,
    recede,
    iL,
    xs,
    lockDraw,
    share,
    lockLine,
  } = context;

  // The float-down: the lock's tail steps down to the low, over a trace of the old level.
  if (steps) {
    const { dt } = tip(required(iL, 'float-down sample'));
    const drop = {
      cue: 'FALL',
      at: round(required(AT.FALL, 'fall moment') + dt + 0.15),
      after: round(dt + 0.15),
      dur: 0.55,
      ease: 'inOut',
      y: round(lowY - lockY),
    };
    els.push({
      type: 'line',
      x1: xs,
      y1: lockY,
      x2: x1,
      y2: lockY,
      stroke: 'accent',
      width: 3,
      dash: [10, 10],
      opacity: 0.45,
      enter: 'fade',
      dur: 0.3,
      ...cued('FALL', round(dt + 0.15)),
    } satisfies CanvasElement);
    els.push({
      type: 'line',
      x1: xs,
      y1: lockY,
      x2: xs,
      y2: lowY,
      stroke: 'accent',
      width: 7,
      cap: 'round',
      enter: 'draw',
      drawEase: 'linear',
      dur: 0.55,
      ...cued('FALL', round(dt + 0.15)),
    } satisfies CanvasElement);
    els.push({
      type: 'line',
      x1: xs,
      y1: lockY,
      x2: x1,
      y2: lockY,
      ...lockLine,
      dur: round(lockDraw * (1 - share)),
      ...cued('LOCK', round(0.15 + lockDraw * share)),
      keys: [drop],
    } satisfies CanvasElement);
  }

  // The market: one stroke per phase, with a dot riding each tip; the last dot stays at the end.
  phases.forEach((p, k) => {
    const seg = pts.slice(p.from, p.to + 1);
    const d = smoothPath(seg);
    els.push({
      type: 'path',
      d,
      fill: 'none',
      stroke: 'accent2',
      width: 5,
      cap: 'butt',
      join: 'round',
      enter: 'draw',
      drawEase: 'linear',
      dur: p.dur,
      ...cued(p.cue, p.delay),
      keys: [recede()],
    } satisfies CanvasElement);
    const next = phases[k + 1];
    els.push({
      type: 'circle',
      cx: seg[0][0],
      cy: seg[0][1],
      r: 10,
      fill: 'accent2',
      stroke: 'bg',
      width: 3,
      enter: 'fade',
      dur: 0.15,
      ...cued(p.cue, p.delay),
      along: { d, ease: 'linear', dur: p.dur, ...cued(p.cue, p.delay) },
      keys: next
        ? [{ cue: next.cue, at: cued(next.cue, 0).at, dur: 0.15, opacity: 0 }]
        : [recede()],
    } satisfies CanvasElement);
  });

  // The window closes: its end drawn solid.
  els.push({
    type: 'line',
    x1,
    y1: top - 40,
    x2: x1,
    y2: axisY,
    stroke: 'ink',
    width: 4,
    cap: 'round',
    enter: 'draw',
    dur: 0.6,
    ...cued('END', 0),
  } satisfies CanvasElement);

  // Both lines start from one point.
  els.push({
    type: 'circle',
    cx: x0,
    cy: lockY,
    r: 11,
    fill: 'ink',
    stroke: 'bg',
    width: 3,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  return {
    ...context,
    steps,
    AT,
    x0,
    x1,
    lockY,
    lowY,
    pts,
    cued,
    els,
    phases,
    tip,
    recede,
    iL,
    xs,
  };
}
