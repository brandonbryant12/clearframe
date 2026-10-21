import { round } from '../../../film/sketch-kit.mjs';

import type { weekBase } from './base.mjs';
export function weekAgendaLayout(context: ReturnType<typeof weekBase>) {
  const { w, h, days, today, due, after, byDay } = context;

  // Rows: an agenda down the frame, sized up to fill it, the consequence under the week.
  const X0 = round(w * 0.078),
    X1 = w - X0;

  const Y0 = round(h * 0.17),
    Y1 = h - Math.max(130, round(h * 0.13));

  let kMax = 1;
  if (h > w * 1.5) kMax = 1.3;
  else if (h > w * 1.1) kMax = 1.12;

  const labW = round((X1 - X0) * 0.24),
    labX = X0 + labW / 2;

  const lane = { x: X0 + labW + 22, r: X1 - 24, w: 0 };

  lane.w = lane.r - lane.x;

  // Everything scales with k; type (and what holds it) never drops below what a phone reads.
  const sz = (base: number, k: number, floor = 0) => Math.max(floor, base * k);

  const sizes = (k: number) => ({
    day: sz(40, k, 28),
    cardH: sz(92, k, 58),
    fs: sz(36, k, 26),
    cb: sz(30, k, 22),
    pillH: sz(62, k, 44),
    pfs: sz(32, k, 24),
    todayH: sz(46, k, 36),
    tfs: sz(27, k, 23),
    tgap: 14 * k,
    pad: 16 * k,
    gap: 12 * k,
    minRow: sz(84, k, 52),
    afterH: sz(108, k, 64),
    afterGap: 76 * k,
    afs: sz(34, k, 25),
  });

  const laneH = (d: number, s: ReturnType<typeof sizes>) =>
    byDay[d].length * s.cardH +
    (d === due ? s.pillH : 0) +
    Math.max(0, byDay[d].length + (d === due ? 1 : 0) - 1) * s.gap;

  const labH = (d: number, s: ReturnType<typeof sizes>) =>
    s.day * 1.1 + (d === today ? s.tgap + s.todayH : 0);

  const need = (d: number, s: ReturnType<typeof sizes>) =>
    Math.max(s.minRow, Math.max(laneH(d, s), labH(d, s)) + 2 * s.pad);

  const total = (s: ReturnType<typeof sizes>) =>
    byDay.reduce((sum, _, d) => sum + need(d, s), 24) +
    (after ? s.afterGap + s.afterH : 0);

  // As large as the frame allows (up to kMax), then the rows share what is left.
  let k = kMax;

  while (k > 0.5 && total(sizes(k)) > Y1 - Y0)
    k = Math.round((k - 0.02) * 100) / 100;

  const s = sizes(k);

  // A crowded week (seven days, a full day and an after card in a square) rises into the
  // space a title would use rather than shrinking its type further.
  const Y = Math.max(round(h * 0.06), Math.min(Y0, Y1 - total(s)));

  const grow = Math.max(0, Math.min((Y1 - Y - total(s)) / days, s.cardH * 0.8));

  const rowH = byDay.map((_, d) => round(need(d, s) + grow));

  const card = {
    y: 0,
    x: X0,
    w: X1 - X0,
    h: rowH.reduce((a, b) => a + b, 24),
  };

  const used = card.h + (after ? s.afterGap + s.afterH : 0);

  card.y = round(Y + Math.max(0, (Y1 - Y - used) / 2));

  const rowY: number[] = [];

  rowH.reduce((y, rh) => (rowY.push(y), y + rh), card.y + 12);

  const rowC = (d: number) => rowY[d] + rowH[d] / 2;
  return {
    ...context,
    today,
    due,
    after,
    byDay,
    X0,
    X1,
    labW,
    labX,
    lane,
    laneH,
    labH,
    k,
    s,
    rowH,
    card,
    rowY,
    rowC,
  };
}
