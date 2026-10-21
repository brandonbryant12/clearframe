import { buildSketch } from './expire/build.mjs';

export default {
  name: 'expire',
  keep: true,
  order: 94,
  summary:
    'Use it or lose it: a glass jar fills with this year’s coins; at year end a carry-over line cuts across it, the coins above the line lift away and the ones below stay. One coin per unit, counted from the real figures.',
  use: 'Paid time off that partly carries over, an FSA or HSA rollover limit, unused credits or allowances, benefits that reset each year: "you get 8 days, you can carry 3 into next year". Not for access that ends (a shared link that expires after 7 days: that is compose with expires: true). Set the counts with sketchParams {total, keep} (one coin each) and, for printed amounts, {each, prefix, suffix} (e.g. each 100, prefix "$"); replace KEEP (e.g. "days carry into next year"), LOSE (e.g. "days are gone") and YEAREND (a short date, e.g. "Dec 31") with sketchText; land FILL, YEAREND and KEEP on words with sketchSay. The figures need a visible source like any number.',
  params: {
    total: {
      default: 8,
      min: 1,
      max: 12,
      integer: true,
      about: 'coins in the jar this year, one per unit',
      hint: 'It counts coins, not money. For $3,300 with $660 carrying over: total 5, keep 1, each 660, prefix "$" (5 coins of $660).',
    },
    keep: {
      default: 3,
      min: 0,
      max: 12,
      integer: true,
      about:
        'coins that carry over (no more than total); the rest are lost at year end',
      hint: 'It counts coins, not money. For $3,300 with $660 carrying over: total 5, keep 1, each 660, prefix "$" (5 coins of $660).',
    },
    each: {
      default: 1,
      min: 0.01,
      max: 1000000,
      about:
        'what one coin is worth in the printed amounts, e.g. 100 for $100 coins',
    },
    prefix: { default: '', about: 'printed before each amount, e.g. "$"' },
    suffix: {
      default: '',
      about: 'printed after each amount, e.g. "%" or " days" (or "" for none)',
    },
  },
  build: buildSketch,
};
