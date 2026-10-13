import { body, round } from '../../film/sketch-kit.mjs';

// A window on a calendar: a month card draws, the opening day is marked, the open window sweeps
// across the weeks to the last day, which is circled as if by hand, and the days outside the
// window fall back. An optional "today" ring shows where the viewer stands. A key beside the
// card (below it in tall frames) says what each mark means. The month's length, its first
// weekday and the window come from sketchParams. Moments: OPEN, CLOSE (and TODAY when set).
const AT = { OPEN: 1.0, CLOSE: 2.9, TODAY: 4.5 };
const WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export default {
  name: 'deadline',
  keep: true,
  // Weekday headers are real words: replace them only to shorten or translate.
  keepText: WEEK,
  // Today's ring stands on its own: it may land before the window opens or after it closes.
  freeMoments: ['TODAY'],
  order: 93,
  summary:
    'A window on a calendar: the month draws, the opening day is marked, the window sweeps across the weeks to the last day, which is circled by hand, and the days outside it fall back. Optional "today" ring; a key says what each mark means.',
  use: 'Open enrollment, an election or claim window, a filing deadline, a grace period: "enrollment opens November 4 and closes the 18th". Set the month and window with sketchParams {days, firstWeekday, start, end, today} (today 0 = none); replace MONTH (e.g. "November 2027"), OPENS (e.g. "Enrollment opens"), CLOSES (e.g. "Last day to choose") and, with a today, TODAY (e.g. "Today") with sketchText; SUN … SAT are the weekday headers (keep them, shorten them or translate them). Land OPEN, CLOSE and, with a today, TODAY on words with sketchSay. The dates need a visible source.',
  params: {
    days: { default: 30, min: 28, max: 31, integer: true, figure: false, about: 'days in the month' },
    firstWeekday: { default: 1, min: 0, max: 6, integer: true, figure: false, about: 'weekday of the 1st, 0 = Sunday … 6 = Saturday' },
    start: { default: 4, min: 1, max: 31, integer: true, about: 'first day of the window' },
    end: { default: 18, min: 1, max: 31, integer: true, about: 'last day of the window (circled)' },
    today: { default: 0, min: 0, max: 31, integer: true, about: 'a day to mark as today, or 0 for none' },
  },
  build(w, h, { params = {} } = {}) {
    const { days = 30, firstWeekday = 1, start = 4, end = 18, today = 0 } = params;
    if (end < start) throw new Error(`sketchParams.end for deadline must not come before start (got ${start}–${end})`);
    if (end > days || today > days) throw new Error(`sketchParams for deadline: end and today must fall in a ${days}-day month`);
    const rows = Math.ceil((firstWeekday + days) / 7);
    const b = body(w, h);
    // Tall frames stack the key under the card; others set it beside the card.
    const stacked = h > w * 1.5;
    const small = !stacked && w < 1400;
    const pad = stacked ? 30 : 24;
    // Cells as large as the frame allows: rows share the body's height, so a five-week month
    // gets taller rows than a six-week one.
    const headH = stacked ? 172 : small ? 124 : 136;
    const cw = stacked ? round((w - 172 - 2 * pad) / 7) : small ? 64 : 116;
    const ch = stacked ? 92 : small ? 60 : Math.min(86, Math.floor((b.h - 4 - headH - pad) / rows));
    const card = { w: round(7 * cw + 2 * pad), h: headH + rows * ch + pad };
    const keys = today ? 3 : 2;
    const keyGap = stacked ? 104 : small ? 100 : 128;
    const gap = small ? 40 : 70;
    const keyW = stacked ? card.w : small ? w - 240 - card.w - gap : 560;
    if (stacked) Object.assign(card, { x: round((w - card.w) / 2), y: round(b.y + Math.max(10, (b.h - card.h - 76 - (keys - 1) * keyGap - 40) / 2)) });
    else Object.assign(card, { x: round((w - (card.w + gap + keyW)) / 2), y: round(b.y + (b.h - card.h) / 2) });
    const key = stacked
      ? { x: card.x + 44, y: card.y + card.h + 76 }
      : { x: card.x + card.w + gap, y: round(card.y + card.h / 2 - ((keys - 1) * keyGap) / 2) };
    const size = stacked ? 36 : small ? 28 : 34;
    const R = round(Math.min(cw, ch) / 2 - 3);
    const cell = d => {
      const i = firstWeekday + d - 1;
      return [round(card.x + pad + (i % 7) * cw + cw / 2), round(card.y + headH + Math.floor(i / 7) * ch + ch / 2)];
    };
    const text = (t, x, y, sz, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size: sz, font, fill, ...extra });
    const num = (d, fill, extra = {}) => text(String(d), cell(d)[0], round(cell(d)[1] + size * 0.36), size, 'semibold', fill, { anchor: 'middle', ...extra });
    const cued = (cue, dt, extra = {}) => ({ cue, at: round(AT[cue] + dt), after: dt, ...extra });
    // A loop of marker round a day, drawn a little past a full turn as a hand would.
    const ring = (x, y, r) => {
      const pts = [];
      for (let a = 0; a <= 1.12; a += 0.04) {
        const t = (-0.32 + a) * 2 * Math.PI;
        const rr = r + 4 * a;
        pts.push(`${round(x + rr * Math.cos(t))} ${round(y + rr * Math.sin(t) * 0.94)}`);
      }
      return `M ${pts.join(' L ')}`;
    };
    const els = [];
    // The card: the month, the weekday row, a hairline under it.
    els.push({ type: 'rect', x: card.x, y: card.y, w: card.w, h: card.h, r: 28, fill: 'surface', enter: 'rise', dist: 40, at: 0, dur: 0.6, shadow: { blur: 40, dy: 18, opacity: 0.14 } });
    els.push(text('MONTH', card.x + pad + 10, card.y + (stacked ? 78 : small ? 56 : 62), stacked ? 52 : small ? 36 : 44, 'bold', 'ink', { fit: round(card.w - 2 * pad - 20), enter: 'fade', at: 0.2, dur: 0.4 }));
    WEEK.forEach((d, i) =>
      els.push(
        text(d, round(card.x + pad + i * cw + cw / 2), card.y + headH - (stacked ? 34 : 26), stacked || small ? 28 : 30, 'semibold', 'muted', {
          anchor: 'middle',
          fit: cw - 6,
          tracking: 0.06,
          enter: 'fade',
          at: round(0.25 + i * 0.02),
          dur: 0.3,
        }),
      ),
    );
    els.push({ type: 'line', x1: card.x + pad, y1: card.y + headH - 8, x2: round(card.x + card.w - pad), y2: card.y + headH - 8, stroke: 'line', width: 2, enter: 'draw', at: 0.3, dur: 0.5 });
    // The open window: one band per week, sweeping on from the opening day to the last.
    const span = end - start + 1;
    const sweep = Math.min(1.5, Math.max(0.6, span * 0.07));
    let d = start;
    while (d <= end) {
      const rowEnd = Math.min(end, d + (6 - ((firstWeekday + d - 1) % 7)));
      const [x0, y0] = cell(d),
        [x1] = cell(rowEnd);
      const from = (d - start) / span,
        len = (rowEnd - d + 1) / span;
      els.push({
        type: 'rect',
        x: x0 - R,
        y: y0 - R,
        w: round(x1 - x0 + 2 * R),
        h: 2 * R,
        r: R,
        fill: 'wash',
        enter: 'none',
        origin: [x0 - R, y0],
        ...cued('OPEN', round(0.25 + from * sweep)),
        keys: [cued('OPEN', round(0.25 + from * sweep), { dur: 0, scaleX: 0 }), cued('OPEN', round(0.25 + from * sweep), { dur: round(len * sweep), ease: 'linear', scaleX: 1 })],
      });
      d = rowEnd + 1;
    }
    // Every day of the month; days outside the window fall back once it closes.
    for (let i = 1; i <= days; i++) {
      const outside = i < start || i > end;
      els.push(
        num(i, 'ink', {
          enter: 'fade',
          at: round(0.3 + Math.floor((firstWeekday + i - 1) / 7) * 0.06),
          dur: 0.35,
          ...(outside && i !== today ? { keys: [cued('CLOSE', 0.3, { dur: 0.6, opacity: 0.38 })] } : {}),
        }),
      );
    }
    // The opening day, filled.
    const [sx, sy] = cell(start);
    els.push({ type: 'circle', cx: sx, cy: sy, r: R, fill: 'accent', enter: 'pop', dur: 0.4, ...cued('OPEN', 0) });
    els.push(num(start, 'bg', { enter: 'fade', dur: 0.2, ...cued('OPEN', 0.05) }));
    // The last day, filled and circled by hand.
    const [ex, ey] = cell(end);
    if (end !== start) {
      els.push({ type: 'circle', cx: ex, cy: ey, r: R, fill: 'accent', enter: 'pop', dur: 0.4, ...cued('CLOSE', 0) });
      els.push(num(end, 'bg', { enter: 'fade', dur: 0.2, ...cued('CLOSE', 0.05) }));
    }
    els.push({ type: 'path', d: ring(ex, ey, R + 9), fill: 'none', stroke: 'accent2', width: 5, cap: 'round', join: 'round', enter: 'draw', dur: 0.7, loop: { type: 'pulse', period: 2.6, amount: 0.05 }, ...cued('CLOSE', 0.15) });
    // Today: a ring in ink that breathes.
    if (today) {
      const [tx, ty] = cell(today);
      els.push({ type: 'circle', cx: tx, cy: ty, r: R + 3, fill: 'none', stroke: 'ink', width: 3, enter: 'pop', dur: 0.4, origin: [tx, ty], loop: { type: 'pulse', period: 2.2, amount: 0.05 }, ...cued('TODAY', 0) });
    }
    // The key: each mark as it appears on the card, and what it means.
    const gr = stacked ? 36 : small ? 30 : 38;
    const gsize = stacked ? 36 : small ? 28 : 34;
    const label = stacked ? 40 : small ? 30 : 42;
    const row = (i, cue, mark, words) => {
      const gx = key.x + gr,
        gy = round(key.y + i * keyGap);
      return {
        type: 'group',
        enter: 'right',
        dist: 30,
        dur: 0.45,
        ...cued(cue, 0.2),
        children: [
          ...mark(gx, gy),
          text(words, gx + gr + 26, round(gy + label * 0.36), label, 'semibold', 'ink', { width: keyW - 2 * gr - 30, leading: 1.1, enter: 'none' }),
        ],
      };
    };
    const filled = n => (x, y) => [
      { type: 'circle', cx: x, cy: y, r: gr, fill: 'accent', enter: 'none' },
      text(String(n), x, round(y + gsize * 0.36), gsize, 'semibold', 'bg', { anchor: 'middle', enter: 'none' }),
    ];
    els.push(row(0, 'OPEN', filled(start), 'OPENS'));
    els.push(
      row(1, 'CLOSE', (x, y) => [...filled(end)(x, y), { type: 'path', d: ring(x, y, gr + 8), fill: 'none', stroke: 'accent2', width: 4, cap: 'round', join: 'round', enter: 'none' }], 'CLOSES'),
    );
    if (today)
      els.push(
        row(2, 'TODAY', (x, y) => [
          { type: 'circle', cx: x, cy: y, r: gr, fill: 'none', stroke: 'ink', width: 3, enter: 'none' },
          text(String(today), x, round(y + gsize * 0.36), gsize, 'semibold', 'ink', { anchor: 'middle', enter: 'none' }),
        ], 'TODAY'),
      );
    return { elements: els };
  },
};
