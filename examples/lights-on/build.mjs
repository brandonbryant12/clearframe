// A discovery told as a search in the dark: the searchlight sketch, its finds named with
// sketchText and its light landed on the voice with sketchSay. One beat, both frame shapes.
// usage: node examples/lights-on/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Lights on',
    logline: 'Three slow-downs nobody had looked at turn out to be one problem.',
    format: { preset: shape, fps: 30 },
    theme: 'noir', type: 'geometric', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'search', block: 'canvas', hold: 1.2,
        vo: 'Nobody looks in here. First, old logs filling the disk. Then a retry queue that never empties. And a nightly job that runs every minute. Lights on: it was one problem all along.',
        props: {
          sketch: 'searchlight',
          sketchText: { FIRST: 'Old logs', SECOND: 'Retry queue', THIRD: 'Nightly job' },
          sketchSay: { FIRST: 'logs', SECOND: 'queue', THIRD: 'job', ALL: 'Lights' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
