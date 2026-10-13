import { crisp, round } from '../../film/sketch-kit.mjs';

// One working week, for "three small things by Friday": five day columns (seven with the
// weekend), the start day marked as today, up to four task cards that drop into the days they
// belong to on their words, and the due day circled by hand with a short label in that day.
// An optional "after" card sits past the week's edge: on its word an arrow pushes out to it and a
// copy of the due label rides the arrow, so missing the day reads as something that slips.
// Wide frames lay the days out as columns; square and tall frames stack them as rows (an agenda)
// sized to fill the frame. The week, its days and the tasks' days come from sketchParams; no
// month or date is drawn. Moments: ONE … FOUR (each task), DUE, AFTER (with after) and TODAY
// (on any word).
const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CUES = ['ONE', 'TWO', 'THREE', 'FOUR'];

export default {
  name: 'week',
  keep: true,
  // Day names are real words: replace them only to shorten, translate or date them.
  keepText: WEEK,
  // Today's marker stands on its own: "starting today" may come before or after the tasks.
  freeMoments: ['TODAY'],
  order: 100,
  summary:
    'One working week: today is marked, up to four task cards drop into the days they belong to, the due day is circled by hand with a short label, and an optional muted card past the week’s edge says what slips if the day is missed.',
  use: 'Onboarding and "due this week" lines that name days, not dates: "three small things by Friday", "finish the training before you serve members", "your first pay is on the 15th; miss Friday and it\'s the 30th". Set the week with sketchParams {days, today, due, tasks, after}: days 5 (Mon–Fri) or 7 (with the weekend); today and due are day indices (0 = MON … 4 = FRI, 5 = SAT, 6 = SUN); tasks gives each task\'s day in the order they are said (1–4, none after due); after true adds the consequence card. Replace TASK1 … (two to five words each), DUE (e.g. "Due Friday"), TODAY (e.g. "Today") and, with after, AFTER (a few words, e.g. "Miss it: paid on the 30th") with sketchText; MON … SUN are the day names (keep them, shorten or translate them). Land ONE … FOUR (each task, best on the word that names its day: "Monday, set up direct deposit"), DUE ("All by Friday") and AFTER ("Miss it") on words in that order, and TODAY on any word, with sketchSay; a long run-up before the first task ("three small things by Friday") leaves the week still while the voice talks. For a window across a month, use deadline.',
  params: {
    days: { default: 5, oneOf: [5, 7], figure: false, about: 'days drawn: 5 (MON–FRI) or 7 (with SAT and SUN)' },
    today: { default: 0, min: 0, max: 6, integer: true, figure: false, about: 'the start day, marked TODAY: 0 = MON … 4 = FRI, 5 = SAT, 6 = SUN' },
    due: { default: 4, min: 0, max: 6, integer: true, figure: false, about: 'the due day, circled: 0 = MON … 4 = FRI, 5 = SAT, 6 = SUN' },
    tasks: {
      default: [0, 1, 3],
      list: true,
      length: [1, 4],
      min: 0,
      max: 6,
      integer: true,
      figure: false,
      about: 'the day of each task, in the order they are said (1–4 tasks, none after due; two may share a day)',
      hint: 'Each value is a day index, not a date: 0 = MON … 4 = FRI.',
    },
    after: { default: false, about: 'true: on AFTER, a muted card past the week’s edge says what happens if the day is missed' },
  },
  build(w, h, { params = {} } = {}) {
    const { days = 5, today = 0, due = 4, tasks = [0, 1, 3], after = false } = params;
    if (today >= days || due >= days)
      throw new Error(`sketchParams for week: today and due are days 0–${days - 1} of a ${days}-day week (got today ${today}, due ${due})`);
    if (today > due) throw new Error(`sketchParams.today for week must not come after due (got today ${today}, due ${due})`);
    const late = tasks.filter(d => d > due);
    if (late.length) throw new Error(`sketchParams.tasks for week must fall on or before the due day ${due} (got ${late.join(', ')})`);
    const n = tasks.length;
    // Moments: the tasks a second apart, the due day after them, the consequence last.
    const AT = { TODAY: 0.5, DUE: round(1.1 + (n - 1) * 0.9 + 1.2) };
    CUES.slice(0, n).forEach((c, i) => (AT[c] = round(1.1 + i * 0.9)));
    if (after) AT.AFTER = round(AT.DUE + 1.8);
    const cued = (cue, dt = 0, extra = {}) => ({ cue, at: round(AT[cue] + dt), ...(dt ? { after: round(dt) } : {}), ...extra });
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const byDay = Array.from({ length: days }, () => []);
    tasks.forEach((d, i) => byDay[d].push(i));
    const weekend = d => d >= 5;
    // A loop of marker round a day, drawn a little past a full turn and a little tilted, as a hand would.
    const ring = (cx, cy, rx, ry) => {
      const pts = [];
      for (let a = 0; a <= 1.12; a += 0.03) {
        const t = (-0.3 + a) * 2 * Math.PI,
          g = 1 + 0.07 * a;
        const [px, py] = [rx * g * Math.cos(t), ry * g * Math.sin(t)];
        pts.push(`${round(cx + px * 0.998 + py * 0.06)} ${round(cy + py * 0.998 - px * 0.06)}`);
      }
      return `M ${pts.join(' L ')}`;
    };
    // An empty to-do box that draws itself once its card has landed.
    const box = (x, y, s, cue) => ({ type: 'rect', x: round(x), y: round(y), w: round(s), h: round(s), r: round(s * 0.26), fill: 'none', stroke: 'accent2', width: 3, enter: 'draw', dur: 0.35, ...cued(cue, 0.3) });
    // Missing the day: a copy of its label rides the arrow out of the week, shrinking and
    // fading as it goes; the consequence lands where it arrives (AFTER + LAND).
    const SLIP = 0.15,
      RIDE = 1.0,
      LAND = 0.95;
    const slip = (b, d) => ({
      type: 'rect',
      ...b,
      r: round(b.h / 2),
      fill: 'accent',
      opacity: 0.75,
      enter: 'fade',
      dur: 0.15,
      ...cued('AFTER', SLIP),
      along: { d, ease: 'inOut', dur: RIDE, ...cued('AFTER', SLIP) },
      keys: [cued('AFTER', SLIP, { dur: RIDE, ease: 'inOut', scale: 0.7 }), cued('AFTER', SLIP + RIDE - 0.25, { dur: 0.3, opacity: 0 })],
    });
    // A card lands a little turned and settles square (made fresh per card: filling rewrites keys).
    const settle = (cue, deg) => [cued(cue, 0, { dur: 0, rotate: -deg }), cued(cue, 0, { dur: 1.0, ease: 'out', rotate: 0 })];
    const els = [];
    // Pen marks keep the film's hand; the week and its cards stay crisp like a planner.
    const marks = [];

    if (w > h * 1.25) {
      // Columns: the week across the frame, today flagged above it, the consequence beside it.
      const X0 = round(w * 0.0625),
        X1 = w - X0;
      const Y0 = round(h * 0.17),
        Y1 = round(h * 0.87);
      const aw = after ? round((X1 - X0) * 0.19) : 0,
        ag = after ? 56 : 0;
      const flag = 74;
      const card = { x: X0, w: X1 - X0 - aw - ag };
      const headH = 100,
        inset = 12,
        gap = 14,
        pillH = 60,
        fs = 32,
        cb = 28,
        padX = 18,
        padY = 16;
      // Weekend days without a task are narrower (the week is the work week); a day holding three
      // or four tasks is wider, so its cards keep their type.
      const weight = d => (weekend(d) && !byDay[d].length && d !== due && d !== today ? 0.55 : 1 + 0.35 * Math.max(0, byDay[d].length - 2));
      const unit = (card.w - 20) / Array.from({ length: days }, (_, d) => weight(d)).reduce((a, b) => a + b, 0);
      const cols = [];
      for (let d = 0, x = card.x + 10; d < days; x += unit * weight(d), d++) cols.push({ x: round(x), w: round(unit * weight(d)), cx: round(x + (unit * weight(d)) / 2) });
      const cardW = d => cols[d].w - 2 * inset;
      // The to-do box sits beside the words, or over them when the columns are too narrow to
      // keep a long word ("handbook") at full size beside it (a seven-day week with an after card).
      // (Only when the fullest day has the height for a box over three lines.)
      const room = Y1 - Y0 - flag - headH - 36;
      const busy = byDay.map((l, d) => d).filter(d => byDay[d].length);
      const limit = Math.min(...busy.map(d => Math.floor((room - (d === due ? pillH + gap : 0) - (byDay[d].length - 1) * gap) / byDay[d].length)));
      const above = Math.min(...busy.map(d => cardW(d) - padX - cb - 28)) < 140 && limit >= 3 * fs * 1.15 + 2 * padY + cb + 10;
      const textW = d => (above ? cardW(d) - 2 * padX : cardW(d) - padX - cb - 28);
      const lift = above ? cb + 10 : 0;
      // Cards are as tall as two lines (three in narrow columns), shorter only when a day is full.
      const lines = Math.max(...busy.map(d => (textW(d) < 200 ? 3 : 2)));
      let cardH = round(lines * fs * 1.15 + 2 * padY + lift);
      byDay.forEach((l, d) => {
        if (l.length) cardH = Math.min(cardH, Math.floor((room - (d === due ? pillH + gap : 0) - (l.length - 1) * gap) / l.length));
      });
      // The columns are as tall as the fullest day needs, with room to spare so they read as days.
      const stack = d => byDay[d].length * (cardH + gap) + (d === due ? pillH : byDay[d].length ? -gap : 0);
      const slots = Math.min(room, Math.max(320, Math.max(...byDay.map((_, d) => stack(d))) + round(cardH * 0.8)));
      card.h = headH + 36 + slots;
      card.y = round(Y0 + flag + (Y1 - Y0 - flag - card.h) / 2);
      const top = card.y + headH + 18;
      const slotY = j => round(top + j * (cardH + gap));

      // The week, there from the first frame: the card, weekend shading, day names and rules.
      els.push({ type: 'rect', ...card, r: 28, fill: 'surface', enter: 'none', at: 0, shadow: { blur: 40, dy: 18, opacity: 0.14 } });
      const tint = (d, fill, opacity, extra) => ({ type: 'rect', x: cols[d].x + 4, y: card.y + 10, w: cols[d].w - 8, h: card.h - 20, r: 18, fill, opacity, ...extra });
      cols.forEach((c, d) => weekend(d) && els.push(tint(d, 'bg', 0.45, { enter: 'none', at: 0 })));
      els.push(tint(today, 'ink', 0.07, { enter: 'fade', dur: 0.5, ...cued('TODAY') }));
      if (due !== today) els.push(tint(due, 'wash', 0.6, { enter: 'fade', dur: 0.5, ...cued('DUE') }));
      cols.forEach((c, d) =>
        els.push(text(WEEK[d], c.cx, card.y + 64, 36, 'semibold', weekend(d) ? 'muted' : 'ink', { anchor: 'middle', fit: c.w - 24, tracking: 0.06, enter: 'none', at: 0 })),
      );
      els.push({ type: 'line', x1: card.x + 24, y1: card.y + headH, x2: card.x + card.w - 24, y2: card.y + headH, stroke: 'line', width: 2, enter: 'none', at: 0 });
      cols.slice(1).forEach(c => els.push({ type: 'line', x1: c.x, y1: card.y + 24, x2: c.x, y2: card.y + card.h - 24, stroke: 'line', width: 2, enter: 'none', at: 0 }));

      // Today: a flag over its column.
      const tc = cols[today],
        fw = Math.min(tc.w - 16, 190),
        fy = card.y - 72;
      els.push({
        type: 'group',
        enter: 'drop',
        dist: 24,
        dur: 0.45,
        ...cued('TODAY'),
        children: [
          { type: 'rect', x: round(tc.cx - fw / 2), y: fy, w: fw, h: 50, r: 25, fill: 'ink', enter: 'none' },
          { type: 'poly', points: [[tc.cx - 12, fy + 48], [tc.cx + 12, fy + 48], [tc.cx, fy + 64]], closed: true, fill: 'ink', enter: 'none' },
          text('TODAY', tc.cx, fy + 35, 28, 'bold', 'bg', { anchor: 'middle', fit: fw - 32, enter: 'none' }),
        ],
      });

      // The tasks, each dropping into its day on its word, empty, its words typing in as it lands
      // (a change that lasts long enough to read as one, not a blink).
      byDay.forEach((list, d) =>
        list.forEach((i, j) => {
          const b = { x: cols[d].x + inset, y: slotY(j), w: cardW(d), h: cardH };
          els.push({
            type: 'group',
            enter: 'drop',
            dist: 110,
            dur: 0.6,
            shadow: { blur: 22, dy: 9, opacity: 0.18 },
            origin: [round(b.x + b.w / 2), round(b.y + b.h / 2)],
            ...cued(CUES[i]),
            keys: settle(CUES[i], 4),
            children: [
              { type: 'rect', ...b, r: 14, fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
              box(b.x + padX, above ? b.y + padY : b.y + padY + fs * 0.64 - cb / 2, cb, CUES[i]),
              text(`TASK${i + 1}`, above ? b.x + padX : b.x + padX + cb + 14, round(b.y + padY + lift + fs), fs, 'semibold', 'ink', { width: textW(d), height: b.h - 2 * padY - lift, leading: 1.15, enter: 'type', dur: 0.9, ...cued(CUES[i], 0.25) }),
            ],
          });
        }),
      );

      // The due day: circled by hand, its label under the tasks of that day.
      const pill = { x: cols[due].x + inset, y: slotY(byDay[due].length), w: cardW(due), h: pillH };
      const pcy = pill.y + pillH / 2;
      marks.push({ type: 'path', d: ring(cols[due].cx, card.y + 51, Math.min(cols[due].w / 2 - 16, 80), 33), fill: 'none', stroke: 'accent', width: 5, cap: 'round', join: 'round', enter: 'draw', dur: 0.7, loop: { type: 'pulse', period: 2.6, amount: 0.04 }, ...cued('DUE') });
      els.push({
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        origin: [cols[due].cx, round(pcy)],
        ...cued('DUE', 0.25),
        // When the day is missed, it gives a little shove toward what comes after.
        ...(after ? { keys: [{ cue: 'AFTER', at: AT.AFTER, dur: 0.7, ease: 'thereAndBack', x: 14 }] } : {}),
        children: [
          { type: 'rect', ...pill, r: pillH / 2, fill: 'accent', enter: 'none' },
          text('DUE', cols[due].cx, round(pcy + 30 * 0.36), 30, 'bold', 'bg', { anchor: 'middle', fit: pill.w - 36, enter: 'none' }),
        ],
      });

      // After: a muted card past the week's right edge, an arrow pushing out to it.
      if (after) {
        const ah = 132;
        const ab = { x: card.x + card.w + ag, w: aw, h: ah };
        ab.y = round(Math.min(Math.max(pcy - ah / 2, card.y), card.y + card.h - ah));
        const acy = round(ab.y + ah / 2),
          y0 = round(pcy),
          edge = card.x + card.w + 4,
          mid = round((edge + ab.x) / 2);
        // Out along the due day's row, past the week's edge, bending to the card if it sits lower.
        const route = (from, to) => (Math.abs(acy - y0) < 1 ? `M ${from} ${y0} L ${to} ${y0}` : `M ${from} ${y0} L ${edge} ${y0} C ${mid} ${y0} ${mid} ${acy} ${to} ${acy}`);
        els.push({ type: 'path', d: route(pill.x + pill.w + 10, ab.x - 14), fill: 'none', stroke: 'muted', width: 5, dash: [14, 10], cap: 'round', arrow: 'end', enter: 'draw', dur: 0.8, loop: { type: 'dash', period: 1.4 }, ...cued('AFTER') });
        els.push(slip(pill, route(cols[due].cx, ab.x + 40)));
        els.push({
          type: 'group',
          enter: 'left',
          dist: 40,
          dur: 0.5,
          ...cued('AFTER', LAND),
          children: [
            { type: 'rect', ...ab, r: 20, fill: 'surface', stroke: 'muted', width: 3, dash: [10, 8], enter: 'none' },
            { type: 'icon', name: 'calendar-event', x: ab.x + 40, y: ab.y + 46, size: 40, stroke: 'muted', enter: 'none' },
            text('AFTER', ab.x + 74, ab.y + 26 + fs, fs, 'semibold', 'muted', { width: ab.w - 74 - 18, height: ah - 44, leading: 1.15, enter: 'type', dur: 0.7, ...cued('AFTER', LAND + 0.2) }),
          ],
        });
      }
    } else {
      // Rows: an agenda down the frame, sized up to fill it, the consequence under the week.
      const X0 = round(w * 0.078),
        X1 = w - X0;
      const Y0 = round(h * 0.17),
        Y1 = h - Math.max(130, round(h * 0.13));
      const kMax = h > w * 1.5 ? 1.3 : h > w * 1.1 ? 1.12 : 1;
      const labW = round((X1 - X0) * 0.24),
        labX = X0 + labW / 2;
      const lane = { x: X0 + labW + 22, r: X1 - 24 };
      lane.w = lane.r - lane.x;
      // Everything scales with k; type (and what holds it) never drops below what a phone reads.
      const sz = (base, k, floor = 0) => Math.max(floor, base * k);
      const sizes = k => ({
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
      const laneH = (d, s) => byDay[d].length * s.cardH + (d === due ? s.pillH : 0) + Math.max(0, byDay[d].length + (d === due ? 1 : 0) - 1) * s.gap;
      const labH = (d, s) => s.day * 1.1 + (d === today ? s.tgap + s.todayH : 0);
      const need = (d, s) => Math.max(s.minRow, Math.max(laneH(d, s), labH(d, s)) + 2 * s.pad);
      const total = s => byDay.reduce((sum, _, d) => sum + need(d, s), 24) + (after ? s.afterGap + s.afterH : 0);
      // As large as the frame allows (up to kMax), then the rows share what is left.
      let k = kMax;
      while (k > 0.5 && total(sizes(k)) > Y1 - Y0) k = Math.round((k - 0.02) * 100) / 100;
      const s = sizes(k);
      // A crowded week (seven days, a full day and an after card in a square) rises into the
      // space a title would use rather than shrinking its type further.
      const Y = Math.max(round(h * 0.06), Math.min(Y0, Y1 - total(s)));
      const grow = Math.max(0, Math.min((Y1 - Y - total(s)) / days, s.cardH * 0.8));
      const rowH = byDay.map((_, d) => round(need(d, s) + grow));
      const card = { x: X0, w: X1 - X0, h: rowH.reduce((a, b) => a + b, 24) };
      const used = card.h + (after ? s.afterGap + s.afterH : 0);
      card.y = round(Y + Math.max(0, (Y1 - Y - used) / 2));
      const rowY = [];
      rowH.reduce((y, rh) => (rowY.push(y), y + rh), card.y + 12);
      const rowC = d => rowY[d] + rowH[d] / 2;

      // The week, there from the first frame.
      els.push({ type: 'rect', ...card, r: 28, fill: 'surface', enter: 'none', at: 0, shadow: { blur: 40, dy: 18, opacity: 0.14 } });
      const tint = (d, fill, opacity, extra) => ({ type: 'rect', x: X0 + 8, y: rowY[d] + 3, w: card.w - 16, h: rowH[d] - 6, r: 18, fill, opacity, ...extra });
      byDay.forEach((_, d) => weekend(d) && els.push(tint(d, 'bg', 0.45, { enter: 'none', at: 0 })));
      els.push(tint(today, 'ink', 0.07, { enter: 'fade', dur: 0.5, ...cued('TODAY') }));
      if (due !== today) els.push(tint(due, 'wash', 0.6, { enter: 'fade', dur: 0.5, ...cued('DUE') }));
      byDay.slice(1).forEach((_, i) => els.push({ type: 'line', x1: X0 + 24, y1: rowY[i + 1], x2: X1 - 24, y2: rowY[i + 1], stroke: 'line', width: 2, enter: 'none', at: 0 }));
      els.push({ type: 'line', x1: X0 + labW, y1: card.y + 20, x2: X0 + labW, y2: card.y + card.h - 20, stroke: 'line', width: 2, enter: 'none', at: 0 });
      // Day names, centred in their cells; today's sits over its marker.
      const nameY = d => round(d === today ? rowC(d) - labH(d, s) / 2 + s.day * 0.86 : rowC(d) + s.day * 0.36);
      byDay.forEach((_, d) =>
        els.push(text(WEEK[d], round(labX), nameY(d), round(s.day), 'semibold', weekend(d) ? 'muted' : 'ink', { anchor: 'middle', fit: labW - 32, tracking: 0.06, enter: 'none', at: 0 })),
      );

      // Today: a marker under its day's name.
      const tw = labW - 40,
        ty = round(nameY(today) + s.day * 0.24 + s.tgap);
      els.push({
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        ...cued('TODAY'),
        children: [
          { type: 'rect', x: round(labX - tw / 2), y: ty, w: tw, h: round(s.todayH), r: round(s.todayH / 2), fill: 'ink', enter: 'none' },
          text('TODAY', round(labX), round(ty + s.todayH / 2 + s.tfs * 0.36), round(s.tfs), 'bold', 'bg', { anchor: 'middle', fit: tw - 26, enter: 'none' }),
        ],
      });

      // The tasks, each dropping into its day's row on its word.
      const itemY = (d, j) => round(rowC(d) - laneH(d, s) / 2 + j * (s.cardH + s.gap));
      const inner = round(24 * k);
      byDay.forEach((list, d) =>
        list.forEach((i, j) => {
          const b = { x: lane.x, y: itemY(d, j), w: lane.w, h: round(s.cardH) };
          const cy = b.y + b.h / 2;
          els.push({
            type: 'group',
            enter: 'drop',
            dist: round(60 * k),
            dur: 0.5,
            shadow: { blur: 22, dy: 9, opacity: 0.18 },
            origin: [round(b.x + b.w / 2), round(cy)],
            ...cued(CUES[i]),
            keys: settle(CUES[i], 1.5),
            children: [
              { type: 'rect', ...b, r: round(18 * k), fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
              box(b.x + inner, cy - s.cb / 2, s.cb, CUES[i]),
              text(`TASK${i + 1}`, round(b.x + inner + s.cb + 20 * k), round(cy + s.fs * 0.36), round(s.fs), 'semibold', 'ink', { fit: round(b.w - 2 * inner - s.cb - 20 * k), enter: 'type', dur: 0.9, ...cued(CUES[i], 0.25) }),
            ],
          });
        }),
      );

      // The due day: its name circled by hand, its label after the tasks of that day.
      const pill = { x: lane.x, y: itemY(due, byDay[due].length), w: round(lane.w * 0.62), h: round(s.pillH) };
      const pcx = round(pill.x + pill.w / 2);
      marks.push({ type: 'path', d: ring(round(labX), round(nameY(due) - s.day * 0.36), round(labW / 2 - 26), round(s.day * 0.82)), fill: 'none', stroke: 'accent', width: 5, cap: 'round', join: 'round', enter: 'draw', dur: 0.7, loop: { type: 'pulse', period: 2.6, amount: 0.04 }, ...cued('DUE') });
      els.push({
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        origin: [pcx, round(pill.y + pill.h / 2)],
        ...cued('DUE', 0.25),
        ...(after ? { keys: [{ cue: 'AFTER', at: AT.AFTER, dur: 0.7, ease: 'thereAndBack', y: 12 }] } : {}),
        children: [
          { type: 'rect', ...pill, r: round(pill.h / 2), fill: 'accent', enter: 'none' },
          text('DUE', pcx, round(pill.y + pill.h / 2 + s.pfs * 0.36), round(s.pfs), 'bold', 'bg', { anchor: 'middle', fit: pill.w - 40, enter: 'none' }),
        ],
      });

      // After: a muted card under the week, an arrow pushing down past its edge (through the
      // days after the due day, which hold no tasks).
      if (after) {
        const ab = { x: lane.x, y: round(card.y + card.h + s.afterGap), w: lane.w, h: round(s.afterH) };
        const acy = round(ab.y + ab.h / 2);
        els.push({ type: 'line', x1: pcx, y1: pill.y + pill.h + 10, x2: pcx, y2: ab.y - 14, stroke: 'muted', width: 5, dash: [14, 10], cap: 'round', arrow: 'end', enter: 'draw', dur: 0.8, loop: { type: 'dash', period: 1.4 }, ...cued('AFTER') });
        els.push(slip(pill, `M ${pcx} ${round(pill.y + pill.h / 2)} L ${pcx} ${acy}`));
        els.push({
          type: 'group',
          enter: 'drop',
          dist: 40,
          dur: 0.5,
          ...cued('AFTER', LAND),
          children: [
            { type: 'rect', ...ab, r: round(20 * k), fill: 'surface', stroke: 'muted', width: 3, dash: [10, 8], enter: 'none' },
            { type: 'icon', name: 'calendar-event', x: round(ab.x + inner + 22 * k), y: round(acy), size: round(44 * k), stroke: 'muted', enter: 'none' },
            text('AFTER', round(ab.x + inner + 64 * k), round(acy + s.afs * 0.36), round(s.afs), 'semibold', 'muted', { fit: round(ab.w - 2 * inner - 64 * k), enter: 'type', dur: 0.7, ...cued('AFTER', LAND + 0.2) }),
          ],
        });
      }
    }
    return { elements: [...crisp(els), ...marks] };
  },
};
