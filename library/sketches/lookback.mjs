import { crisp, rng, round, smoothPath } from '../../film/sketch-kit.mjs';

// The lower of two prices, then a discount (an employee share purchase plan's lookback, a price
// protection offer): a price line draws across one offering period with its area tinted in, the
// first-day and last-day prices are marked as dots with a tag each (the day over the price), the
// lower one is circled by hand and carried by a dashed level line to the purchase just past the
// period's end, where a bar drops from it by the discount to the price you pay. Optionally the
// gap between what you pay and the last-day price shades in, bracketed and labelled. The line's
// path is seeded and smooth: it starts and ends exactly on the two prices and never dips below
// the lower one, so the space under it holds the purchase. Every printed value comes from
// sketchParams (what you pay is worked out from them). The empty period (panel, axis, its two
// days) is there from the first frame. Moments: PERIOD, START, END, LOWER, DISCOUNT, PAY, GAIN
// (with gain), each a change a phone can see.
const SAMPLES = 120;

/** A smooth curve through (t, v) keys that never overshoots them (Fritsch–Carlson). */
function monotone(keys) {
  const n = keys.length,
    xs = keys.map(k => k[0]),
    ys = keys.map(k => k[1]);
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) [m[i], m[i + 1]] = [(3 * a * d[i]) / Math.sqrt(s), (3 * b * d[i]) / Math.sqrt(s)];
  }
  return t => {
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i],
      u = Math.min(1, Math.max(0, (t - xs[i]) / h)),
      u2 = u * u,
      u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

/** A loop of marker round a label, drawn a little past a full turn and a little tilted, as a hand would. */
function ring(cx, cy, rx, ry) {
  const pts = [];
  for (let a = 0; a <= 1.12; a += 0.03) {
    const t = (-0.3 + a) * 2 * Math.PI,
      g = 1 + 0.07 * a;
    const [px, py] = [rx * g * Math.cos(t), ry * g * Math.sin(t)];
    pts.push([round(cx + px * 0.998 + py * 0.05), round(cy + py * 0.998 - px * 0.05)]);
  }
  return pts;
}

