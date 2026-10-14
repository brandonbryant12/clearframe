import { crisp, round } from '../../film/sketch-kit.mjs';

// A sharp fall, what was done, and the recovery, drawn from the stated points only: a time axis
// in real days (months from the calendar, no values invented), the start on a 0% line with its day
// in a small ink tag, a dashed straight line down to the low (the source gives two points, not the
// path between them), the stated fall in a filled chip that slides out of the low, an optional pin
// raised from the line on the day something was done (a rebalance, a purchase) and an optional
// dashed climb back to 0%. No fills under the line, no gridline values: the only figure is the
// fall, printed from sketchParams, and every day on screen is printed from its param. A dot and a
// pale disc ride the head of each line, so each move reads on a phone (and as motion to draft).
// Moments: OPEN, FALL, LOW, then ACT (with act) and RECOVER (with back) in their dates' order.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = 86400000;

/** A "YYYY-MM-DD" param as a day number (UTC), refused by name when it is not a real date. */
function day(name, s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) throw new Error(`sketchParams.${name} for drawdown must be a date written YYYY-MM-DD, like "2027-08-19" (got ${JSON.stringify(s)})`);
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d),
    back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d)
    throw new Error(`sketchParams.${name} for drawdown is not a date on the calendar (got "${s}")`);
  return t / DAY;
}
const ymd = n => {
  const d = new Date(n * DAY);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
};
const short = n => `${MONTHS[ymd(n)[1]]} ${ymd(n)[2]}`;
const quarterStart = n => Date.UTC(ymd(n)[0], ymd(n)[1] - (ymd(n)[1] % 3), 1) / DAY;
const quarterEnd = n => Date.UTC(ymd(n)[0], ymd(n)[1] - (ymd(n)[1] % 3) + 3, 0) / DAY;

