import { buildSketch } from './growth/build.mjs';

export default {
  name: 'growth',
  keep: true,
  order: 99,
  summary:
    'Saving over the years: a column per year stacks what you put in and what it grew, so the growth overtakes the contributions late (compounding); the last column is named in parts and the total counts up beside it. Computed from a stated assumption.',
  use: 'Retirement or college saving, starting early, a regular contribution left to grow: "put in $6,000 a year for 30 years and it grows to $418,000". Set the assumption with sketchParams {years, perYear, rate, prefix, startYear}: perYear is put in at the start of each year and grows at rate (a fraction: 0.05 for 5%) compounded yearly; startYear labels the axis with calendar years (0 counts Year 1, 2 …). Replace PUTIN (e.g. "you put in"), GREW (e.g. "it grew"), TOTAL (words after the total, e.g. "after 30 years") and BASIS (one plain line stating the example, e.g. "Example: $6,000 a year, growing 5% a year") with sketchText; land START (the contributions), GROW (the growth) and TOTAL on words with sketchSay. The assumed rate needs a visible source like any figure.',
  params: {
    years: {
      default: 30,
      min: 5,
      max: 40,
      integer: true,
      about: 'how many years of saving (5–40)',
    },
    perYear: {
      default: 6000,
      min: 1,
      max: 1000000000,
      about:
        'amount put in each year, in the printed currency (6000 for $6,000)',
      hint: 'A yearly amount: $500 a month is perYear 6000.',
    },
    rate: {
      default: 0.05,
      min: 0,
      max: 0.2,
      about: 'annual growth assumption, as a fraction (0.05 for 5%)',
      hint: 'rate is a fraction: 0.05 for 5%, 0.07 for 7%.',
    },
    prefix: {
      default: '$',
      about: 'printed before each amount, e.g. "$" or "£"',
    },
    startYear: {
      default: 0,
      min: 0,
      max: 2200,
      integer: true,
      about:
        'calendar year of the first column, e.g. 2027 (0 labels the axis Year 1, 5, 10 …)',
    },
  },
  build: buildSketch,
};
