// Keeping someone's data safe: the vault sketch with its label set by sketchText and its two
// moments landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/your-data/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Your data',
    logline: 'Everything someone keeps with us goes into one place only they can open.',
    format: { preset: shape, fps: 30 },
    theme: 'midnight', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'vault', block: 'canvas', hold: 1.6,
        vo: 'Your files, your messages, your history. We keep them in one place, locked, that only you can open.',
        props: {
          sketch: 'vault',
          sketchText: { SAFE: 'Only yours' },
          sketchSay: { GUARD: 'keep', LOCK: 'locked' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
