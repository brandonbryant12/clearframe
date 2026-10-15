import { round } from '../../film/sketch-kit.mjs';

// A small amount, every period, adds up: one card per period (26 paychecks, 12 months, 52 weeks).
// The first lands on its word with the amount it carries; the rest follow in quick order; then the
// total, multiplied out here so it always agrees with the cards. "$6 more on each of 26
// paychecks" is $156 a year. Moments: EACH (the first card), ALL (the rest), TOTAL.
const AT = { EACH: 0.6, ALL: 1.8, TOTAL: 3.6 };

export default {
  name: 'every',
  keep: true,
  order: 98,
  summary:
    'A small amount, every period, adds up: one card per period (paychecks, months, weeks); the first lands on its word with its amount, the rest follow in quick order, then the total, multiplied out so it always agrees with the cards.',
  use: 'A per-paycheck or monthly figure and what it comes to in a year: "$6 more on each of 26 paychecks", "$40 a month in fees", "$25 a week". Set sketchParams {count, amount, prefix, decimals, sign, tone}: count periods (2–52), amount per period, sign "+" or "−" for a change (or "" for a plain amount); replace EACHLABEL (e.g. "more each paycheck") and TOTALLABEL (e.g. "more a year") with sketchText; land EACH, ALL and TOTAL on words with sketchSay. The total is count × amount: only use it when the source states it or the line says it.',
  params: {
    count: { default: 26, min: 2, max: 52, integer: true, about: 'periods: 26 paychecks, 12 months, 52 weeks' },
    amount: { default: 6, min: 0.01, max: 1e7, about: 'the amount each period' },
    prefix: { default: '$', about: 'printed before each amount' },
    decimals: { default: 0, min: 0, max: 2, integer: true, figure: false, about: 'decimals the source prints' },
    sign: { default: '+', oneOf: ['+', '−', ''], about: 'a change up (+), down (−), or a plain amount ("")' },
    tone: { default: 'accent', oneOf: ['accent', 'negative', 'positive'], about: 'colour of the amounts: negative for a cost, positive for a saving' },
  },
  build(w, h, { params = {} } = {}) {
    const { count = 26, amount = 6, prefix = '$', decimals = 0, sign = '+', tone = 'accent' } = params;
    const T = h > w * 1.1;
    const fmt = v => `${sign}${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    const total = Math.round(count * amount * 10 ** decimals) / 10 ** decimals;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const els = [];
    // The grid of periods, inside the safe width and above the captions.
    const side = T ? round(w * 0.115) + 4 : 160;
    const W = w - side * 2;
    const cols = T ? Math.min(count, count > 24 ? 6 : 4) : Math.min(count, 13);
    const rows = Math.ceil(count / cols);
    const gap = T ? 14 : 12;
    const cw = Math.min(T ? 140 : 120, (W - (cols - 1) * gap) / cols);
    const chh = round(cw * 0.62);
    const gridW = cols * cw + (cols - 1) * gap;
    const gridH = rows * chh + (rows - 1) * gap;
    const big = T ? 96 : 88;
    // The first card's amount and label above the grid, the total below it: the whole stack centred
    // in the safe height above the captions.
    const stack = big * 1.1 + 70 + gridH + 40 + big * 0.8 + 56;
    const [safeTop, safeBottom] = [h * (T ? 0.12 : 0.1), h * (T ? 0.78 : 0.74)];
    const top = round(safeTop + Math.max(0, (safeBottom - safeTop - stack) / 2));
    const gy = round(top + big * 1.1 + 70);
    const gx = round((w - gridW) / 2);
    // Each card says its amount when there is room for it in the card.
    const inCard = fmt(amount).length * 30 * 0.6 + 16 <= cw;
    els.push(text(fmt(amount), side, top + big * 0.8, big, 'bold', tone, { enter: 'rise', dist: 20, dur: 0.35, cue: 'EACH', at: AT.EACH }));
    els.push(text('EACHLABEL', side, top + big * 0.8 + 56, 40, 'text', 'ink', { width: W, enter: 'fade', dur: 0.3, cue: 'EACH', at: AT.EACH + 0.2, after: 0.2 }));
    const step = Math.min(0.09, 1.6 / count);
    for (let i = 0; i < count; i++) {
      const [c, r] = [i % cols, Math.floor(i / cols)];
      const [x, y] = [round(gx + c * (cw + gap)), round(gy + r * (chh + gap))];
      const when = i ? { cue: 'ALL', at: round(AT.ALL + (i - 1) * step), ...(i > 1 ? { after: round((i - 1) * step) } : {}) } : { cue: 'EACH', at: AT.EACH };
      els.push({
        type: 'group',
        id: `every-${i + 1}`,
        enter: 'pop',
        dur: 0.25,
        ...when,
        children: [
          { type: 'rect', x, y, w: round(cw), h: chh, r: round(chh * 0.22), fill: i ? 'surface' : tone, stroke: i ? 'line' : 'none', width: 2 },
          ...(inCard ? [text(fmt(amount), round(x + cw / 2), round(y + chh / 2 + 11), 30, 'bold', i ? tone : 'bg', { anchor: 'middle' })] : []),
        ],
      });
    }
    // TOTAL: what the periods come to.
    const ty = round(gy + gridH + 40 + big * 0.8);
    els.push(text(fmt(total), side, ty, big, 'bold', tone, { enter: 'rise', dist: 20, dur: 0.4, cue: 'TOTAL', at: AT.TOTAL, sound: 'thud' }));
    els.push(text('TOTALLABEL', side, ty + 56, 40, 'text', 'ink', { width: W, enter: 'fade', dur: 0.3, cue: 'TOTAL', at: AT.TOTAL + 0.2, after: 0.2 }));
    return { elements: els };
  },
};
