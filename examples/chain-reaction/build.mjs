// One action sets off the rest, as a handheld game level: the pixel-chain sketch with its
// screen words set by sketchText and its five moments landed on the voice by sketchSay.
// One beat, both frame shapes.
// usage: node examples/chain-reaction/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Chain reaction',
    logline: 'One merge sets off the whole release, link by link.',
    format: { preset: shape, fps: 30 },
    theme: 'lcd', type: 'geometric', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'chain', block: 'canvas', hold: 1.4,
        vo: 'One merge. A signal runs the checks. The gate opens, every build rolls down the line, and the release goes live.',
        props: {
          sketch: 'pixel-chain',
          sketchText: { TITLE: 'Release day', RESULT: 'Live' },
          sketchSay: { PRESS: 'merge', SIGNAL: 'signal', OPEN: 'gate', ROLL: 'rolls', RESULT: 'live' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
