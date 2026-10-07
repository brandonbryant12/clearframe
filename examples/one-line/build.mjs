// Simplification you can watch: the untangle sketch with its corner tags set by sketchText and its
// two moments landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/one-line/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'One line',
    logline: 'A request that bounced between six tools now flows along one line.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'untangle', block: 'canvas', hold: 1.6,
        vo: 'Every request used to bounce between six tools. We pulled them into one line, and now the work just flows.',
        props: {
          sketch: 'untangle',
          sketchText: { BEFORE: 'Six tools', AFTER: 'One line' },
          sketchSay: { UNTANGLE: 'pulled', FLOW: 'flows' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
