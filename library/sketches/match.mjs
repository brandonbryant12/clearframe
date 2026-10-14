import { round, tall } from '../../film/sketch-kit.mjs';

// Two contributions that become one: your coins drop into a stack, the company's drop in beside
// them, then the two stacks come together into one with its total on top. One coin is one unit
// (a percent of pay, a dollar, a share), so the picture agrees with the figures: the counts come
// from sketchParams, not from the drawing. Moments: YOU, MATCH, TOTAL.
const AT = { NOWYOU: 0.6, NOWMATCH: 1.4, YOU: 0.5, MATCH: 2.4, TOTAL: 4.6, AGAIN: 7.2 };

export default {
  name: 'match',
  keep: true,
  order: 91,
  summary:
    'Two contributions become one: your coins drop into a stack, the company’s drop in beside them, and the stacks merge into one with its total on top. One coin per unit, counted from the real figures.',
  use: 'An employer match, a grant on top of savings, a fee that adds to a price, any "you put in this, they add that". Set the counts with sketchParams {you, match, suffix}; for a what-if (raise 3% to 5%) add {fromYou, fromMatch}: the beat opens on the current coins and only the added ones drop (with start: "empty", today’s coins drop first, on NOWYOU and NOWMATCH: "you save three… they add three"); {again: 3} lines up more stacks like the total on AGAIN ("every paycheck"), with AGAIN as the line under them; replace YOU, EMPLOYER, EACH (what one coin is, e.g. "Each coin: 1% of your pay") and TOTAL (words after the total) with sketchText; land YOU, MATCH and TOTAL on words with sketchSay. The figures need a visible source like any number.',
  params: {
    you: { default: 5, min: 0, max: 12, integer: true, about: 'coins you put in', hint: 'One coin per unit: 5 and 4 for 5% and 4% of pay. For money, pick a unit both fit in 12 coins (e.g. $250 a coin) and say so in EACH.' },
    match: { default: 4, min: 0, max: 12, integer: true, about: 'coins the other side adds', hint: 'One coin per unit: 5 and 4 for 5% and 4% of pay. For money, pick a unit both fit in 12 coins (e.g. $250 a coin) and say so in EACH.' },
    suffix: { default: '%', about: 'unit printed after each count, e.g. "%" (or "" for none)' },
    fromYou: { default: 0, min: 0, max: 12, integer: true, about: 'what if: coins already yours on the first frame (the current state), e.g. 3 when raising 3% to 5%' },
    fromMatch: { default: 0, min: 0, max: 12, integer: true, about: 'what if: the company coins already there on the first frame, e.g. 3' },
    again: { default: 0, min: 0, max: 5, integer: true, about: 'every paycheck: on AGAIN, this many more stacks like the total line up beside it (0 for none)' },
    start: { default: 'drawn', oneOf: ['drawn', 'empty'], about: 'what if: drawn opens on today’s coins; empty drops them on NOWYOU and NOWMATCH ("you save three… they add three") before the change' },
  },
  build(w, h, { params = {} } = {}) {
    const you = params.you ?? 5,
      match = params.match ?? 4,
      suffix = params.suffix ?? '%';
    // What if: the picture opens on the current state (fromYou, fromMatch) and only the coins
    // the change adds drop in on their words, so one beat shows the before and the after.
    const fromYou = Math.min(params.fromYou ?? 0, you),
      fromMatch = Math.min(params.fromMatch ?? 0, match),
      again = params.again ?? 0;
    // Today's coins drop on their own words first, and the rest of the beat follows them.
    const grow = params.start === 'empty' && (fromYou > 0 || fromMatch > 0);
    const M = grow ? { ...AT, YOU: AT.YOU + 1.6, MATCH: AT.MATCH + 1.6, TOTAL: AT.TOTAL + 1.6, AGAIN: AT.AGAIN + 1.6 } : AT;
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
    const coin = (x, i, fill, at, cue, ready = false) => {
      const y = round(base - i * step);
      return {
        type: 'group',
        ...(ready && !grow
          ? { enter: 'none', at: 0 }
          : ready
            ? { enter: 'drop', dist: 260, cue: `NOW${cue}`, at: round(M[`NOW${cue}`] + i * 0.14), after: round(i * 0.14), dur: 0.42 }
            : { enter: 'drop', dist: 260, cue, at, after: round(at - M[cue]), dur: 0.42 }),
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
    const yours = Array.from({ length: you }, (_, i) =>
      coin(x1, i, 'accent', round(M.YOU + Math.max(0, i - fromYou) * 0.14), 'YOU', i < fromYou),
    );
    const theirs = Array.from({ length: match }, (_, i) =>
      coin(x2, i, 'accent2', round(M.MATCH + Math.max(0, i - fromMatch) * 0.14), 'MATCH', i < fromMatch),
    );
    // The count above a stack: the current one from the first frame, the new one on its word.
    const counts = (x, from, to, prefix, fill, cue) => {
      const landed = round((to - from) * 0.14 + 0.2);
      const now = {
        enter: 'rise',
        cue,
        at: round(M[cue] + landed),
        after: landed,
        exit: 'fade',
        exitCue: 'TOTAL',
        exitAt: M.TOTAL,
        exitDur: 0.25,
      };
      if (!from || from === to) return [label(`${prefix}${to}${suffix}`, x, top(to), 64, 'bold', fill, now)];
      return [
        label(`${prefix}${from}${suffix}`, x, top(from), 64, 'bold', fill, {
          ...(grow ? { enter: 'rise', cue: `NOW${cue}`, at: round(M[`NOW${cue}`] + from * 0.14 + 0.2), after: round(from * 0.14 + 0.2) } : { enter: 'fade', at: 0.2 }),
          exit: 'fade', exitCue: cue, exitAt: M[cue], exitDur: 0.2,
        }),
        label(`${prefix}${to}${suffix}`, x, top(to), 64, 'bold', fill, now),
      ];
    };
    const top = n => round(base - Math.max(n - 1, 0) * step - ry - 40);
    const label = (text, x, y, size, font, fill, extra = {}) => ({ type: 'text', text, x, y, size, font, fill, anchor: 'middle', ...extra });
    const merge = { cue: 'TOTAL', at: M.TOTAL, dur: 1.1, ease: 'inOut' };
    const total = you + match;
    return {
      elements: [
        // The floor the stacks stand on.
        { type: 'ellipse', cx: mid, cy: base + t + 10, rx: round(gap / 2 + rx * 1.6), ry: round(ry * 1.4), fill: 'wash', enter: 'fade', at: 0, dur: 0.5 },
        // Two empty places from the first frame: the picture is set before a coin falls.
        ...[x1, x2].map((x, i) => ({
          type: 'ellipse',
          cx: x,
          cy: base,
          rx,
          ry,
          fill: 'none',
          stroke: 'line',
          width: 3,
          dash: [10, 8],
          enter: 'fade',
          at: 0.1 + i * 0.2,
          dur: 0.4,
          exit: 'fade',
          exitCue: 'TOTAL',
          exitAt: M.TOTAL,
          exitDur: 0.25,
        })),
        // Your stack and its count; it moves to the middle when the two merge.
        {
          type: 'group',
          id: 'match-yours',
          enter: 'none',
          at: 0,
          keys: [{ ...merge, x: mid - x1 }],
          children: [
            ...yours,
            ...counts(x1, fromYou, you, '', 'accent', 'YOU'),
          ],
        },
        // The company's stack lands on top of yours (an `into` can go through it: match-theirs).
        {
          type: 'group',
          id: 'match-theirs',
          enter: 'none',
          at: 0,
          keys: [{ ...merge, x: mid - x2, y: -you * step }],
          children: [
            ...theirs,
            ...counts(x2, fromMatch, match, '+', 'accent2', 'MATCH'),
          ],
        },
        // Names under the stacks, gone once there is one stack.
        ...[
          [x1, 'YOU', 0.15],
          [x2, 'EMPLOYER', 0.35],
        ].map(([x, text, at]) =>
          label(text, x, base + t + 90, 40, 'semibold', 'ink', {
            fit: gap - 40,
            enter: 'fade',
            at,
            exit: 'fade',
            exitCue: 'TOTAL',
            exitAt: M.TOTAL,
            exitDur: 0.25,
          }),
        ),
        // The total over the merged stack, and what it is.
        label(`${total}${suffix}`, mid, top(total), 96, 'bold', 'ink', { enter: 'pop', cue: 'TOTAL', at: M.TOTAL + 1.0, after: 1.0, dur: 0.4 }),
        label('TOTAL', mid, base + t + 90, 40, 'semibold', 'ink', {
          fit: w - 240,
          enter: 'rise',
          cue: 'TOTAL',
          at: M.TOTAL + 1.2,
          after: 1.2,
          ...(again ? { exit: 'fade', exitCue: 'AGAIN', exitAt: M.AGAIN, exitDur: 0.25 } : {}),
        }),
        label('EACH', mid, base + t + 150, 28, 'regular', 'muted', { fit: w - 240, enter: 'fade', at: M.YOU + 0.6 }),
        // Every paycheck: smaller copies of the total line up beside it, one after another, and
        // the line under the stacks says so (AGAIN).
        ...Array.from({ length: again }, (_, k) => {
          const k1 = k + 1,
            sc = 0.5,
            srx = round(rx * sc),
            sry = round(ry * sc),
            st = round(t * sc),
            sstep = round(step * sc),
            sx = round(mid + (T ? 0 : rx + 70) + k1 * (srx * 2 + 34) * (T ? 0 : 1)),
            // Tall frames have room above the total, not below its labels.
            sy = T ? round(top(total) - 150) : base + round(t - st),
            ox = T ? round(mid - ((again - 1) * (srx * 2 + 30)) / 2 + k * (srx * 2 + 30)) : sx;
          const coins = Array.from({ length: total }, (_, i) => {
            const y = round(sy - i * sstep),
              fill = i < you ? 'accent' : 'accent2';
            return [
              { type: 'rect', x: ox - srx, y, w: 2 * srx, h: st, fill, enter: 'none' },
              { type: 'ellipse', cx: ox, cy: y + st, rx: srx, ry: sry, fill, enter: 'none' },
              { type: 'ellipse', cx: ox, cy: y, rx: srx, ry: sry, fill, stroke: 'bg', width: 1.5, enter: 'none' },
            ];
          }).flat();
          return {
            type: 'group',
            enter: 'drop',
            dist: 160,
            cue: 'AGAIN',
            at: round(M.AGAIN + k * 0.28),
            after: round(k * 0.28),
            dur: 0.45,
            opacity: round(1 - k * 0.12),
            children: coins,
          };
        }),
        ...(again
          ? [
              label('AGAIN', mid, base + t + 90, 40, 'semibold', 'ink', { fit: w - 240, enter: 'rise', cue: 'AGAIN', at: M.AGAIN + 0.4, after: 0.4 }),
            ]
          : []),
      ],
    };
  },
};
