import { buildSketch } from './vesting/build.mjs';

export default {
  name: 'vesting',
  keep: true,
  order: 92,
  summary:
    'Ownership that unlocks over time: a timeline of steps, each with a padlock and a column. As each step arrives its lock springs open, its column grows to the share owned by then and a big figure counts up to it. Shares come from the real schedule.',
  use: 'Vesting of a company match, stock awards or a pension: "after one year you own a third, after three it is all yours", including cliffs (a step that adds nothing keeps its lock shut). Set the shares with sketchParams {steps: [33, 66, 100]} (1–6 cumulative percentages, rising); replace WHAT (what vests, e.g. "of the company match is yours") and STEP1, STEP2 … one per step (e.g. "Year 1") with sketchText; land ONE, TWO, THREE … (one per step) on words with sketchSay. The shares need a visible source like any figure.',
  params: {
    steps: {
      default: [33, 66, 100],
      list: true,
      length: [1, 6],
      min: 0,
      max: 100,
      about:
        'share owned after each step, in percent: 1–6 values, each at least the one before (e.g. [0, 0, 100] for a three-year cliff)',
    },
  },
  build: buildSketch,
};
