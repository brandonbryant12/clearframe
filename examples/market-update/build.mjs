// A short market-update film assembled from the finance chart templates.
// usage: node examples/market-update/build.mjs [landscape|vertical]   (writes storyboard.json here)
// Then: node engine/cli.mjs voice examples/market-update --draft && node engine/cli.mjs render examples/market-update --draft
import fs from 'node:fs';

const shape = process.argv[2] ?? 'landscape';
const kit = JSON.parse(fs.readFileSync(new URL(`../finance-charts/storyboard-${shape}.json`, import.meta.url)));
const pick = id => structuredClone(kit.beats.find(b => b.id === id));

// Narration leads each chart; the picture settles before the line ends.
const scenes = [
  { id: 'open', block: 'title', duration: 4, props: { kicker: 'Market update', title: 'Three numbers that explain this quarter' } },
  { ...pick('headline-rate'), duration: 7, vo: 'Inflation has cooled to three point one percent, more than half a point lower than a year ago.' },
  { ...pick('purchasing-power'), duration: 9, vo: 'But even modest inflation compounds. Over twenty-five years, a hundred dollars held in cash has lost half its buying power.' },
  { ...pick('annual-returns'), duration: 8, vo: 'Markets have bad years. Two of the last ten ended lower, one of them sharply.' },
  { ...pick('return-distribution'), duration: 9, vo: 'Step back, though, and the losing years are the exception: seven out of thirty-six.' },
  { id: 'close', block: 'endcard', duration: 5, props: { kicker: 'Your firm', title: 'Time in the market matters', support: 'Talk to your advisor about a plan built to last.' } },
];

const storyboard = {
  version: 2, title: 'Market update', format: { preset: shape, fps: 30 }, theme: 'ledger', type: 'geometric',
  backdrop: 'none', motion: { preset: 'gentle', intensity: 0.35 }, transition: 'cut', sfx: 'subtle', captions: false,
  voice: { provider: 'gemini', voice: 'Charon', style: 'calm, assured, warm; a financial commentator, unhurried' },
  music: { model: 'lyria-3.5', prompt: 'Understated modern piano and soft pulse, confident and calm, corporate but warm', bpm: 92, key: 'D major', volume: 0.18 },
  sources: kit.sources,
  beats: scenes,
};
fs.writeFileSync(new URL('storyboard.json', import.meta.url), JSON.stringify(storyboard, null, 1) + '\n');
console.log(`wrote examples/market-update/storyboard.json (${shape}, ${scenes.reduce((n, s) => n + s.duration, 0)} s)`);
