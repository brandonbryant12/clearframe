// Guidance through complexity: the maze sketch with its two ends named by sketchText and its two
// moments landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/the-way-through/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'The way through',
    logline: 'Opening an account used to be a maze; now one path is lit for you.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'maze', block: 'canvas', hold: 1.6,
        vo: 'Opening an account used to feel like this. Now we guide you through, one clear step at a time, and you are done.',
        props: {
          sketch: 'maze',
          sketchText: { START: 'Sign up', FINISH: 'Ready' },
          sketchSay: { GUIDE: 'guide', ARRIVE: 'done' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
