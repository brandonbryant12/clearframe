import fork from './scenario-fork.mjs';

export default {
  name: 'scenario-outcomes',
  order: 64,
  summary: 'Pull out from a common origin to reveal the possible outcomes, with no likelihood implied.',
  use: 'Second shot of the same world as scenario-origin. Only outcome labels and endpoints are added; the paths persist.',
  build(w, h) {
    return {
      view: [0, 0, w, h],
      viewDur: 3.1,
      elements: fork.build(w, h).elements
        .filter(e => /^scenario-(end|label)-/.test(e.id))
        .map(e => ({ ...e, at: 0, enter: 'none' })),
    };
  },
};