export default {
  name: 'drawdown',
  keep: true,
  order: 103,
  summary:
    'A sharp fall and the recovery, from the stated points only: a time axis in real days, the start on a 0% line, a dashed straight line down to the low with the stated fall in a chip, an optional pin on the day something was done (a rebalance), and an optional dashed climb back to 0%. No invented path, no fills.',
  use: 'A market letter\'s drawdown, a fund\'s quarter, any "fell X% from one date to another, then recovered": "shares fell 6.4% from August 4 to August 19; the next day we rebalanced, buying shares; by September 12 they were back". Set sketchParams from the letter, e.g. {start: "2027-08-04", low: "2027-08-19", drop: 6.4, act: "2027-08-20", back: "2027-09-12"}: start, low, act and back are days written YYYY-MM-DD; act (the day something was done) and back (the day it was back where it started) are optional, and "" (their default) draws no pin and no recovery, so never set one the source does not state. drop is the stated fall as a positive percent (6.4 for a 6.4% fall), printed with decimals as the source prints it; from and to set the time axis ("" takes the calendar quarter or quarters around the days). The axis shows real months, the only figure drawn is the fall (and the start\'s 0%), and every day on screen is printed from its param. Replace TITLE (what the line measures, e.g. "Shares in the balanced portfolio"), SUBTITLE (e.g. "Change in value since August 4, 2027"), with act ACTLABEL (up to about 18 characters, e.g. "Rebalanced Aug 20") and ACTNOTE (e.g. "bought shares"), and with back BACKLABEL (up to about 15 characters, e.g. "Back by Sep 12") with sketchText; "" removes a line. Land OPEN (the axis, then the start), FALL (the line falls to the low), LOW (the chip with the fall: the spoken figure is a good word), ACT (with act: the pin rises) and RECOVER (with back: the line climbs back) on words in that order with sketchSay; ACT and RECOVER follow their days (an action after the recovery comes after RECOVER). Each move lasts one to two seconds: words more than about two and a half seconds apart leave the picture still between them. The fall needs a visible source like any figure. For a value that holds while the market moves, use hold; for a whole series of real observations, canvas props.plot (docs/quantitative-plots.md).',
  params: {
    start: { default: '2027-08-04', figure: false, about: 'the day the fall is measured from (the 0% point), written YYYY-MM-DD' },
    low: { default: '2027-08-19', figure: false, about: 'the day of the low, written YYYY-MM-DD' },
    drop: {
      default: 6.4,
      min: 0.01,
      max: 100,
      about: 'the stated fall from start to low, in percent (6.4 for a 6.4% fall)',
      hint: 'A positive percent: a fall of 6.4% is 6.4 (not −6.4, and not 0.064).',
    },
    act: {
      default: '',
      figure: false,
      about: 'the day something was done (a rebalance, a purchase), written YYYY-MM-DD: adds the ACT moment (a pin raised from the line) and the words ACTLABEL and ACTNOTE; "" for none',
    },
    back: {
      default: '',
      figure: false,
      about: 'the day it was back where it started, written YYYY-MM-DD: adds the RECOVER moment (the climb back to 0%) and the words BACKLABEL; "" when the source does not say',
    },
    from: { default: '', figure: false, about: 'the first day on the time axis, YYYY-MM-DD ("" for the start of the quarter the dates begin in)' },
    to: { default: '', figure: false, about: 'the last day on the time axis, YYYY-MM-DD ("" for the end of the quarter the dates end in)' },
    decimals: { default: 1, min: 0, max: 3, integer: true, figure: false, about: 'decimal places in the printed fall, as the source prints it (1 for −6.4%)' },
  },
  build(w, h, { params = {} } = {}) {
    const { start: s0 = '2027-08-04', low: l0 = '2027-08-19', drop = 6.4, act: a0 = '', back: b0 = '', from: f0 = '', to: t0 = '', decimals = 1 } = params;
    const start = day('start', s0),
      low = day('low', l0);
    const act = a0 ? day('act', a0) : null,
      back = b0 ? day('back', b0) : null;
    if (low <= start) throw new Error(`sketchParams.low for drawdown must come after start (got ${s0} to ${l0})`);
    if (back != null && back <= low) throw new Error(`sketchParams.back for drawdown must come after low (got ${l0} to ${b0})`);
    if (act != null && act < start) throw new Error(`sketchParams.act for drawdown must not come before start (got ${a0}, start ${s0})`);
    const dates = [start, low, act, back].filter(v => v != null);
    const first = Math.min(...dates),
      last = Math.max(...dates);
    const from = f0 ? day('from', f0) : quarterStart(first),
      to = t0 ? day('to', t0) : quarterEnd(last);
    if (from > first || to < last)
      throw new Error(`sketchParams.from and to for drawdown must take in every date (${short(first)} to ${short(last)}; got ${short(from)} to ${short(to)})`);
    const pct = `−${drop.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;

    // Moments: the start, the fall, its chip, then the action and the recovery in their dates' order.
    const later = [
      ...(act != null ? [['ACT', act, 0]] : []),
      ...(back != null ? [['RECOVER', back, 1]] : []),
    ].sort((a, b) => a[1] - b[1] || a[2] - b[2]);
    const AT = { OPEN: 0.3, FALL: 1.3, LOW: 3.2 };
    later.forEach(([cue], i) => (AT[cue] = round(4.6 + 1.8 * i)));
    const cued = (cue, dt = 0, extra = {}) => ({ cue, at: round(AT[cue] + dt), ...(dt ? { after: round(dt) } : {}), ...extra });
    const FALL_DUR = 1.6,
      RISE_DUR = 2;

    // Type: wide frames read at a distance; 1080-wide frames are sized for a phone.
    const wide = w > h * 1.25,
      phone = h > w * 1.5,
      square = !wide && h < w * 1.15;
    const F = Object.fromEntries(
      Object.entries(
        wide
          ? { title: 52, sub: 34, label: 32, value: 72, chipDate: 30, act: 32, note: 30, tick: 30 }
          : { title: 54, sub: 36, label: 36, value: 76, chipDate: 32, act: 34, note: 32, tick: 32 },
      ).map(([k, v]) => [k, round(square ? v * 0.9 : v)]),
    );
    const cap = s => 0.72 * s;
    const numW = (s, size) => s.length * 0.62 * size;
    const wordsW = (n, size) => n * 0.55 * size;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x: round(x), y: round(y), size: round(size), font, fill, ...extra });
    // A dashed line that draws on dash by dash behind a moving head (a stroke drawing on is drawn
    // solid until it lands, so each dash is its own short line). `at(f)` is the share of the
    // duration at which the head reaches share f of the length.
    const dashed = ([ax, ay], [bx, by], { on, off, cue, dur, delay = 0, at = f => f, ...paint }) => {
      const len = Math.hypot(bx - ax, by - ay),
        out = [];
      for (let s = 0; s < len - 2; s += on + off) {
        const e = Math.min(len, s + on),
          t0 = at(s / len) * dur,
          t1 = at(e / len) * dur;
        const pt = d => [round(ax + ((bx - ax) * d) / len), round(ay + ((by - ay) * d) / len)];
        const [[x1, y1], [x2, y2]] = [pt(s), pt(e)];
        out.push({ type: 'line', x1, y1, x2, y2, cap: 'butt', ...paint, enter: 'draw', drawEase: 'linear', dur: round(Math.max(0.04, t1 - t0)), ...cued(cue, round(delay + t0)) });
      }
      return out;
    };

    // Across: the title-safe width (a frame taller than wide loses a tenth each side to a phone's
    // buttons), then the time axis, inset a little so a tag over its first day stays inside.
    const L = wide ? 150 : h > w ? round(w * 0.1 + 24) : 84,
      R = w - L;
    const x0 = round(L + 24),
      x1 = round(R - (wide ? 16 : 4));
    const X = d => round(x0 + ((d - from) / (to - from)) * (x1 - x0));

    // Down: the title and subtitle, the action's pill and note (with act), the start's and the
    // recovery's labels over the 0% line, the depth of the fall, the chip's room, the time axis and
    // its months; the beat's source line sits under it all, higher on a tall frame.
    const dotR = 18,
      halo = wide ? 62 : 60,
      lineW = wide ? 12 : 11;
    const top0 = wide ? 96 : phone ? round(h * 0.1) : round(h * 0.08);
    // The months stay above the caption band (the bottom quarter of a wide frame, fifth of a tall one).
    const bottom0 = round(h * (h > w ? 0.8 : 0.75));
    let titleY = top0 + cap(F.title),
      subY = titleY + F.sub * 1.5;
    let band = subY + (wide ? 40 : 46);
    const pillH = round(F.act * 1.8),
      pillPad = round(F.act * 0.75),
      pillW = round(wordsW(18, F.act) + 2 * pillPad);
    let pillTop = band,
      noteY = band + pillH + 12 + cap(F.note);
    if (act != null) band = noteY + (wide ? 18 : 30);
    // The start's day and its 0% hang over it in a small ink tag (the low's chip in miniature);
    // the recovery's words share its row.
    const tagDay = round(F.label * 0.78),
      tagVal = round(F.label * 1.1),
      tagPadV = round(F.label * 0.34),
      tagIn = round(F.label * 0.24);
    const tagH = round(2 * tagPadV + cap(tagDay) + tagIn + cap(tagVal)),
      tagPad = round(F.label * 0.45),
      tagPtr = 10,
      tagGap = dotR + 6 + tagPtr;
    let Y0 = band + tagH + tagGap;
    let axisY = bottom0 - round(F.tick * 1.35);

    // The chip: the low's day over the fall, filled in the negative colour.
    const chipPad = round(F.value * 0.24),
      chipGap = round(F.value * 0.2);
    const chipH = round(2 * chipPad + cap(F.chipDate) + chipGap + cap(F.value)),
      chipW = round(Math.max(numW(pct, F.value), wordsW(short(low).length, F.chipDate) * 1.1) + 2 * round(F.value * 0.32));
    const ptr = 12;

    // Where the chip goes: beside the low at its level (left of the fall, else right of the
    // climb), or hanging under the low when neither side has room. Beside it, the low sits deeper.
    const lowFor = place => (place === 'below' ? axisY - 28 - chipH - ptr - 10 - dotR : axisY - 28 - chipH / 2);
    const xs = X(start),
      xl = X(low),
      xb = back != null ? X(back) : null,
      xa = act != null ? X(act) : null;
    const fits = (place, Ylow) => {
      const depth = Ylow - Y0;
      const edge = chipH / 2 + 12;
      if (place === 'left') {
        const right = Math.min(xl - (edge * (xl - xs)) / depth - 26, xl - halo - 10);
        return right - chipW >= L ? { x: round(right - chipW), lead: [round(right + 6), round(xl - dotR - 6)] } : null;
      }
      if (place === 'right') {
        const left = Math.max(xl + halo + 10, xb != null ? xl + (edge * (xb - xl)) / depth + 26 : 0);
        if (left + chipW > R) return null;
        // The action's pin hangs down to the line: it must not run through the chip.
        if (xa != null && act > low && xa > left - 14 && xa < left + chipW + 14) return null;
        return { x: round(left), lead: [round(xl + dotR + 6), round(left - 6)] };
      }
      return { x: round(Math.min(Math.max(xl - chipW / 2, L), R - chipW)) };
    };
    let place = 'left',
      spot = fits('left', lowFor('left'));
    if (!spot) [place, spot] = (s => (s ? ['right', s] : ['below', fits('below', lowFor('below'))]))(fits('right', lowFor('right')));
    let Ylow = round(lowFor(place));

    // A phone-tall frame keeps the fall a little shallower than the axis is wide (deeper, a quarter's
    // fall reads as a spike) and centres the chart in the height it leaves.
    const deepest = round(0.85 * (x1 - x0));
    if (phone && Ylow - Y0 > deepest) {
      const shift = round((Ylow - Y0 - deepest) / 2);
      [titleY, subY, pillTop, noteY, Y0] = [titleY, subY, pillTop, noteY, Y0].map(v => round(v + shift));
      Ylow = round(Ylow - shift);
      axisY = round(axisY - shift);
      spot = fits(place, Ylow) ?? spot;
    }
    const yOn = d => (d <= low ? Y0 + ((d - start) / (low - start)) * (Ylow - Y0) : back != null && d <= back ? Ylow - ((d - low) / (back - low)) * (Ylow - Y0) : null);

    const els = [];
    // The title and what the line measures, there from the first frame.
    els.push(text('TITLE', L, titleY, F.title, 'bold', 'ink', { fit: round(R - L), enter: 'none', at: 0 }));
    els.push(text('SUBTITLE', L, subY, F.sub, 'regular', 'muted', { fit: round(R - L), enter: 'none', at: 0 }));

    // OPEN: the axis draws, its months land left to right, the 0% line runs across; then the start
    // point lands with its day.
    els.push({ type: 'line', x1: x0, y1: Y0, x2: x1, y2: Y0, stroke: 'ink', width: 3, opacity: 0.4, cap: 'round', enter: 'draw', dur: 0.9, ...cued('OPEN') });
    els.push({ type: 'line', x1: x0, y1: axisY, x2: x1, y2: axisY, stroke: 'line', width: 3, cap: 'round', enter: 'draw', dur: 0.9, ...cued('OPEN') });
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
    const every = Math.max(1, Math.ceil((wordsW(crossYear ? 8 : 3, F.tick) + 40) / monthPx));
    const tick = (x, delay) => ({ type: 'line', x1: x, y1: axisY, x2: x, y2: axisY + 12, stroke: 'line', width: 3, enter: 'fade', dur: 0.3, ...cued('OPEN', delay) });
    els.push(tick(x0, 0.15), tick(x1, 0.6));
    els.push(text(firstLabel, x0, tickY, F.tick, 'regular', 'muted', { enter: 'fade', dur: 0.4, ...cued('OPEN', 0.15) }));
    const endW = wordsW(endLabel.length, F.tick),
      firstW = wordsW(firstLabel.length, F.tick);
    months.forEach((d, i) => {
      const x = X(d),
        [y, m] = ymd(d),
        label = crossYear && m === 0 ? `Jan ${y}` : MONTHS[m],
        half = wordsW(label.length, F.tick) / 2;
      els.push(tick(x, round(0.15 + (0.45 * (x - x0)) / (x1 - x0))));
      if ((i + 1) % every === 0 && x - half > x0 + firstW + 24 && x + half < x1 - endW - 24)
        els.push(text(label, x, tickY, F.tick, 'regular', 'muted', { anchor: 'middle', enter: 'fade', dur: 0.4, ...cued('OPEN', round(0.15 + (0.45 * (x - x0)) / (x1 - x0))) }));
    });
    els.push(text(endLabel, x1, tickY, F.tick, 'semibold', 'ink', { anchor: 'end', enter: 'fade', dur: 0.4, ...cued('OPEN', 0.6) }));

    // Halos behind the points: the start's, then one riding each line's head.
    const fallD = `M ${xs} ${Y0} L ${xl} ${Ylow}`;
    els.push({
      type: 'circle',
      cx: xs,
      cy: Y0,
      r: halo,
      fill: 'ink',
      opacity: 0.16,
      enter: 'pop',
      dur: 0.4,
      ...cued('OPEN', 0.6),
      keys: [cued('FALL', 0, { dur: 0.4, opacity: 0 })],
    });
    els.push({ type: 'circle', cx: xs, cy: Y0, r: halo, fill: 'negative', opacity: 0.22, enter: 'fade', dur: 0.2, ...cued('FALL'), along: { d: fallD, ease: 'linear', dur: FALL_DUR, ...cued('FALL') } });
    const riseD = back != null ? `M ${xl} ${Ylow} L ${xb} ${Y0}` : null;
    if (riseD)
      els.push({
        type: 'circle',
        cx: xl,
        cy: Ylow,
        r: halo,
        fill: 'ink',
        opacity: 0.16,
        enter: 'fade',
        dur: 0.2,
        ...cued('RECOVER'),
        along: { d: riseD, ease: 'linear', dur: RISE_DUR, ...cued('RECOVER') },
        keys: [cued('RECOVER', RISE_DUR + 0.2, { dur: 0.5, opacity: 0 })],
      });

    // ACT: a pin on the day, raised from the line (from the axis when no line passes there): its
    // dashed stem draws up while its pill rides the top to the row over the chart.
    const RAISE = 1.4;
    if (act != null) {
      const px = round(Math.min(Math.max(xa - pillW / 2, L), R - pillW));
      const on = yOn(act);
      const bottom = round(on != null ? on - dotR - 6 : place === 'below' && xa > spot.x - 12 && xa < spot.x + chipW + 12 ? Ylow + dotR + 4 : axisY - 6);
      const top = round(pillTop + pillH);
      // (The stem follows the pill's ease out: its head reaches share f of the way at 1 − (1 − f)^⅓.)
      els.push(...dashed([xa, bottom], [xa, top], { on: 12, off: 9, cue: 'ACT', dur: RAISE, at: f => 1 - Math.cbrt(1 - f), stroke: 'accent2', width: 5 }));
      els.push({
        type: 'group',
        enter: 'fade',
        dur: 0.2,
        ...cued('ACT'),
        keys: [cued('ACT', 0, { dur: 0, y: round(bottom - top) }), cued('ACT', 0, { dur: RAISE, ease: 'out', y: 0 })],
        children: [
          { type: 'rect', x: px, y: round(pillTop), w: pillW, h: pillH, r: round(pillH / 2), fill: 'accent2', enter: 'none' },
          text('ACTLABEL', px + pillW / 2, pillTop + pillH / 2 + cap(F.act) / 2, F.act, 'bold', 'bg', { anchor: 'middle', fit: round(pillW - 2 * pillPad + 10), enter: 'none' }),
        ],
      });
      // The note sits beside the pin, on whichever side has room.
      const noteW = wordsW(16, F.note);
      const right = xa + 16 + noteW <= R || xa + 16 - L >= R - xa;
      els.push(
        text('ACTNOTE', right ? xa + 16 : xa - 16, noteY, F.note, 'semibold', 'accent2', {
          ...(right ? {} : { anchor: 'end' }),
          fit: round(right ? R - xa - 16 : xa - 16 - L),
          enter: 'rise',
          dist: 12,
          dur: 0.45,
          ...cued('ACT', round(RAISE * 0.6)),
        }),
      );
    }

    // FALL: a dashed straight line from the start to the low (two stated points, no path between
    // them), with a dot riding its head that becomes the low.
    const dash = { on: 26, off: 10, width: lineW };
    els.push(...dashed([xs, Y0], [xl, Ylow], { ...dash, cue: 'FALL', dur: FALL_DUR, stroke: 'negative' }));
    // RECOVER: the climb back to 0%, in ink (the recovery is not credited to anything drawn).
    if (riseD) els.push(...dashed([xl, Ylow], [xb, Y0], { ...dash, cue: 'RECOVER', dur: RISE_DUR, stroke: 'ink' }));

    // The points: the start (with its day over it), the low riding down the fall, the recovery
    // riding up the climb (with its words over it).
    els.push({ type: 'circle', cx: xs, cy: Y0, r: dotR, fill: 'ink', stroke: 'bg', width: 4, enter: 'pop', dur: 0.4, ...cued('OPEN', 0.6) });
    // The labels over the 0% line keep clear of each other and of the action's pin: centred over
    // their point when they can be, else beside it; the recovery's words drop under the line,
    // right of its point, when the row has no room.
    const tagTop = round(Y0 - tagGap - tagH),
      labelY = round(tagTop + tagH / 2 + cap(F.label) / 2);
    const pin = xa != null ? [[xa - 10, xa + 10]] : [];
    const clear = (a, b, avoid) => a >= L && b <= R && !avoid.some(([p, q]) => a < q && b > p);
    // Centred over the point, else starting just left of it, else ending just right of it.
    const spots = (x, w, o = 14) => [
      { x, anchor: 'middle', a: x - w / 2, b: x + w / 2 },
      { x: x - o, anchor: 'start', a: x - o, b: x - o + w },
      { x: x + o, anchor: 'end', a: x + o - w, b: x + o },
    ];
    const beside = (x, w, avoid, o) => spots(x, w, o).find(c => clear(c.a, c.b, avoid));
    const centred = (x, w) => {
      const c = Math.min(Math.max(x, L + w / 2), R - w / 2);
      return { x: c, anchor: 'middle', a: c - w / 2, b: c + w / 2 };
    };
    const sw = round(Math.max(wordsW(short(start).length, tagDay) * 1.1, numW('0%', tagVal)) + 2 * tagPad);
    const st = beside(xs, sw, pin, 26) ?? centred(xs, sw);
    els.push({
      type: 'group',
      enter: 'rise',
      dist: 24,
      dur: 0.6,
      ...cued('OPEN', 0.85),
      children: [
        { type: 'rect', x: round(st.a), y: tagTop, w: sw, h: tagH, r: 10, fill: 'ink', enter: 'none' },
        { type: 'poly', points: [[xs - 9, tagTop + tagH - 1], [xs + 9, tagTop + tagH - 1], [xs, round(Y0 - dotR - 6)]].map(p => p.map(round)), closed: true, fill: 'ink', enter: 'none' },
        text(short(start), (st.a + st.b) / 2, tagTop + tagPadV + cap(tagDay), tagDay, 'semibold', 'bg', { anchor: 'middle', opacity: 0.88, fit: round(sw - tagPad), enter: 'none' }),
        text('0%', (st.a + st.b) / 2, tagTop + tagPadV + cap(tagDay) + tagIn + cap(tagVal), tagVal, 'bold', 'bg', { anchor: 'middle', fit: round(sw - tagPad), enter: 'none' }),
      ],
    });
    els.push({
      type: 'circle',
      cx: xs,
      cy: Y0,
      r: dotR,
      fill: 'negative',
      stroke: 'bg',
      width: 4,
      enter: 'fade',
      dur: 0.15,
      ...cued('FALL'),
      along: { d: fallD, ease: 'linear', dur: FALL_DUR, ...cued('FALL') },
      origin: [xs, Y0],
      // The low pulses as its chip lands.
      keys: [cued('LOW', 0, { dur: 0.5, ease: 'thereAndBack', scale: 1.4 })],
    });
    if (riseD) {
      els.push({ type: 'circle', cx: xl, cy: Ylow, r: dotR, fill: 'ink', stroke: 'bg', width: 4, enter: 'fade', dur: 0.15, ...cued('RECOVER'), along: { d: riseD, ease: 'linear', dur: RISE_DUR, ...cued('RECOVER') } });
      // (Its words are the author's: sized for about 15 characters.) Over the line, clear of the
      // start's label and the pin; else under the line, right of the point; else clear of the
      // start's label only (the pin may cross it).
      const bw = wordsW(15, F.label),
        own = [[st.a - 16, st.b + 16]];
      const underX = xb + dotR + 14,
        under = { x: underX, anchor: 'start', a: underX, b: underX + bw, under: true };
      const bt =
        beside(xb, bw, [...pin, ...own]) ??
        (clear(under.a, under.b, pin) ? under : null) ??
        beside(xb, bw, own) ??
        (clear(under.a, under.b, []) ? under : centred(xb, bw));
      els.push(
        text('BACKLABEL', bt.x, bt.under ? round(Y0 + 18 + cap(F.label)) : labelY, F.label, 'semibold', 'ink', {
          anchor: bt.anchor,
          fit: round(Math.min(wordsW(18, F.label), bt.anchor === 'start' ? R - bt.x : bt.anchor === 'end' ? bt.x - L : R - L)),
          enter: 'rise',
          dist: 14,
          dur: 0.45,
          ...cued('RECOVER', round(RISE_DUR * 0.8)),
        }),
      );
    }

    // LOW: the chip with the low's day over the stated fall, beside the low with a dashed leader,
    // or hanging under it with a pointer.
    const chipY = place === 'below' ? Ylow + dotR + 10 + ptr : round(Ylow - chipH / 2);
    const chip = { x: spot.x, y: round(chipY), w: chipW, h: chipH };
    const cx = round(chip.x + chipW / 2);
    const tip = place === 'left' ? [chip.x + chipW, Ylow] : place === 'right' ? [chip.x, Ylow] : [Math.min(Math.max(xl, chip.x + 24), chip.x + chipW - 24), chip.y];
    // It slides out of the low as it lands.
    const slide = place === 'left' ? { x: 120 } : place === 'right' ? { x: -120 } : { y: -50 };
    els.push({
      type: 'group',
      enter: 'fade',
      dur: 0.25,
      ...cued('LOW'),
      keys: [cued('LOW', 0, { dur: 0, ...slide }), cued('LOW', 0, { dur: 0.9, ease: 'out', ...Object.fromEntries(Object.keys(slide).map(k => [k, 0])) })],
      children: [
        { type: 'rect', ...chip, r: 14, fill: 'negative', enter: 'none' },
        ...(place === 'below' ? [{ type: 'poly', points: [[tip[0] - 11, chip.y + 1], [tip[0] + 11, chip.y + 1], [tip[0], chip.y - ptr]].map(p => p.map(round)), closed: true, fill: 'negative', enter: 'none' }] : []),
        text(short(low), cx, chip.y + chipPad + cap(F.chipDate), F.chipDate, 'semibold', 'bg', { anchor: 'middle', opacity: 0.88, fit: round(chipW - 24), enter: 'none' }),
        text(pct, cx, chip.y + chipPad + cap(F.chipDate) + chipGap + cap(F.value), F.value, 'bold', 'bg', { anchor: 'middle', fit: round(chipW - 20), enter: 'none' }),
      ],
    });
    if (spot.lead && spot.lead[1] - spot.lead[0] > 14)
      els.push({ type: 'line', x1: spot.lead[0], y1: Ylow, x2: spot.lead[1], y2: Ylow, stroke: 'negative', width: 3, dash: [8, 7], cap: 'butt', enter: 'fade', dur: 0.4, ...cued('LOW', 0.6) });
    // A drawn line stays a chart line in a hand-drawn or printed film: every point is a stated one.
    return { elements: crisp(els) };
  },
};
