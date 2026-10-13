import { body, round } from '../../film/sketch-kit.mjs';

// Saving over the years: one column per year (or every few years) stacks what you put in and,
// on top of it, what it grew. The columns rise as a straight ramp of contributions first, then
// the growth climbs onto each one, small at first and larger than the contributions by the end:
// compounding, seen. The last column is named in parts (what you put in, what it grew) and the
// total counts up beside it. Every height and figure is computed from the stated assumption in
// sketchParams (the same amount put in at the start of each year, growing at one annual rate,
// compounded yearly), never drawn by eye. Moments: START, GROW, TOTAL.
const AT = { START: 0.6, GROW: 2.8, TOTAL: 5.2 };

/** A round step for gridlines: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
}

export default {
  name: 'growth',
  keep: true,
  order: 99,
  summary:
    'Saving over the years: a column per year stacks what you put in and what it grew, so the growth overtakes the contributions late (compounding); the last column is named in parts and the total counts up beside it. Computed from a stated assumption.',
  use: 'Retirement or college saving, starting early, a regular contribution left to grow: "put in $6,000 a year for 30 years and it grows to $418,000". Set the assumption with sketchParams {years, perYear, rate, prefix, startYear}: perYear is put in at the start of each year and grows at rate (a fraction: 0.05 for 5%) compounded yearly; startYear labels the axis with calendar years (0 counts Year 1, 2 …). Replace PUTIN (e.g. "you put in"), GREW (e.g. "it grew"), TOTAL (words after the total, e.g. "after 30 years") and BASIS (one plain line stating the example, e.g. "Example: $6,000 a year, growing 5% a year") with sketchText; land START (the contributions), GROW (the growth) and TOTAL on words with sketchSay. The assumed rate needs a visible source like any figure.',
  params: {
    years: { default: 30, min: 5, max: 40, integer: true, about: 'how many years of saving (5–40)' },
    perYear: {
      default: 6000,
      min: 1,
      max: 1000000000,
      about: 'amount put in each year, in the printed currency (6000 for $6,000)',
      hint: 'A yearly amount: $500 a month is perYear 6000.',
    },
    rate: {
      default: 0.05,
      min: 0,
      max: 0.2,
      about: 'annual growth assumption, as a fraction (0.05 for 5%)',
      hint: 'rate is a fraction: 0.05 for 5%, 0.07 for 7%.',
    },
    prefix: { default: '$', about: 'printed before each amount, e.g. "$" or "£"' },
    startYear: { default: 0, min: 0, max: 2200, integer: true, about: 'calendar year of the first column, e.g. 2027 (0 labels the axis Year 1, 5, 10 …)' },
  },
  build(w, h, { params = {} } = {}) {
    const { years = 30, perYear = 6000, rate = 0.05, prefix = '$', startYear = 0 } = params;
    // The stated assumption: perYear goes in at the start of each year and grows at `rate`.
    const bal = [0];
    for (let k = 1; k <= years; k++) bal.push((bal[k - 1] + perYear) * (1 + rate));
    const money = v => `${prefix}${Math.round(v).toLocaleString('en-US')}`;
    // Printed parts add up to the printed total.
    const total = Math.round(bal[years]),
      putIn = Math.round(perYear * years),
      grew = total - putIn;

    const wide = w >= 1400;
    const b = body(w, h);
    // Tall frames set the readout over the chart; wide and short frames set it beside the last
    // column, where each part is bracketed at its true height.
    const side = wide || b.h < 900;
    // Type stays inside the title-safe width (in narrow frames even after the beat's slow push).
    const L = wide ? 200 : round(w * 0.115 + 6),
      R = w - L;
    // Columns: every year, or every 2, 5 or 10 years counted back from the last, at most 30 (20
    // in narrow frames).
    const maxCols = wide ? 30 : 20;
    const step = [1, 2, 5, 10].find(s => years / s <= maxCols);
    const ks = [];
    for (let k = years; k >= 1; k -= step) ks.unshift(k);
    const n = ks.length;

    const fs = wide
      ? { basis: 32, total: 76, value: 44, words: 30, tick: 30, grid: 28 }
      : side
        ? { basis: 30, total: 58, value: 38, words: 28, tick: 28, grid: 28 }
        : { basis: 32, total: 84, value: 44, words: 30, tick: 30, grid: 28 };
    const basisY = round(b.y + (wide ? 34 : 30));
    // The readout over a tall frame's chart: the total and its words, then the two parts.
    const ro = side ? null : { total: round(basisY + 124) };
    if (ro) Object.assign(ro, { words: ro.total + 48, parts: ro.total + 140 });
    const lw = wide ? 390 : 250;
    const x0 = L,
      x1 = side ? round(R - lw - 30) : R;
    const top = side ? round(b.y + (wide ? 120 : 100)) : round(ro.parts + 150);
    const base = round(b.y + b.h - (wide ? 52 : 70));
    const H = base - top;
    const pitch = (x1 - x0) / n;
    const bw = round(Math.max(8, Math.min(64, pitch * 0.64)));
    const cx = i => round(x0 + pitch * (i + 0.5));
    const yOf = v => round(base - (v / total) * H);
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const cued = (cue, dt, extra = {}) => ({ cue, at: round(AT[cue] + dt), after: round(dt), ...extra });
    const els = [];

    // On screen from the first frame: the assumption, gridlines with their amounts (as many as
    // the height has room for), the baseline and the years under it.
    els.push(text('BASIS', L, basisY, fs.basis, 'semibold', 'muted', { fit: R - L, enter: 'none', at: 0 }));
    const lines = Math.max(1, Math.min(4, Math.floor(H / 95)));
    const g = niceStep(total / (lines + 0.2));
    const compact = v =>
      `${prefix}${v >= 1e9 ? `${+(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : v}`;
    for (let v = g; v < total * 0.97; v += g) {
      const y = yOf(v);
      els.push({ type: 'line', x1: x0, y1: y, x2: x1, y2: y, stroke: 'line', width: 2, enter: 'none', at: 0 });
      els.push(text(compact(v), x0, y - 10, fs.grid, 'semibold', 'muted', { enter: 'none', at: 0 }));
    }
    els.push({ type: 'line', x1: x0, y1: base, x2: x1, y2: base, stroke: 'muted', width: 3, cap: 'round', enter: 'none', at: 0 });
    // Year labels: the last and first columns, and round years between (multiples of 5 or 10,
    // else counted back from the last), never closer than a label's width.
    const minGap = wide ? 150 : 120;
    const fits = s => s % step === 0 && (s / step) * pitch >= minGap;
    const labelStep = [1, 2, 5, 10, 20].find(fits) ?? Array.from({ length: n }, (_, m) => (m + 1) * step).find(fits) ?? years;
    let round5 = ks.filter(k => k % labelStep === 0);
    if (round5.length < 2) round5 = ks.filter(k => (years - k) % labelStep === 0);
    const kept = [];
    for (const k of [years, ks[0], ...round5.reverse()])
      if (kept.every(q => (Math.abs(q - k) / step) * pitch >= minGap * 0.8)) kept.push(k);
    const leftmost = Math.min(...kept);
    for (const k of kept) {
      const i = ks.indexOf(k);
      // The outermost labels align with their bars' outer edges, inside the title-safe width.
      const first = i === 0,
        last = k === years;
      const t = startYear ? String(startYear + k - 1) : k === leftmost ? `Year ${k}` : String(k);
      const x = first ? round(cx(i) - bw / 2) : last ? round(cx(i) + bw / 2) : cx(i);
      els.push(text(t, x, base + 44, fs.tick, last ? 'bold' : 'semibold', last ? 'ink' : 'muted', { anchor: first ? 'start' : last ? 'end' : 'middle', enter: 'none', at: 0 }));
    }

    // The columns: contributions rise first, left to right (START); then the growth climbs onto
    // each (GROW). At TOTAL every column but the last steps back.
    const dim = () => ({ cue: 'TOTAL', at: AT.TOTAL, dur: 0.5, opacity: 0.4 });
    const spread = (i, span) => (n > 1 ? round((span * i) / (n - 1)) : 0);
    ks.forEach((k, i) => {
      const x = round(cx(i) - bw / 2);
      const p = perYear * k,
        hP = round((p / total) * H),
        hAll = round((bal[k] / total) * H);
      const r = round(Math.min(5, bw / 4));
      const last = i === n - 1;
      if (hP >= 1)
        els.push({ type: 'rect', x, y: round(base - hP), w: bw, h: hP, r, fill: 'accent2', enter: 'grow-y', dur: 0.45, ...cued('START', spread(i, 1.3)), ...(last ? {} : { keys: [dim()] }) });
      const hG = round(hAll - hP - 3);
      if (hG >= 1.5)
        els.push({ type: 'rect', x, y: round(base - hAll), w: bw, h: hG, r, fill: 'accent', enter: 'grow-y', dur: 0.5, ...cued('GROW', spread(i, 1.5)), ...(last ? {} : { keys: [dim()] }) });
    });

    // The last column, named in parts, and the total.
    const right = round(cx(n - 1) + bw / 2);
    const yTop = yOf(total),
      yMid = yOf(putIn);
    const putAt = () => cued('START', 1.55),
      grewAt = () => cued('GROW', 1.75);
    const count = { from: 0, to: total, decimals: 0, prefix, dur: 1.2 };
    if (side) {
      // Brackets beside the column mark each part's true extent; the labels keep clear of each
      // other when a part is thin.
      const bx = right + 14,
        lx = right + 40,
        lwide = R - lx;
      const ph = round(fs.value * 0.74 + fs.words + 14);
      const blocks = [
        { y: yTop, h: round(fs.total * 0.72 + fs.words + 22) },
        { y: round((yTop + yMid) / 2 - ph / 2), h: ph },
        { y: round((yMid + base) / 2 - ph / 2), h: ph },
      ];
      for (let k = 1; k < 3; k++) blocks[k].y = Math.max(blocks[k].y, blocks[k - 1].y + blocks[k - 1].h + 14);
      const over = blocks[2].y + blocks[2].h - (base + 20);
      if (over > 0) blocks.forEach(bk => (bk.y = round(bk.y - over)));
      const bracket = (y0, y1, stroke, timing) => ({
        type: 'path',
        d: `M ${bx} ${round(y0 + 3)} L ${bx + 10} ${round(y0 + 3)} L ${bx + 10} ${round(y1 - 3)} L ${bx} ${round(y1 - 3)}`,
        fill: 'none',
        stroke,
        width: 3,
        cap: 'round',
        join: 'round',
        enter: 'draw',
        dur: 0.4,
        ...timing,
      });
      const part = (bk, value, words, fill, timing) => ({
        type: 'group',
        enter: 'right',
        dist: 24,
        dur: 0.45,
        ...timing,
        children: [
          text(value, lx, round(bk.y + fs.value * 0.74), fs.value, 'bold', fill, { fit: lwide, enter: 'none' }),
          text(words, lx, round(bk.y + fs.value * 0.74 + fs.words + 10), fs.words, 'semibold', 'ink', { fit: lwide, enter: 'none' }),
        ],
      });
      els.push(bracket(yMid, base, 'accent2', putAt()));
      els.push(part(blocks[2], money(putIn), 'PUTIN', 'accent2', putAt()));
      // (The growth's part is named even at a 0% rate, so GROW is always a moment.)
      if (grew > 0) els.push(bracket(yTop, yMid - 3, 'accent', grewAt()));
      els.push(part(blocks[1], money(grew), 'GREW', 'accent', grewAt()));
      els.push(text(null, lx, round(blocks[0].y + fs.total * 0.72), fs.total, 'bold', 'ink', { count, fit: lwide, enter: 'fade', dur: 0.3, ...cued('TOTAL', 0.2) }));
      els.push(text('TOTAL', lx, round(blocks[0].y + fs.total * 0.72 + fs.words + 14), fs.words, 'semibold', 'ink', { fit: lwide, enter: 'rise', dist: 14, dur: 0.4, ...cued('TOTAL', 0.5) }));
    } else {
      // Over the chart: the total and its words, then the two parts side by side, a swatch each.
      const colW = round((R - L) / 2);
      const part = (x, value, words, fill, timing) => ({
        type: 'group',
        enter: 'rise',
        dist: 16,
        dur: 0.45,
        ...timing,
        children: [
          { type: 'rect', x, y: round(ro.parts - fs.value * 0.72), w: 14, h: round(fs.value * 0.72), r: 3, fill, enter: 'none' },
          text(value, x + 28, ro.parts, fs.value, 'bold', fill, { fit: colW - 40, enter: 'none' }),
          text(words, x + 28, round(ro.parts + fs.words + 12), fs.words, 'semibold', 'ink', { fit: colW - 40, enter: 'none' }),
        ],
      });
      els.push(part(L, money(putIn), 'PUTIN', 'accent2', putAt()));
      els.push(part(L + colW, money(grew), 'GREW', 'accent', grewAt()));
      els.push(text(null, L, ro.total, fs.total, 'bold', 'ink', { count, fit: R - L, enter: 'fade', dur: 0.3, ...cued('TOTAL', 0.2) }));
      els.push(text('TOTAL', L, ro.words, fs.words + 2, 'semibold', 'ink', { fit: R - L, enter: 'rise', dist: 14, dur: 0.4, ...cued('TOTAL', 0.5) }));
    }
    // Count-only figures carry no text.
    for (const el of els) if (el.type === 'text' && el.text == null) delete el.text;
    return { elements: els };
  },
};
