import { round, tall } from '../../film/sketch-kit.mjs';

// Two contributions that become one: your coins drop into a stack, the company's drop in beside
// them, then the two stacks come together into one with its total on top. One coin is one unit
// (a percent of pay, a dollar, a share), so the picture agrees with the figures: the counts come
// from sketchParams, not from the drawing. Moments: YOU, MATCH, TOTAL.
const AT = { YOU: 0.5, MATCH: 2.4, TOTAL: 4.6 };

export default {
  name: 'match',
  keep: true,
  order: 91,
  summary:
    'Two contributions become one: your coins drop into a stack, the company’s drop in beside them, and the stacks merge into one with its total on top. One coin per unit, counted from the real figures.',
  use: 'An employer match, a grant on top of savings, a fee that adds to a price, any "you put in this, they add that". Set the counts with sketchParams {you, match, suffix}; replace YOU, EMPLOYER, EACH (what one coin is, e.g. "Each coin: 1% of your pay") and TOTAL (words after the total) with sketchText; land YOU, MATCH and TOTAL on words with sketchSay. The figures need a visible source like any number.',
  params: {
    you: { default: 5, min: 0, max: 12, integer: true, about: 'coins you put in' },
    match: { default: 4, min: 0, max: 12, integer: true, about: 'coins the other side adds' },
    suffix: { default: '%', about: 'unit printed after each count, e.g. "%" (or "" for none)' },
  },
  build(w, h, { params = {} } = {}) {
    const you = params.you ?? 5,
      match = params.match ?? 4,
      suffix = params.suffix ?? '%';
    const T = tall(w, h);
    const rx = T ? 190 : 150,
      ry = T ? 50 : 40,
      t = T ? 34 : 32,
      step = t + 10;
    const base = T ? 1300 : 760;
    const gap = T ? 430 : 520;
    const [x1, x2] = [round(w / 2 - gap / 2), round(w / 2 + gap / 2)];
    // When the stacks merge, both travel to the middle and the company's coins sit on yours.
    const mid = round(w / 2);
    const coin = (x, i, fill, at, cue) => {
      const y = round(base - i * step);
      return {
        type: 'group',
        enter: 'drop',
        dist: 260,
        cue,
        at,
        after: round(at - AT[cue]),
        dur: 0.42,
        children: [
          { type: 'ellipse', cx: x, cy: y + t, rx, ry, fill, enter: 'none' },
          { type: 'rect', x: x - rx, y, w: 2 * rx, h: t, fill, enter: 'none' },
          { type: 'ellipse', cx: x, cy: y + t, rx, ry, fill: 'ink', opacity: 0.22, enter: 'none' },
          { type: 'rect', x: x - rx, y, w: 2 * rx, h: t, fill: 'ink', opacity: 0.22, enter: 'none' },
          { type: 'ellipse', cx: x, cy: y, rx, ry, fill, stroke: 'bg', width: 2, enter: 'none' },
          { type: 'ellipse', cx: x, cy: y, rx: round(rx * 0.68), ry: round(ry * 0.68), fill: 'none', stroke: 'bg', width: 3, opacity: 0.55, enter: 'none' },
        ],
      };
    };
    const yours = Array.from({ length: you }, (_, i) => coin(x1, i, 'accent', round(AT.YOU + i * 0.14), 'YOU'));
    const theirs = Array.from({ length: match }, (_, i) => coin(x2, i, 'accent2', round(AT.MATCH + i * 0.14), 'MATCH'));
    const top = n => round(base - Math.max(n - 1, 0) * step - ry - 40);
    const label = (text, x, y, size, font, fill, extra = {}) => ({ type: 'text', text, x, y, size, font, fill, anchor: 'middle', ...extra });
    const merge = { cue: 'TOTAL', at: AT.TOTAL, dur: 1.1, ease: 'inOut' };
    const total = you + match;
    return {
      elements: [
        // The floor the stacks stand on.
        { type: 'ellipse', cx: mid, cy: base + t + 10, rx: round(gap / 2 + rx * 1.6), ry: round(ry * 1.4), fill: 'wash', enter: 'fade', at: 0, dur: 0.5 },
        // Your stack and its count; it moves to the middle when the two merge.
        {
          type: 'group',
          enter: 'none',
          at: 0,
          keys: [{ ...merge, x: mid - x1 }],
          children: [
            ...yours,
            label(`${you}${suffix}`, x1, top(you), 64, 'bold', 'accent', {
              enter: 'rise',
              cue: 'YOU',
              at: round(AT.YOU + you * 0.14 + 0.2),
              after: round(you * 0.14 + 0.2),
              exit: 'fade',
              exitCue: 'TOTAL',
              exitAt: AT.TOTAL,
              exitDur: 0.25,
            }),
          ],
        },
        // The company's stack lands on top of yours.
        {
          type: 'group',
          enter: 'none',
          at: 0,
          keys: [{ ...merge, x: mid - x2, y: -you * step }],
          children: [
            ...theirs,
            label(`+${match}${suffix}`, x2, top(match), 64, 'bold', 'accent2', {
              enter: 'rise',
              cue: 'MATCH',
              at: round(AT.MATCH + match * 0.14 + 0.2),
              after: round(match * 0.14 + 0.2),
              exit: 'fade',
              exitCue: 'TOTAL',
              exitAt: AT.TOTAL,
              exitDur: 0.25,
            }),
          ],
        },
        // Names under the stacks, gone once there is one stack.
        ...[
          [x1, 'YOU', 'YOU', AT.YOU],
          [x2, 'EMPLOYER', 'MATCH', AT.MATCH],
        ].map(([x, text, cue, at]) =>
          label(text, x, base + t + 90, 40, 'semibold', 'ink', {
            fit: gap - 40,
            enter: 'fade',
            cue,
            at,
            exit: 'fade',
            exitCue: 'TOTAL',
            exitAt: AT.TOTAL,
            exitDur: 0.25,
          }),
        ),
        // The total over the merged stack, and what it is.
        label(`${total}${suffix}`, mid, top(total), 96, 'bold', 'ink', { enter: 'pop', cue: 'TOTAL', at: AT.TOTAL + 1.0, after: 1.0, dur: 0.4 }),
        label('TOTAL', mid, base + t + 90, 40, 'semibold', 'ink', { fit: w - 240, enter: 'rise', cue: 'TOTAL', at: AT.TOTAL + 1.2, after: 1.2 }),
        label('EACH', mid, base + t + 150, 28, 'regular', 'muted', { fit: w - 240, enter: 'fade', at: AT.YOU + 0.6 }),
      ],
    };
  },
};
