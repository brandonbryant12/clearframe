import { buildSketch } from './choose/build.mjs';

export default {
  name: 'choose',
  order: 96,
  keep: true,
  summary:
    'Two options compared row by row: two cards side by side (stacked in tall frames), each row ticks the option that wins it, and at the end the chosen card lifts forward while the other recedes.',
  use: 'Two plans, two funds, two ways to pay, two policies: "the HSA saves on tax, the PPO costs less to visit, so for you…". Replace AOPTION and BOPTION (the two names) and ROWONE…ROWFOUR (what each row compares, two to four words; one per row) with sketchText; land ONE…FOUR (each row) and PICK (the choice) on words with sketchSay. sketchParams: rows (who wins each row, in order: a, b, both or neither; 1–4 rows) and pick (a, b, or none to leave the choice open).',
  params: {
    rows: {
      default: ['a', 'b', 'a'],
      list: true,
      length: [1, 4],
      about: 'who wins each row, in order: a, b, both or neither (1–4 rows)',
    },
    pick: {
      default: 'a',
      about:
        'the option chosen at the end: a, b, or none (no choice; PICK is then not a moment)',
    },
  },
  build: buildSketch,
};