export default {
  name: 'lookback',
  keep: true,
  order: 101,
  summary:
    'The lower of two prices, then a discount: a price line across one offering period, its first-day and last-day prices marked, the lower one circled by hand and carried to the purchase, a bar dropping from it by the discount to the price you pay, and optionally the gap to the last-day price shaded and labelled.',
  use: 'An employee stock purchase plan\'s lookback, a price protection offer, any "you pay X% below the lower of two prices": "the price starts at $40 and ends at $50; you buy at the lower of the two, then 15% off: you pay $34, $16 below today\'s price". Set the figures with sketchParams {start, end, discount, prefix, decimals, gain}: start and end are the prices on the period\'s first and last day (either may be the lower), discount is a fraction (0.15 for 15% off), decimals matches how the source prints a price (0 for $34, 2 for $34.00), gain true adds the gap to the last-day price. What you pay is worked out as the lower price × (1 − discount) and printed with those decimals: check it against the source. Replace PERIOD (the span under the axis, e.g. "One offering: six months"), STARTLABEL and ENDLABEL (the period\'s first and last day, e.g. "Jan 1", "Jun 30"), LOWER (beside the circled price, e.g. "the lower price"), PAY (before the price you pay, e.g. "You pay") and, with gain, GAIN (under the gap, e.g. "below today\'s price") with sketchText; land PERIOD, START, END, LOWER, DISCOUNT, PAY and GAIN (with gain) on words in that order with sketchSay. The prices and the discount need a visible source like any figure. For a rate or price that holds while the market moves, use hold.',
  params: {
    start: { default: 40, min: 0.01, max: 10000000, about: 'the price on the first day of the period, in the printed units (40 for $40)' },
    end: { default: 50, min: 0.01, max: 10000000, about: 'the price on the last day of the period (the purchase date), in the same units' },
    discount: {
      default: 0.15,
      min: 0.01,
      max: 0.9,
      about: 'the discount off the lower of the two prices, as a fraction (0.15 for 15% off)',
      hint: 'A fraction, not a percent: 15% off is 0.15 (not 15).',
    },
    prefix: { default: '$', about: 'printed before each price, e.g. "$" (or "" for none)' },
    decimals: {
      default: 0,
      min: 0,
      max: 4,
      integer: true,
      figure: false,
      about: 'decimal places in the printed prices, as the source prints them (0 for $34, 2 for $34.00 or $35.16)',
    },
    gain: { default: false, about: 'true: on GAIN, the gap between what you pay and the last-day price shades in, bracketed and labelled with the difference' },
  },
  build(w, h, { seed = 5, params = {} } = {}) {
    const { start = 40, end = 50, discount = 0.15, prefix = '$', decimals = 0, gain = false } = params;
    // Prices as the source prints them: what you pay is rounded to the printed decimals first, so
    // the printed gap is the difference of the printed prices.
    const q = v => Math.round(v * 10 ** decimals + 1e-7) / 10 ** decimals;
    const fmt = v => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    const lowStart = start <= end; // a tie counts the first day as the lower
    const lo = Math.min(start, end),
      hi = Math.max(start, end);
    const pay = q(lo * (1 - discount)),
      gap = q(end - pay);
    const pct = `−${Math.round(discount * 10000) / 100}%`;
    const AT = { PERIOD: 0.5, START: 2.6, END: 3.7, LOWER: 4.9, DISCOUNT: 6.3, PAY: 7.6, ...(gain ? { GAIN: 8.9 } : {}) };
    const cued = (cue, dt = 0, extra = {}) => ({ cue, at: round(AT[cue] + dt), ...(dt ? { after: round(dt) } : {}), ...extra });

    // The price, from the lower day (u = 0) to the higher (u = 1): a wobble, a climb with a
    // pullback, a peak a little above the higher price and a settle onto it. Falling prices run
    // the same path backwards. Seeded ripples ride on it, never under the lower price or over the peak.
    const D = hi - lo,
      span = Math.max(D, 0.1 * hi);
    const rand = rng(seed);
    const jit = s => (rand() * 2 - 1) * s;
    const over = span * (0.1 + 0.06 * rand());
    const trend = monotone([
      [0, lo],
      [0.09 + jit(0.02), lo + 0.06 * span + 0.1 * D],
      [0.2 + jit(0.03), lo + 0.03 * span + 0.05 * D],
      [0.36 + jit(0.03), lo + (0.5 + jit(0.1)) * D + 0.06 * span],
      [0.47 + jit(0.03), lo + (0.38 + jit(0.08)) * D + 0.04 * span],
      [0.62 + jit(0.04), hi + over],
      [0.76 + jit(0.03), hi - (0.12 + jit(0.05)) * D + 0.02 * span],
      [0.9, hi + 0.04 * span],
      [1, hi],
    ]);
    const waves = [
      [3 + rand(), 0.5],
      [6.5 + 1.5 * rand(), 0.3],
      [12 + 2 * rand(), 0.15],
    ].map(([f, a]) => [f, a, rand() * Math.PI * 2]);
    const value = u => {
      const v = trend(u);
      const room = Math.max(0, Math.min(v - lo, hi + over - v)) / 1.2;
      const ramp = Math.max(0, Math.min(1, u / 0.1, (1 - u) / 0.08));
      return v + Math.min(0.05 * span, room) * ramp * waves.reduce((s, [f, a, p]) => s + a * Math.sin(2 * Math.PI * f * u + p), 0);
    };
    const vals = Array.from({ length: SAMPLES + 1 }, (_, i) => value(lowStart ? i / SAMPLES : 1 - i / SAMPLES));
    const vtop = Math.max(...vals, hi);

    // Type: wide frames read at a distance; 1080-wide frames are sized for a phone.
    const wide = w > h * 1.25,
      square = !wide && h < w * 1.15;
    const F = Object.fromEntries(
      Object.entries(
        wide
          ? { tag: 46, words: 36, date: 34, period: 36, pct: 52, pay: 52, payWords: 42, gain: 54, gainWords: 34 }
          : { tag: 54, words: 42, date: 40, period: 42, pct: 58, pay: 60, payWords: 48, gain: 58, gainWords: 42 },
      ).map(([k, v]) => [k, round(square ? v * 0.88 : v)]),
    );
    const cap = s => 0.72 * s;
    const numW = (s, size) => s.length * 0.62 * size;
    // Long prices ("$1,234.56") set their tags and pill smaller rather than squeeze the period.
    F.tag = Math.min(F.tag, round((wide ? 300 : w * 0.22) / (Math.max(fmt(start).length, fmt(end).length) * 0.62 + 0.9)));
    F.pay = Math.min(F.pay, round((wide ? 380 : w * 0.32) / (fmt(pay).length * 0.62 + 1.1)));
    // A price's tag is a tooltip: its day, small, over the price.
    const tagD = round(F.tag * (wide ? 0.6 : 0.68)),
      tagPad = round(F.tag * 0.3),
      tagGap = round(F.tag * 0.26);
    const tagH = round(2 * tagPad + cap(tagD) + tagGap + cap(F.tag) + 4),
      tagW = v => round(Math.max(numW(fmt(v), F.tag), 5.5 * 0.56 * tagD) + F.tag * 0.9);
    const pillH = round(F.pay * 1.42),
      pillW = round(numW(fmt(pay), F.pay) + F.pay * 1.1);
    const dotR = wide ? 13 : 14,
      bw = wide ? 84 : 76;

    // Across: the start's tag hangs left of the period; past its end, the purchase column (the
    // bar, the gain's bracket and, in wide frames, the gain's words beside it). Type keeps to the
    // title-safe width (a frame taller than wide loses a tenth each side to the phone's buttons);
    // only the ring and the bracket may reach past it.
    const L = wide ? 150 : h > w ? round(w * 0.1 + 24) : 84,
      R = w - L;
    const x0 = round(L + tagW(start) - 10);
    const gapC = wide ? 34 : 26,
      gainW = wide ? 330 : 0;
    const colNeed = gapC + bw + (wide && gain ? 22 + 24 + gainW : 0);
    const x1 = round(R - Math.max(colNeed, tagW(end) - 10));
    const xs = round(x1 + gapC + bw / 2),
      xb = round(xs + bw / 2 + 22);

    // Down: the dates (and the period's words) under the axis, what you pay and its words above
    // it, the line's range above that. Narrow frames cap the range's height against the period's
    // width (so a ripple stays a ripple) and centre the picture in the height left over. The
    // beat's source line sits under the picture, higher on a tall frame.
    const top0 = wide ? 110 : round(h * (square ? 0.09 : 0.11)),
      bottom0 = round(h - (wide ? 162 : 172) - (h > w ? Math.max(0, h * 0.06 - 40) : 0));
    const datesH = wide ? round(F.date * 1.45) : round(F.date * 1.4 + F.period * 1.55);
    let axisY = bottom0 - datesH;
    const rLo = (lo - pay) / (vtop - pay),
      rHi = (hi - pay) / (vtop - pay);
    const pctCap = cap(F.pct);
    // The circled price's words sit just under its dot; with the end circled, the discount's
    // label stacks under them.
    const wordsBase = dotR + 20 + cap(F.words);
    const gainBlock = gain && !wide ? 30 + cap(F.gain) + 14 + F.gainWords : 0;
    const settle = H => {
      const barH = rLo * H;
      const pctC = Math.max(barH / 2, (lowStart ? 18 : wordsBase + 30) + pctCap / 2);
      const pillTop = Math.max(barH + 24, pctC + pctCap / 2 + 24);
      return { barH, pctC, pillTop };
    };
    // (A phone-tall frame lets the range run taller than the period is wide: the frame is the picture.)
    const capH = wide ? Infinity : h > w * 1.5 ? Math.max(1.55 * (x1 - x0), 0.48 * h) : (square ? 1 : 1.2) * (x1 - x0);
    let H = 600,
      yPay = axisY;
    for (let i = 0; i < 8; i++) {
      const s = settle(H);
      const below = s.pillTop - s.barH + pillH + gainBlock + 36;
      yPay = axisY - Math.max(below, lowStart ? wordsBase + 30 - s.barH : 0);
      H = Math.min(capH, yPay - top0 - 8, (yPay - top0 - 44 - tagH) / rHi);
    }
    // The room a capped range leaves is shared above and below (the picture rises by half of it).
    const used = Math.min(yPay - H - 8, yPay - rHi * H - 44 - tagH);
    const shift = -round(Math.max(0, used - top0) / 2);
    axisY = round(axisY + shift);
    yPay = round(yPay + shift);
    H = round(H);
    const yOf = v => round(yPay - ((v - pay) / (vtop - pay)) * H);
    const yLo = yOf(lo),
      yEnd = yOf(end);
    const { barH, pctC, pillTop } = settle(H);
    // What you pay hangs under the bar, right-aligned to it.
    const pill = { x: round(xs + bw / 2 - pillW), y: round(yLo + pillTop), w: pillW, h: pillH };
    const pcy = pill.y + pillH / 2;
    const pts = vals.map((v, i) => [x0 + (i / SAMPLES) * (x1 - x0), yOf(v)]);
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x: round(x), y: round(y), size: round(size), font, fill, ...extra });

    const under = [],
      els = [],
      hand = [];
    // The period, there from the first frame: a quiet panel, the time axis and its two days.
    const panelTop = round(yOf(vtop) - (wide ? 44 : 52));
    under.push({ type: 'rect', x: x0, y: panelTop, w: round(x1 - x0), h: round(axisY - panelTop), r: 18, fill: 'surface', opacity: 0.55, enter: 'none', at: 0 });
    under.push({ type: 'line', x1: x0, y1: axisY, x2: x1, y2: axisY, stroke: 'line', width: 3, cap: 'round', enter: 'none', at: 0 });
    for (const x of [x0, x1]) under.push({ type: 'line', x1: x, y1: axisY, x2: x, y2: axisY + 14, stroke: 'line', width: 3, enter: 'none', at: 0 });
    const dateY = round(axisY + F.date * 1.4);
    const dateFit = wide ? 220 : round((x1 - x0) / 2 - 16);
    under.push(text('STARTLABEL', x0, dateY, F.date, 'semibold', 'muted', { fit: dateFit, enter: 'none', at: 0 }));
    under.push(text('ENDLABEL', x1, dateY, F.date, 'semibold', 'muted', { anchor: 'end', fit: dateFit, enter: 'none', at: 0 }));
    // What the period is: between the days in wide frames, on its own row under them in narrow ones.
    under.push(
      text('PERIOD', (x0 + x1) / 2, wide ? dateY : round(dateY + F.period * 1.5), F.period, 'semibold', 'ink', {
        anchor: 'middle',
        fit: wide ? round(x1 - x0 - 2 * (dateFit + 24)) : round(R - L),
        enter: 'rise',
        dist: 12,
        dur: 0.5,
        ...cued('PERIOD'),
      }),
    );

    // The price draws across the period with its area tinted in just behind the tip (a price
    // chart, and a change a phone can see); the tint clears and the line steps back once the
    // lower price is circled.
    const run = [0];
    for (let i = 1; i <= SAMPLES; i++) run.push(run[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tip = i => round(0.1 + (1.8 * run[i]) / run[SAMPLES]);
    const base = round(axisY - 2);
    for (let a = 0, SL = 6; a < SAMPLES; a += SL) {
      const z = Math.min(SAMPLES, a + SL + 1),
        edge = pts.slice(a, z + 1).map(([x, y]) => [round(x), y]);
      under.push({
        type: 'poly',
        points: [...edge, [edge.at(-1)[0], base], [edge[0][0], base]],
        closed: true,
        fill: 'wash2',
        enter: 'fade',
        dur: 0.3,
        ...cued('PERIOD', tip(Math.min(z, SAMPLES))),
        keys: [cued('LOWER', 0, { dur: 0.9, opacity: 0 })],
      });
    }
    els.push({
      type: 'path',
      d: smoothPath(pts),
      fill: 'none',
      stroke: 'accent2',
      width: wide ? 6 : 7,
      cap: 'round',
      join: 'round',
      enter: 'draw',
      drawEase: 'linear',
      dur: 1.8,
      ...cued('PERIOD', 0.1),
      keys: [cued('LOWER', 0, { dur: 0.9, opacity: 0.5 })],
    });

    // The two prices: a dot on the line and its value in a tag hung outside the period (above
    // and left of the first day, above and right of the last), so the line never runs under one.
    const marker = (x, v, side) => {
      const y = yOf(v),
        tw = tagW(v),
        tx = round(side < 0 ? x + 16 - tw : x - 16),
        ty = round(y - 40 - tagH);
      return { x, y, tw, tx, ty };
    };
    const S = marker(x0, start, -1),
      E = marker(x1, end, 1);
    const lower = lowStart ? S : E;
    const fadeBack = (cue, back) => [cued('LOWER', 0.1, { dur: 0.8, opacity: 0.32 }), ...(back ? [cued(back, 0.1, { dur: 0.6, opacity: 1 })] : [])];
    for (const [m, cue, v] of [
      [S, 'START', start],
      [E, 'END', end],
    ]) {
      const higher = m !== lower;
      // Today's price comes back when the gap to it is measured.
      const back = higher && cue === 'END' && gain ? 'GAIN' : null;
      els.push({ type: 'circle', cx: m.x, cy: m.y, r: dotR, fill: 'accent2', stroke: 'bg', width: 4, enter: 'pop', dur: 0.45, ...cued(cue), ...(higher ? { keys: fadeBack(cue, back) } : {}) });
      els.push({
        type: 'group',
        enter: 'rise',
        dist: 26,
        dur: 0.75,
        ...cued(cue),
        ...(higher ? { keys: fadeBack(cue, back) } : {}),
        children: [
          { type: 'rect', x: m.tx, y: round(m.ty), w: m.tw, h: tagH, r: 10, fill: 'accent2', enter: 'none' },
          { type: 'poly', points: [[m.x - 9, round(m.ty + tagH - 1)], [m.x + 9, round(m.ty + tagH - 1)], [m.x, round(m.ty + tagH + 24)]], closed: true, fill: 'accent2', enter: 'none' },
          text(cue === 'START' ? 'STARTLABEL' : 'ENDLABEL', m.tx + m.tw / 2, m.ty + tagPad + cap(tagD) + 2, tagD, 'semibold', 'bg', { anchor: 'middle', fit: round(m.tw - F.tag * 0.5), opacity: 0.86, enter: 'none' }),
          text(fmt(v), m.tx + m.tw / 2, m.ty + tagPad + cap(tagD) + 2 + tagGap + cap(F.tag), F.tag, 'bold', 'bg', { anchor: 'middle', fit: round(m.tw - F.tag * 0.6), enter: 'none' }),
        ],
      });
    }

    // The lower price: circled by hand, named under its dot, and carried by a dashed level line
    // to the purchase at the period's end.
    const rp = ring(lower.tx + lower.tw / 2, lower.ty + tagH / 2, lower.tw / 2 + 24, tagH / 2 + 20);
    hand.push({
      type: 'path',
      d: `M ${rp.map(p => p.join(' ')).join(' L ')}`,
      fill: 'none',
      stroke: 'accent',
      width: 5,
      cap: 'round',
      join: 'round',
      enter: 'draw',
      dur: 0.8,
      loop: { type: 'pulse', period: 2.6, amount: 0.03 },
      ...cued('LOWER'),
    });
    const pctX = round(xs - bw / 2 - 18);
    const wordsY = round(yLo + wordsBase);
    // The first day's words (far left) and what you pay's words (right) share a row only when the
    // bar is short: then they split the width between them.
    const sameRow = lowStart && wordsY + 14 > pill.y && wordsY - cap(F.words) - 14 < pill.y + pillH;
    const split = round((lower.tx + pill.x - 18) / 2);
    els.push(
      lowStart
        ? text('LOWER', lower.tx, wordsY, F.words, 'bold', 'accent', { fit: round(Math.min(560, pctX - numW(pct, F.pct) - 30 - lower.tx, sameRow ? split - 12 - lower.tx : Infinity)), enter: 'rise', dist: 18, dur: 0.6, ...cued('LOWER', 0.25) })
        : text('LOWER', pctX, wordsY, F.words, 'bold', 'accent', { anchor: 'end', fit: round(Math.min(560, pctX - x0 - 10)), enter: 'rise', dist: 18, dur: 0.6, ...cued('LOWER', 0.25) }),
    );
    const levelFrom = lower.x + dotR + 8,
      levelTo = round(xs - bw / 2);
    if (levelTo - levelFrom > 16)
      els.push({ type: 'line', x1: levelFrom, y1: yLo, x2: levelTo, y2: yLo, stroke: 'accent', width: 4, dash: [12, 10], cap: 'butt', enter: 'draw', dur: round(Math.min(0.9, 0.3 + (levelTo - levelFrom) / 2400)), ...cued('LOWER', 0.4) });

    // The discount: a bar dropping from the lower price to the price you pay, its size beside it.
    els.push({
      type: 'rect',
      x: round(xs - bw / 2),
      y: yLo,
      w: bw,
      h: round(barH),
      r: 4,
      fill: 'accent',
      enter: 'none',
      origin: [xs, yLo],
      ...cued('DISCOUNT'),
      keys: [cued('DISCOUNT', 0, { dur: 0, scaleY: 0 }), cued('DISCOUNT', 0, { dur: 0.7, ease: 'out', scaleY: 1 })],
    });
    els.push(text(pct, pctX, yLo + pctC + F.pct * 0.36, F.pct, 'bold', 'accent', { anchor: 'end', enter: 'drop', dist: 18, dur: 0.45, ...cued('DISCOUNT', 0.3) }));

    // What you pay: a solid pill under the bar, its words before it.
    els.push({
      type: 'group',
      enter: 'pop',
      dur: 0.45,
      origin: [round(pill.x + pillW / 2), round(pcy)],
      ...cued('PAY'),
      children: [
        { type: 'rect', ...pill, r: round(pillH / 2), fill: 'accent', enter: 'none' },
        text(fmt(pay), pill.x + pillW / 2, pcy + F.pay * 0.36, F.pay, 'bold', 'bg', { anchor: 'middle', fit: round(pillW - F.pay * 0.7), enter: 'none' }),
      ],
    });
    const payFit = round(Math.min(480, pill.x - 18 - (sameRow ? split + 12 : x0)));
    els.push(text('PAY', pill.x - 18, pcy + F.payWords * 0.36, F.payWords, 'bold', 'ink', { anchor: 'end', fit: payFit, enter: 'rise', dist: 14, dur: 0.4, ...cued('PAY', 0.15) }));

    // The gain: the gap from what you pay up to the last day's price shades in behind the bar,
    // bracketed, with its size and words beside the bracket (under the pill in narrow frames).
    if (gain) {
      const bx = round(xs - bw / 2 - 12);
      under.push({ type: 'rect', x: bx, y: yEnd, w: round(xb - bx), h: round(yPay - yEnd), r: 6, fill: 'wash', enter: 'none', origin: [round((bx + xb) / 2), yPay], ...cued('GAIN'), keys: [cued('GAIN', 0, { dur: 0, scaleY: 0 }), cued('GAIN', 0, { dur: 0.7, ease: 'out', scaleY: 1 })] });
      if (lowStart && bx - (x1 + dotR + 8) > 16)
        els.push({ type: 'line', x1: x1 + dotR + 8, y1: yEnd, x2: bx, y2: yEnd, stroke: 'muted', width: 3, dash: [3, 8], cap: 'round', enter: 'draw', dur: 0.4, ...cued('GAIN', 0.15) });
      els.push({ type: 'path', d: `M ${xb - 14} ${yEnd} L ${xb} ${yEnd} L ${xb} ${yPay} L ${xb - 14} ${yPay}`, fill: 'none', stroke: 'ink', width: 3, cap: 'round', join: 'round', enter: 'draw', dur: 0.6, ...cued('GAIN', 0.2) });
      const blockH = cap(F.gain) + 14 + F.gainWords;
      const [gx, gTop, anchor] = wide
        ? [xb + 24, Math.max((yPay + yEnd) / 2 - blockH / 2, yEnd + 12), 'start']
        : [pill.x + pillW, pill.y + pillH + 30, 'end'];
      const gFit = wide ? R + 40 - (xb + 24) : xb - x0;
      els.push({
        type: 'group',
        enter: 'rise',
        dist: 16,
        dur: 0.45,
        ...cued('GAIN', 0.35),
        children: [
          text(fmt(gap), gx, gTop + cap(F.gain), F.gain, 'bold', 'accent', { anchor, fit: round(gFit), enter: 'none' }),
          text('GAIN', gx, gTop + cap(F.gain) + 14 + F.gainWords * 0.9, F.gainWords, 'semibold', 'ink', { anchor, fit: round(gFit), enter: 'none' }),
        ],
      });
    }
    return { elements: [...crisp(under), ...crisp(els), ...hand] };
  },
};
