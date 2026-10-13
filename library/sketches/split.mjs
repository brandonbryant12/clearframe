import { round, tall, body } from '../../film/sketch-kit.mjs';

// A whole splits into its parts: one full bar (a paycheck, a premium, a budget) opens into
// segments sized by the real values, and each segment drops into its own labelled lane at the
// same place it held in the whole, so the lanes still tile the whole's width and the parts are
// seen to add up. Every value (and the total beside the whole) is printed from sketchParams,
// never drawn by eye; the last part, the remainder, is highlighted at the end.
// Moments: SPLIT, then ONE…FIVE (each part landing) and REST (the remainder highlighted).
const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];
const LABELS = ['PARTONE', 'PARTTWO', 'PARTTHREE', 'PARTFOUR', 'PARTFIVE'];

export default {
  name: 'split',
  order: 97,
  keep: true,
  summary:
    'A whole splits into its parts: one full bar opens into segments sized by the real values, each drops into its own labelled lane at the place it held in the whole, values print in a column, and the remainder is highlighted.',
  use: 'Where a paycheck goes (tax, insurance, savings, take-home), what a premium or fee is made of, how a budget or a fund is divided. Set the values with sketchParams {parts (2–5 numbers, in order, the remainder last), prefix, suffix, total}; replace WHOLE (what is split, e.g. "Your paycheck") and PARTONE…PARTFIVE (one per part, up to about 20 characters, e.g. "Taxes", "Take-home pay") with sketchText; land SPLIT, ONE…FIVE (each part landing) and REST (the remainder highlighted) on words with sketchSay. Segments are proportional to the values and the total beside the whole is their sum. The figures need a visible source like any number.',
  params: {
    parts: { default: [22, 8, 10, 60], list: true, length: [2, 5], about: 'the parts in order, the remainder last (2–5 values); each segment is its share of their sum' },
    prefix: { default: '', about: 'printed before each value, e.g. "$" (or "" for none)' },
    suffix: { default: '%', about: 'printed after each value, e.g. "%" (or "" for none)' },
    total: { default: true, about: 'true prints the sum of the parts beside the whole; false leaves it out' },
  },
  build(w, h, { params = {} } = {}) {
    const parts = params.parts ?? [22, 8, 10, 60];
    const prefix = params.prefix ?? '',
      suffix = params.suffix ?? '%';
    const showTotal = params.total ?? true;
    if (!Array.isArray(parts) || parts.length < 2 || parts.length > 5) throw new Error('sketchParams.parts for split takes 2–5 values');
    if (parts.some(v => !Number.isFinite(v) || v < 0)) throw new Error('sketchParams.parts for split must be numbers of 0 or more');
    if (typeof prefix !== 'string' || typeof suffix !== 'string') throw new Error('sketchParams.prefix and suffix for split must be text');
    if (typeof showTotal !== 'boolean') throw new Error('sketchParams.total for split must be true or false');
    const sum = parts.reduce((a, v) => a + v, 0);
    if (!(sum > 0)) throw new Error('sketchParams.parts for split must add up to more than 0');
    const n = parts.length;
    // Values print with the decimals they were given (at most two), with thousands separators.
    const dec = Math.min(2, Math.max(...parts.map(v => (String(v).split('.')[1] ?? '').length)));
    const fmt = v => `${prefix}${Number(v.toFixed(dec)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${suffix}`;

    const AT = { SPLIT: 1.2 };
    NAMES.slice(0, n).forEach((k, i) => (AT[k] = round(2.0 + i * 0.8)));
    AT.REST = round(AT[NAMES[n - 1]] + 1.3);

    const T = tall(w, h);
    const b = body(w, h);
    // Wide frames: names in a column left of the bars, values in a column on the right. Narrow
    // frames: each lane's name and value sit on a line above its bar.
    const wide = w >= 1400;
    // Short narrow frames (square, portrait) tighten the lanes so five still fit.
    const compact = !wide && h < 1500;
    const fs = wide ? { whole: 44, total: 52, label: 40, value: 44 } : !compact ? { whole: 40, total: 48, label: 36, value: 40 } : { whole: 36, total: 44, label: 30, value: 34 };
    let bx, bw, labelEnd, valueEnd, wholeY, wholeH, laneY, laneH, textY;
    if (wide) {
      const x0 = round(b.x + 40),
        x1 = round(b.x + b.w - 40);
      labelEnd = x0 + 420;
      bx = labelEnd + 44;
      valueEnd = x1;
      bw = round(valueEnd - 300 - bx);
      wholeH = 96;
      laneH = 60;
      const pitch = Math.min(112, round(450 / n));
      const height = wholeH + 56 + n * pitch;
      const y0 = round(Math.max(b.y - 10, b.y + (b.h - height) / 2 - 10));
      wholeY = y0;
      laneY = i => round(y0 + wholeH + 56 + pitch * i + (pitch - laneH) / 2);
      textY = (y, hh, size) => round(y + hh / 2 + size * 0.36);
    } else {
      // Type stays inside the title-safe width even after the beat's slow push (11.5% in).
      bx = round(Math.max(b.x, w * 0.115 + 6));
      bw = round(w - 2 * bx);
      labelEnd = bx;
      valueEnd = bx + bw;
      wholeH = compact ? 64 : 80;
      laneH = compact ? 34 : 46;
      // Each lane: its name and value on a line, then its bar.
      const above = compact ? 44 : 52;
      const room = T ? b.h - 40 : b.h + 40;
      const pitch = Math.max(compact ? 94 : 110, Math.min(150, round((room - (wholeH + 70 + 50)) / n)));
      const height = 70 + wholeH + 50 + n * pitch;
      const y0 = round(Math.max(T ? b.y - 140 : 180, b.y + (b.h - height) / 2 - (T ? 30 : 0)));
      wholeY = y0 + 70;
      laneY = i => round(wholeY + wholeH + 50 + pitch * i + above);
      textY = y => round(y - (compact ? 16 : 22));    }
    const wholeCy = round(wholeY + wholeH / 2);
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });

    // Each part's place in the whole: its share of the sum, laid end to end.
    let run = 0;
    const seg = parts.map(v => {
      const x = round(bx + (bw * run) / sum);
      run += v;
      return { x, w: Math.max(round(bx + (bw * run) / sum) - x, 0) };
    });
    const last = n - 1;

    const lane = i => {
      const cue = NAMES[i],
        at = AT[cue];
      const y = laneY(i);
      const later = (after, extra) => ({ cue, at: round(at + after), after, ...extra });
      return [
        // The lane's track: the whole's width, so each part is read against it.
        { type: 'rect', x: bx, y, w: bw, h: laneH, r: 10, fill: 'wash', opacity: 0.75, enter: 'fade', at: round(0.5 + i * 0.07), dur: 0.5 },
        text(LABELS[i], wide ? labelEnd : bx, wide ? textY(y, laneH, fs.label) : textY(y), fs.label, 'semibold', 'ink', {
          anchor: wide ? 'end' : 'start',
          fit: wide ? 420 : round(bw * 0.66),
          ...later(0.35, { enter: 'rise', dist: 14, dur: 0.4 }),
        }),
        text(fmt(parts[i]), valueEnd, wide ? textY(y, laneH, fs.value) : textY(y) + 2, fs.value, 'bold', 'ink', {
          anchor: 'end',
          fit: wide ? 250 : round(bw * 0.3),
          origin: [valueEnd, wide ? round(y + laneH / 2) : textY(y) - 14],
          ...later(0.5, { enter: 'rise', dist: 14, dur: 0.4 }),
          ...(i === last ? { keys: [{ cue: 'REST', at: round(AT.REST + 0.2), after: 0.2, dur: 0.5, ease: 'out', scale: 1.18 }] } : {}),
        }),
      ];
    };

    // The highlight round the remainder's row, behind its words.
    const ry = laneY(last);
    const ring = wide
      ? { x: labelEnd - 440, y: ry - 22, w: valueEnd + 28 - (labelEnd - 440), h: laneH + 44 }
      : { x: bx - 24, y: textY(ry) - 52, w: bw + 48, h: ry + laneH + 22 - (textY(ry) - 52) };

    return {
      elements: [
        // The whole: its name, the bar and (from the values) its total.
        text('WHOLE', wide ? labelEnd : bx, wide ? textY(wholeY, wholeH, fs.whole) : textY(wholeY), fs.whole, 'bold', 'ink', {
          anchor: wide ? 'end' : 'start',
          fit: wide ? 420 : round(bw * 0.62),
          enter: 'rise',
          at: 0.2,
          dur: 0.45,
        }),
        ...(showTotal
          ? [text(fmt(sum), valueEnd, wide ? textY(wholeY, wholeH, fs.total) : textY(wholeY) + 4, fs.total, 'bold', 'ink', { anchor: 'end', fit: wide ? 260 : round(bw * 0.34), enter: 'rise', at: 0.75, dur: 0.45 })]
          : []),
        { type: 'rect', x: bx, y: wholeY, w: bw, h: wholeH, r: 12, fill: 'none', stroke: 'line', width: 2, dash: [10, 8], enter: 'fade', cue: 'SPLIT', at: round(AT.SPLIT + 0.3), after: 0.3, dur: 0.5 },
        {
          type: 'rect',
          x: bx,
          y: wholeY,
          w: bw,
          h: wholeH,
          r: 12,
          fill: 'accent',
          origin: [bx, wholeCy],
          enter: 'grow-x',
          at: 0.35,
          dur: 0.8,
          exit: 'none',
          exitCue: 'SPLIT',
          exitAt: round(AT.SPLIT + 0.05),
        },
        ...parts.slice(0, last).flatMap((_, i) => lane(i)),
        // The remainder's highlight sits behind its own lane; it waits, unseen, from that part's
        // landing and fades up on REST.
        {
          type: 'rect',
          ...ring,
          r: 20,
          fill: 'wash',
          enter: 'none',
          cue: NAMES[last],
          at: AT[NAMES[last]],
          // Key opacity multiplies the element's own, so the band is drawn at 1 and keyed to 0 first.
          keys: [
            { cue: NAMES[last], at: AT[NAMES[last]], dur: 0, opacity: 0 },
            { cue: 'REST', at: AT.REST, dur: 0.5, opacity: 0.55 },
          ],
        },
        ...lane(last),
        // The parts: they take the whole's place on SPLIT, part by a hair, then each drops into
        // its lane at the same x, so the lanes still tile the whole.
        ...seg.flatMap(({ x, w: sw }, i) =>
          sw < 1
            ? []
            : [
                {
                  type: 'rect',
                  x,
                  y: wholeY,
                  w: sw,
                  h: wholeH,
                  r: Math.min(10, round(sw / 2)),
                  fill: 'accent',
                  stroke: 'bg',
                  width: 3,
                  origin: [round(x + sw / 2), wholeCy],
                  enter: 'none',
                  cue: 'SPLIT',
                  at: AT.SPLIT,
                  keys: [
                    { cue: 'SPLIT', at: round(AT.SPLIT + 0.05), after: 0.05, dur: 0.5, ease: 'out', x: round((i - (n - 1) / 2) * 10) },
                    { cue: NAMES[i], at: AT[NAMES[i]], dur: 0.75, ease: 'inOut', x: 0, y: round(laneY(i) + laneH / 2 - wholeCy), scaleY: round(laneH / wholeH * 1000) / 1000 },
                    ...(i === last ? [] : [{ cue: 'REST', at: AT.REST, dur: 0.6, ease: 'inOut', opacity: 0.4 }]),
                  ],
                },
              ],
        ),
        { type: 'rect', ...ring, r: 20, fill: 'none', stroke: 'accent', width: 3, enter: 'draw', cue: 'REST', at: AT.REST, dur: 0.7 },
      ],
    };
  },
};
