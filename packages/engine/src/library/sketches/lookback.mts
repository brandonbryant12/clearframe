import { buildLookback } from './lookback/build.mjs';
export default {
  name: 'lookback',

  keep: true,

  order: 101,

  summary:
    'The lower of two prices, then a discount: a price line across one offering period, its first-day and last-day prices marked, the lower one circled by hand and carried to the purchase, a bar dropping from it by the discount to the price you pay, and optionally the gap to the last-day price shaded and labelled.',

  use: 'An employee stock purchase plan\'s lookback, a price protection offer, any "you pay X% below the lower of two prices": "the price starts at $40 and ends at $50; you buy at the lower of the two, then 15% off: you pay $34, $16 below today\'s price". Set the figures with sketchParams {start, end, discount, prefix, decimals, gain}: start and end are the prices on the period\'s first and last day (either may be the lower), discount is a fraction (0.15 for 15% off), decimals matches how the source prints a price (0 for $34, 2 for $34.00), gain true adds the gap to the last-day price. What you pay is worked out as the lower price × (1 − discount) and printed with those decimals: check it against the source. Replace PERIOD (the span under the axis, e.g. "One offering: six months"), STARTLABEL and ENDLABEL (the period\'s first and last day, e.g. "Jan 1", "Jun 30"), LOWER (beside the circled price, e.g. "the lower price"), PAY (before the price you pay, e.g. "You pay") and, with gain, GAIN (under the gap, e.g. "below today\'s price") with sketchText; land PERIOD, START, END, LOWER, DISCOUNT, PAY and GAIN (with gain) on words in that order with sketchSay. The prices and the discount need a visible source like any figure. For a rate or price that holds while the market moves, use hold.',

  params: {
    start: {
      default: 40,
      min: 0.01,
      max: 10000000,
      about:
        'the price on the first day of the period, in the printed units (40 for $40)',
    },
    end: {
      default: 50,
      min: 0.01,
      max: 10000000,
      about:
        'the price on the last day of the period (the purchase date), in the same units',
    },
    discount: {
      default: 0.15,
      min: 0.01,
      max: 0.9,
      about:
        'the discount off the lower of the two prices, as a fraction (0.15 for 15% off)',
      hint: 'A fraction, not a percent: 15% off is 0.15 (not 15).',
    },
    prefix: {
      default: '$',
      about: 'printed before each price, e.g. "$" (or "" for none)',
    },
    decimals: {
      default: 0,
      min: 0,
      max: 4,
      integer: true,
      figure: false,
      about:
        'decimal places in the printed prices, as the source prints them (0 for $34, 2 for $34.00 or $35.16)',
    },
    gain: {
      default: false,
      about:
        'true: on GAIN, the gap between what you pay and the last-day price shades in, bracketed and labelled with the difference',
    },
  },
  build: buildLookback,
};
