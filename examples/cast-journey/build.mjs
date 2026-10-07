// A journey through a drawn world: one support ticket travels from the desk to engineering, becomes
// a fix there, and travels on to the customer who asked, leaving a pen trail each time. The world
// (three stations) is scenery drawn under the cast; the ticket, the engineer and the customer are
// the cast. Station positions are laid out per shape, so landscape and vertical each read well.
// usage: node examples/cast-journey/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const LAYOUT = {
  landscape: { W: 1920, H: 1080, desk: [380, 720], eng: [960, 360], home: [1540, 720], via1: [560, 380], via2: [1150, 640] },
  vertical: { W: 1080, H: 1920, desk: [300, 1480], eng: [780, 960], home: [300, 440], via1: [760, 1380], via2: [400, 760] },
};

// A station: a hand-drawn rounded plot with its name written above it. Static scenery, there from frame one.
const station = (id, [x, y], name, w, h) => [
  { type: 'rect', id: `${id}-plot`, x: x - w / 2, y: y - h / 2, w, h, r: 36, fill: 'surface', stroke: 'muted', width: 3, rough: { amount: 1.2, passes: 2, fill: 'hachure', gap: 22, angle: 30, hatchWidth: 2 }, opacity: 0.8, at: 0, enter: 'none' },
  { type: 'text', id: `${id}-name`, text: name, x, y: y - h / 2 - 26, size: 40, font: 'hand', fill: 'ink', anchor: 'middle', at: 0, enter: 'none' },
];

for (const shape of ['landscape', 'vertical']) {
  const L = LAYOUT[shape], w = shape === 'landscape' ? 380 : 360, h = shape === 'landscape' ? 300 : 280;
  const scenery = [...station('desk', L.desk, 'Support desk', w, h), ...station('eng', L.eng, 'Engineering', w, h), ...station('home', L.home, 'Customer', w, h)];
  const at = ([x, y]) => [x, y + 18];
  const beats = [
    { id: 'desk', vo: 'A ticket lands on the support desk.', min: 3,
      cast: { look: 'drawn', objects: [
        { id: 'ticket', shape: 'ticket', color: 'accent', size: 240, enter: 'drop' },
        { id: 'engineer', shape: 'person', color: 'surface', size: 210, enter: 'none' },
        { id: 'customer', shape: 'person', color: 'accent2', size: 210, enter: 'none' },
      ], formations: [{ form: 'cluster', ids: ['engineer'], center: at(L.eng), at: 0 }, { form: 'cluster', ids: ['customer'], center: at(L.home), at: 0 },
        { form: 'cluster', ids: ['ticket'], center: at(L.desk), say: 'ticket' }] } },
    { id: 'route', vo: 'It travels to engineering, where someone can fix it.', tail: 0.6,
      cast: { formations: [{ form: 'travel', ids: ['ticket'], to: 'engineer', via: [L.via1], say: 'travels', dur: 2.2 },
        { form: 'mark', mark: 'circle', ids: ['engineer'], say: 'someone' }] } },
    { id: 'fix', vo: 'There, it becomes a fix.', tail: 1.1,
      cast: { objects: [{ id: 'patch', icon: 'code', color: 'positive', size: 200 }],
        formations: [{ form: 'swap', out: 'ticket', in: 'patch', by: ['engineer'], say: 'fix', dur: 0.7 }] } },
    { id: 'home', vo: 'And the fix travels on, to the customer who asked.', min: 4.5,
      cast: { formations: [{ form: 'cluster', ids: ['engineer'], center: at(L.eng), at: 0.2, dur: 0.9 }, { form: 'travel', ids: ['patch'], to: 'customer', via: [L.via2], say: 'travels', dur: 2.2 },
        { form: 'wave', ids: ['customer'], say: 'asked' }] } },
  ];
  const storyboard = {
    version: 2,
    title: 'One ticket, one journey',
    logline: 'A drawn world: a support ticket travels to engineering, becomes a fix, and travels on to the customer who asked.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none', lens: { handheld: 0 },
    texture: { grain: 0.35, vignette: 0.3 }, captions: false, music: false,
    beats: beats.map(({ id, vo, cast, min, tail }) => ({ id, block: 'canvas', vo, ...(min ? { min } : {}), ...(tail ? { tail } : {}), props: { elements: scenery, cast } })),
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
