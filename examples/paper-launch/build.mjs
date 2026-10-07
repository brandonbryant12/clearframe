// Scattered pieces become one product, in cut paper: the cut-paper sketch with its card words
// set by sketchText and its two moments landed on the voice by sketchSay. One beat, both shapes.
// usage: node examples/paper-launch/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Paper launch',
    logline: 'A customer note, a sketch and a few lines of copy come together as one app.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'assemble', block: 'canvas', hold: 1.4,
        vo: 'It started as scraps: a customer note, a sketch, a few lines of copy. Put together, they became one app. Meet Tally.',
        props: {
          sketch: 'cut-paper',
          sketchText: { PRODUCT: 'Tally', ACTION: 'Get started' },
          sketchSay: { BUILD: 'together', REVEAL: 'Meet' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
