import { buildSketch } from './match/build.mjs';

export default {
  name: 'match',
  keep: true,
  order: 91,
  summary:
    'Two contributions become one: your coins drop into a stack, the company’s drop in beside them, and the stacks merge into one with its total on top. One coin per unit, counted from the real figures.',
  use: 'An employer match, a grant on top of savings, a fee that adds to a price, any "you put in this, they add that". Set the counts with sketchParams {you, match, suffix}; for a what-if (raise 3% to 5%) add {fromYou, fromMatch}: the beat opens on the current coins and only the added ones drop (with start: "empty", today’s coins drop first, on NOWYOU and NOWMATCH: "you save three… they add three"); {again: 3} lines up more stacks like the total on AGAIN ("every paycheck"), with AGAIN as the line under them; replace YOU, EMPLOYER, EACH (what one coin is, e.g. "Each coin: 1% of your pay") and TOTAL (words after the total) with sketchText; land YOU, MATCH and TOTAL on words with sketchSay. The figures need a visible source like any number.',
  params: {
    you: {
      default: 5,
      min: 0,
      max: 12,
      integer: true,
      about: 'coins you put in',
      hint: 'One coin per unit: 5 and 4 for 5% and 4% of pay. For money, pick a unit both fit in 12 coins (e.g. $250 a coin) and say so in EACH.',
    },
    match: {
      default: 4,
      min: 0,
      max: 12,
      integer: true,
      about: 'coins the other side adds',
      hint: 'One coin per unit: 5 and 4 for 5% and 4% of pay. For money, pick a unit both fit in 12 coins (e.g. $250 a coin) and say so in EACH.',
    },
    suffix: {
      default: '%',
      about: 'unit printed after each count, e.g. "%" (or "" for none)',
    },
    fromYou: {
      default: 0,
      min: 0,
      max: 12,
      integer: true,
      about:
        'what if: coins already yours on the first frame (the current state), e.g. 3 when raising 3% to 5%',
    },
    fromMatch: {
      default: 0,
      min: 0,
      max: 12,
      integer: true,
      about:
        'what if: the company coins already there on the first frame, e.g. 3',
    },
    again: {
      default: 0,
      min: 0,
      max: 5,
      integer: true,
      about:
        'every paycheck: on AGAIN, this many more stacks like the total line up beside it (0 for none)',
    },
    start: {
      default: 'drawn',
      oneOf: ['drawn', 'empty'],
      about:
        'what if: drawn opens on today’s coins; empty drops them on NOWYOU and NOWMATCH ("you save three… they add three") before the change',
    },
  },
  build: buildSketch,
};
