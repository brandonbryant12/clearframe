// Faster by taking fewer steps: the shortcut sketch with its route labels set by sketchText and
// its three moments landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/fewer-steps/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Fewer steps',
    logline: 'Checkout gets faster by skipping the waits, not by running harder.',
    format: { preset: shape, fps: 30 },
    theme: 'ink', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'race', block: 'canvas', hold: 1.4,
        vo: 'Checkout used to stop and wait four times. The new path skips the waits. Both leave together, at the same speed. The new one is there first.',
        props: {
          sketch: 'shortcut',
          sketchText: { OLD: 'Four waits', NEW: 'Direct' },
          sketchSay: { SHORTCUT: 'skips', GO: 'leave', ARRIVE: 'first' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
