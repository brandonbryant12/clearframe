import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { wasNowLayout } from './layout.mjs';
import { drawPreviousValue } from './previous.mjs';
import { drawDifferenceNote } from './note.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const {
    was = 60,
    now = 30,
    prefix = '',
    suffix = ' days',
    decimals = 0,
    note = false,
    start = 'drawn',
  } = params;
  const grow = start === 'empty';
  // The change waits for the old window when it has to grow first.
  const at = {
    ...AT,
    CHANGE: AT.CHANGE + (grow ? 1.2 : 0),
    NOTE: AT.NOTE + (grow ? 1.2 : 0),
  };
  // What is drawn from the first frame, or lands on WAS `dt` seconds in.
  const old = (dt: number) =>
    grow
      ? { cue: 'WAS', at: AT.WAS + dt, enter: 'fade', dur: 0.35 }
      : { at: 0, enter: 'none' };
  if (was === now)
    throw new Error(
      `sketchParams for was-now: was and now are both ${was}; nothing changes`,
    );
  const {
    T,
    money,
    text,
    els,
    shorter,
    x0,
    W,
    X,
    wasX,
    nowX,
    big,
    small,
    barH,
    titleSize,
    titleY,
    ty,
    above,
    below,
  } = wasNowLayout({ w, h, prefix, decimals, suffix, now, was, note });
  els.push(
    text('WHAT', x0, titleY, titleSize, 'strong', 'ink', {
      width: W,
      at: 0,
      enter: 'none',
    }),
  );
  // The old window, on screen from the first frame (or grown on WAS). When it shortens it is two overlapping
  // pills of one opaque colour, seamless until the part beyond the new end falls away.
  const r = round(barH / 2);
  const pill = (from: number, to: number, extra = {}): CanvasElement =>
    ({
      type: 'rect',
      x: from,
      y: ty,
      w: Math.max(barH, to - from),
      h: barH,
      r,
      fill: 'wash',
      at: 0,
      enter: 'none',
      ...extra,
    }) satisfies CanvasElement;
  // Grown from zero on WAS: the window sweeps out to the old end, along the empty track of
  // the whole scale that is there from the first frame.
  if (grow)
    els.push({
      type: 'rect',
      x: x0,
      y: ty,
      w: X(Math.max(was, now)) - x0,
      h: barH,
      r,
      fill: 'none',
      stroke: 'line',
      width: 2,
      at: 0,
      enter: 'none',
    } satisfies CanvasElement);
  const sweep: Partial<CanvasElement> = grow
    ? {
        origin: [x0, ty + barH / 2],
        keys: [
          { at: 0, dur: 0, scaleX: 0 },
          { cue: 'WAS', at: AT.WAS, dur: 0.8, ease: 'out', scaleX: 1 },
        ],
      }
    : {};
  drawPreviousValue({
    shorter,
    pill,
    x0,
    nowX,
    barH,
    wasX,
    at,
    els,
    grow,
    sweep,
    ty,
    r,
  });
  // The old end: a rule, its number and its label; struck on the change.
  els.push({
    type: 'line',
    x1: wasX,
    y1: ty - 14,
    x2: wasX,
    y2: ty + barH + 14,
    stroke: 'muted',
    width: 4,
    cap: 'round',
    ...old(0.7),
  } satisfies CanvasElement);
  els.push(
    text(money(was), wasX, above.amount, big, 'bold', 'ink', {
      anchor: 'end',
      ...old(0.6),
      keys: [{ cue: 'CHANGE', at: at.CHANGE + 0.3, opacity: 0.55, dur: 0.4 }],
      marks: [
        {
          words: money(was),
          style: 'strike',
          color: 'negative',
          cue: 'CHANGE',
          at: at.CHANGE + 0.2,
          dur: 0.45,
        },
      ],
    }),
  );
  els.push(
    text('WASLABEL', wasX, above.label, small, 'text', 'muted', {
      anchor: 'end',
      ...old(0.8),
    }),
  );

  // CHANGE: the window that counts now sweeps in from zero to the new end, which is ruled and
  // named below the bar.
  els.push({
    type: 'rect',
    id: 'was-now-new',
    x: x0,
    y: ty,
    w: nowX - x0,
    h: barH,
    r,
    fill: 'accent',
    enter: 'none',
    origin: [x0, ty + barH / 2],
    cue: 'CHANGE',
    at: at.CHANGE,
    keys: [
      { cue: 'CHANGE', at: at.CHANGE, dur: 0, scaleX: 0 },
      {
        cue: 'CHANGE',
        at: at.CHANGE + 0.25,
        dur: 0.9,
        ease: 'out',
        scaleX: 1,
      },
    ],
  } satisfies CanvasElement);
  els.push({
    type: 'line',
    x1: nowX,
    y1: ty - 14,
    x2: nowX,
    y2: ty + barH + 14,
    stroke: 'ink',
    width: 5,
    cap: 'round',
    enter: 'draw',
    cue: 'CHANGE',
    at: at.CHANGE + 1.0,
    dur: 0.3,
  } satisfies CanvasElement);
  // The new number sits left of its end, under the window it measures; when the window is too
  // short to hold it there, it sits just right of the end instead.
  const span = (chars: number, size: number) => chars * size * 0.56;
  const fitsLeft =
    nowX - x0 >= Math.max(span(money(now).length, big), span(14, small));
  const nowAt = fitsLeft
    ? { x: nowX, anchor: 'end' }
    : { x: nowX + 24, anchor: 'start' };
  els.push(
    text(money(now), nowAt.x, below.amount, big, 'bold', 'accent', {
      anchor: nowAt.anchor,
      enter: 'rise',
      dist: 18,
      cue: 'CHANGE',
      at: at.CHANGE + 1.05,
      dur: 0.45,
    }),
  );
  els.push(
    text('NOWLABEL', nowAt.x, below.label, small, 'strong', 'ink', {
      anchor: nowAt.anchor,
      enter: 'fade',
      cue: 'CHANGE',
      at: at.CHANGE + 1.3,
      dur: 0.4,
    }),
  );

  // NOTE: what happens in the part that changed, set in that span (below the bar where it was
  // cut, above it where it grew), or on its own line when the span is too narrow to hold it.
  drawDifferenceNote({
    note,
    shorter,
    nowX,
    wasX,
    T,
    fitsLeft,
    below,
    big,
    above,
    small,
    x0,
    W,
    els,
    text,
    at,
  });
  return { elements: els };
}
