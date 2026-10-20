import { buildSketch } from './split/build.mjs';

export default {
  name: 'split',
  order: 97,
  keep: true,
  summary:
    'A whole splits into its parts: one full bar opens into segments sized by the real values, each drops into its own labelled lane at the place it held in the whole, values print in a column, and the remainder is highlighted.',
  use: 'Where a paycheck goes (tax, insurance, savings, take-home), what a premium or fee is made of, how a budget or a fund is divided. Set the values with sketchParams {parts (2–5 numbers, in order, the remainder last), prefix, suffix, total}; replace WHOLE (what is split, e.g. "Your paycheck") and PARTONE…PARTFIVE (one per part, up to about 20 characters, e.g. "Taxes", "Take-home pay") with sketchText; land SPLIT, ONE…FIVE (each part landing) and REST (the remainder highlighted) on words with sketchSay. Segments are proportional to the values and the total beside the whole is their sum. The figures need a visible source like any number.',
  params: {
    parts: {
      default: [22, 8, 10, 60],
      list: true,
      length: [2, 5],
      about:
        'the parts in order, the remainder last (2–5 values); each segment is its share of their sum',
    },
    prefix: {
      default: '',
      about: 'printed before each value, e.g. "$" (or "" for none)',
    },
    suffix: {
      default: '%',
      about: 'printed after each value, e.g. "%" (or "" for none)',
    },
    total: {
      default: true,
      about:
        'true prints the sum of the parts beside the whole; false leaves it out',
    },
  },
  build: buildSketch,
};
