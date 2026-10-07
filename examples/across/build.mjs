// Closing a gap: the bridge sketch with its two sides named by sketchText and its two moments
// landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/across/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Across',
    logline: 'A team and the data it needs, finally connected.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'bridge', block: 'canvas', hold: 1.8,
        vo: 'Your team on one side, the data they need on the other. We built the bridge, and now every request crosses on its own.',
        props: {
          sketch: 'bridge',
          sketchText: { LEFT: 'Your team', RIGHT: 'The data' },
          sketchSay: { BUILD: 'built', CROSS: 'crosses' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
