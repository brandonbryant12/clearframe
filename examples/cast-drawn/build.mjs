// A cast drawn by hand: how a support team triages bug reports, for new hires. The same reports
// stay on screen throughout; pen marks do the explaining (copies crossed out, the first one
// underlined, replies drawn back to everyone who reported it). One storyboard, both shapes.
// usage: node examples/cast-drawn/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const beats = [
  { id: 'inbox', vo: 'Bug reports come in from everywhere: email, chat, and app reviews.', tail: 0.7,
    cast: { look: 'drawn', objects: [
      { id: 'mail', icon: 'mail', color: 'accent', enter: 'none' },
      { id: 'chat', icon: 'message', color: 'positive', enter: 'none' },
      { id: 'review', icon: 'star', color: 'accent2', enter: 'drop' },
      { id: 'mail2', icon: 'mail', color: 'accent', enter: 'drop' },
      { id: 'chat2', icon: 'message', color: 'positive', enter: 'drop' },
      { id: 'crash', icon: 'alert', color: 'negative', enter: 'drop' },
    ], formations: [{ form: 'scatter', at: 0.3, stagger: 0.28 }, { form: 'wave', ids: ['mail', 'mail2'], say: 'email' },
      { form: 'wave', ids: ['chat', 'chat2'], say: 'chat' }, { form: 'wave', ids: ['review'], say: 'reviews' }] } },
  { id: 'copies', vo: 'Some describe the same bug, so the copies are set aside.', tail: 0.9,
    cast: { formations: [{ form: 'ring', ids: ['mail2', 'chat2'], on: 'crash', spread: 240, say: 'same' }, { form: 'mark', mark: 'cross', ids: ['mail2', 'chat2'], say: 'copies' },
      { form: 'exit', ids: ['mail2', 'chat2'], say: 'aside', dur: 0.9 }] } },
  { id: 'rank', vo: 'The rest line up, and the one that hits the most customers goes first.', tail: 0.9,
    cast: { formations: [{ form: 'line', ids: ['review', 'mail', 'crash', 'chat'], say: 'line' }, { form: 'line', ids: ['crash', 'review', 'mail', 'chat'], say: 'most', thread: true },
      { form: 'mark', mark: 'underline', ids: ['crash'], say: 'first' }] } },
  { id: 'fix', vo: 'The on-call engineer takes it, and it becomes a fix.', tail: 1,
    cast: { objects: [{ id: 'engineer', icon: 'user', color: 'surface', enter: 'drop' }, { id: 'patch', icon: 'code', color: 'positive' }],
      formations: [{ form: 'hero', hero: 'crash', say: 'on-call' }, { form: 'cluster', ids: ['engineer'], beside: 'crash', say: 'engineer' },
        { form: 'swap', out: 'crash', in: 'patch', by: ['engineer'], say: 'fix', dur: 0.7 }] } },
  { id: 'reply', vo: 'When it ships, everyone who reported it hears back.', min: 4.5,
    cast: { formations: [{ form: 'exit', ids: ['engineer'], at: 0.1, dur: 0.7 }, { form: 'hero', hero: 'patch', scale: 1.5, at: 0.2 },
      { form: 'ring', ids: ['mail', 'chat2', 'review', 'mail2', 'chat'], say: 'everyone', spread: 460, dur: 1 },
      { form: 'mark', mark: 'arrow', ids: ['patch'], to: ['mail2', 'chat2'], say: 'hears', color: 'ink' }] } },
];

for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Triage, drawn',
    logline: 'A drawn cast study: bug reports arrive, copies are crossed out, the worst is underlined and fixed, and everyone who reported it hears back.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none', lens: { handheld: 0 },
    texture: { grain: 0.35, vignette: 0.3 }, captions: false, music: false,
    beats: beats.map(({ id, vo, cast, min, tail }) => ({ id, block: 'canvas', vo, ...(min ? { min } : {}), ...(tail ? { tail } : {}), props: { cast } })),
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
