// Why a handful of reviews can mislead: an original explanation built from two explanation
// primitives (film/explain.mjs) on the explanation treatment. Reviews start arriving on the first
// word; their average settles inside a band of ±1 standard error, and the same dots gather into the
// spread. The second beat draws the rule behind that band, σ/√n: four times as many reviews halve
// the wobble. The third shows the rule's scope: with a biased sample (mostly unhappy people write)
// the same scatter settles just as calmly in the wrong place, and gathers into a spread centred
// below the truth. The band and the curve share the accent colour: it means "the wobble" in every
// beat, and the two estimate beats share one plot, so the second reads as the first, shifted.
// Simulated, not review data. Both frame shapes. usage: node examples/settling/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);

for (const shape of ['landscape', 'vertical']) {
  const reviews = { value: 0, spread: 1, count: 40, seed: 11, label: 'Each review', trueLabel: 'What it is really like' };
  const storyboard = {
    version: 2,
    title: 'Why a few reviews can mislead',
    logline: 'The average of a few reviews jumps around; the average of many settles, by a rule you can see, if the reviewers are a fair sample.',
    format: { preset: shape, fps: 30 },
    treatment: 'explanation',
    theme: 'ink', type: 'geometric', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    voice: { voice: 'Charon', style: 'warm, curious, measured' },
    captions: false, music: false,
    beats: [
      {
        id: 'arrive', block: 'canvas', tail: 1,
        vo: 'Reviews arrive one at a time, each one person\'s experience, a little off the truth. With a few, the average jumps. With more, it settles, and the band narrows. Gather them up: that is the spread.',
        props: { estimate: { ...reviews, meanLabel: 'Average so far', show: { say: 'Reviews', dur: 7 }, gather: { say: 'Gather', dur: 1.4 } } },
      },
      {
        id: 'rule', block: 'canvas', hold: 1.2,
        vo: 'That narrowing follows a simple rule: the average\'s wobble shrinks with the square root of the count. Four reviews wobble half as much as one; sixteen, half as much as four.',
        props: { graph: {
          fn: { kind: 'power', a: 1, p: -0.5 }, x: { domain: [1, 20], label: 'Number of reviews' }, y: { domain: [0, 1.08], label: 'How much the average wobbles' },
          draw: { say: 'narrowing', dur: 1.4 }, sweep: { from: 1, to: 20, say: 'shrinks', dur: 4 },
          marks: [{ x: 1, label: 'one', say: 'Four' }, { x: 4, label: 'four: half', say: 'half' }, // A long label on a flat stretch rises to clear the curve; on a narrow phone plot it would float away from its mark.
            { x: 16, label: shape === 'vertical' ? 'sixteen' : 'sixteen: half again', say: 'sixteen' }],
        } },
      },
      {
        id: 'bias', block: 'canvas', hold: 1.6,
        vo: 'The rule assumes a fair sample. If mostly unhappy people write, the average settles just as calmly, in the wrong place; more reviews will not move it.',
        props: { estimate: { ...reviews, bias: -1.2, meanLabel: 'Average of those who wrote', show: { say: 'rule', dur: 6 }, gather: { say: 'wrong', dur: 1.4 } } },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
