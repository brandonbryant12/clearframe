import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { MONTHS, DAY, ymd, short } from './common.mjs';
import type { drawdownLayout } from './layout.mjs';

export function drawdownAxis(context: ReturnType<typeof drawdownLayout>) {
  const {
    from,
    to,
    cued,
    F,
    wordsW,
    text,
    L,
    R,
    x0,
    x1,
    X,
    titleY,
    subY,
    Y0,
    axisY,
  } = context;

  const els: CanvasElement[] = [];

  // The title and what the line measures, there from the first frame.
  els.push(
    text('TITLE', L, titleY, F.title, 'bold', 'ink', {
      fit: round(R - L),
      enter: 'none',
      at: 0,
    }),
  );

  els.push(
    text('SUBTITLE', L, subY, F.sub, 'regular', 'muted', {
      fit: round(R - L),
      enter: 'none',
      at: 0,
    }),
  );

  // OPEN: the axis draws, its months land left to right, the 0% line runs across; then the start
  // point lands with its day.
  els.push({
    type: 'line',
    x1: x0,
    y1: Y0,
    x2: x1,
    y2: Y0,
    stroke: 'ink',
    width: 3,
    opacity: 0.4,
    cap: 'round',
    enter: 'draw',
    dur: 0.9,
    ...cued('OPEN'),
  } satisfies CanvasElement);

  els.push({
    type: 'line',
    x1: x0,
    y1: axisY,
    x2: x1,
    y2: axisY,
    stroke: 'line',
    width: 3,
    cap: 'round',
    enter: 'draw',
    dur: 0.9,
    ...cued('OPEN'),
  } satisfies CanvasElement);

  // Ticks at the axis's ends and at every month start in between; a month's name sits under
  // its first day, thinned when months are narrow, and kept clear of the end's date.
  const tickY = round(axisY + F.tick * 1.35);

  const firstLabel = ymd(from)[2] === 1 ? MONTHS[ymd(from)[1]] : short(from),
    endLabel = short(to);

  const crossYear = ymd(from)[0] !== ymd(to)[0];

  const months = [];

  for (let m = ymd(from)[1] + 1, y = ymd(from)[0]; ; m++) {
    const d = Date.UTC(y, m, 1) / DAY;
    if (d >= to) break;
    months.push(d);
  }

  const monthPx = ((x1 - x0) * 30.4) / (to - from);

  const every = Math.max(
    1,
    Math.ceil((wordsW(crossYear ? 8 : 3, F.tick) + 40) / monthPx),
  );

  const tick = (x: number, delay: number | undefined) =>
    ({
      type: 'line',
      x1: x,
      y1: axisY,
      x2: x,
      y2: axisY + 12,
      stroke: 'line',
      width: 3,
      enter: 'fade',
      dur: 0.3,
      ...cued('OPEN', delay),
    }) satisfies CanvasElement;

  els.push(tick(x0, 0.15), tick(x1, 0.6));

  els.push(
    text(firstLabel, x0, tickY, F.tick, 'regular', 'muted', {
      enter: 'fade',
      dur: 0.4,
      ...cued('OPEN', 0.15),
    }),
  );

  const endW = wordsW(endLabel.length, F.tick),
    firstW = wordsW(firstLabel.length, F.tick);

  months.forEach((d, i) => {
    const x = X(d),
      [y, m] = ymd(d),
      label = crossYear && m === 0 ? `Jan ${y}` : MONTHS[m],
      half = wordsW(label.length, F.tick) / 2;
    els.push(tick(x, round(0.15 + (0.45 * (x - x0)) / (x1 - x0))));
    if (
      (i + 1) % every === 0 &&
      x - half > x0 + firstW + 24 &&
      x + half < x1 - endW - 24
    )
      els.push(
        text(label, x, tickY, F.tick, 'regular', 'muted', {
          anchor: 'middle',
          enter: 'fade',
          dur: 0.4,
          ...cued('OPEN', round(0.15 + (0.45 * (x - x0)) / (x1 - x0))),
        }),
      );
  });

  els.push(
    text(endLabel, x1, tickY, F.tick, 'semibold', 'ink', {
      anchor: 'end',
      enter: 'fade',
      dur: 0.4,
      ...cued('OPEN', 0.6),
    }),
  );
  return { ...context, cued, F, wordsW, text, L, R, Y0, axisY, els };
}
