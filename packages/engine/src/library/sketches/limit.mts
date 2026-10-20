import { buildSketch } from './limit/build.mjs';

export default {
  name: 'limit',
  keep: true,
  order: 93,
  summary:
    'How much of a yearly limit is used and how much room is left: a track to scale from zero to the limit, the used share filling it as its amount counts up, the limit landing at the end, the room left bracketed. Amounts come from the plan.',
  use: 'A deductible met so far, an out-of-pocket maximum, a 401(k) or HSA contribution limit, a spending allowance: "you have saved $15,000 of the $23,500 you are allowed; you can still add $8,500". Set sketchParams {limit, used, prefix, suffix, decimals, tone}; replace WHAT (what the limit is for, e.g. "Your 401(k) contributions, 2027"), USED (e.g. "saved so far"), LIMITLABEL (e.g. "yearly limit") and LEFTLABEL (e.g. "you can still add") with sketchText; land FILL, LIMIT and LEFT on words with sketchSay. The amounts need a visible source like any figure.',
  params: {
    limit: {
      default: 23500,
      min: 1,
      max: 1e9,
      about: 'the limit, in the amount printed (the end of the track)',
    },
    used: {
      default: 15000,
      min: 0,
      max: 1e9,
      about: 'how much of it is used so far (no more than the limit)',
    },
    prefix: { default: '$', about: 'printed before each amount, e.g. "$"' },
    suffix: { default: '', about: 'printed after each amount, e.g. " days"' },
    decimals: {
      default: 0,
      min: 0,
      max: 2,
      integer: true,
      about: 'decimals the source prints',
    },
    tone: {
      default: 'accent',
      oneOf: ['accent', 'negative', 'positive'],
      about:
        "the used share's colour: accent, negative for spending that counts against you, positive for progress",
    },
  },
  build: buildSketch,
};
