// Growth told as a plant: the seedling sketch with its stage labels set by sketchText and its
// four moments landed on the voice by sketchSay. One beat, both frame shapes.
// usage: node examples/community-grows/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Community grows',
    logline: 'One small team becomes a community that grows on its own.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'bookish', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'grow', block: 'canvas', hold: 1.4,
        vo: 'It started with one small team. Word spread, and the roots went deep. Others joined, and it kept growing. Now it blooms on its own.',
        props: {
          sketch: 'seedling',
          sketchText: { ONE: 'Word spreads', TWO: 'Others join', THREE: 'A community' },
          sketchSay: { SEED: 'team', SPROUT: 'roots', GROW: 'growing', BLOOM: 'blooms' },
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
