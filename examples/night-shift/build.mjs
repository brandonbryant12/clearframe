// Night shift: a 20-second study in one continuous picture. At 2:14 a report slips out of someone's
// phone and travels to the one person awake; she opens it, the report fills the screen and becomes
// the code (the real fix, read from git); it comes back as a check, travels home and folds into the
// phone; by 6:00 nobody knows it broke. Type carries the time; holds frame the night.
// usage: node examples/night-shift/build.mjs   (the code beat reads this repository: repo '../..')
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const LAYOUT = {
  landscape: { W: 1920, H: 1080, time: [960, 330], timeSize: 230, phone: [560, 760], person: [1400, 640], desk: [1150, 1660, 770], lamp: [1400, 560, 300],
    out: [980, 440], home: [960, 860] },
  vertical: { W: 1080, H: 1920, time: [540, 470], timeSize: 210, phone: [540, 1540], person: [540, 1000], desk: [300, 780, 1130], lamp: [540, 930, 300],
    out: [880, 1300], home: [250, 1300] },
};

for (const shape of ['landscape', 'vertical']) {
  const L = LAYOUT[shape];
  // The room: a desk drawn by hand and the lamplight over it. There from frame one in every scene.
  const room = [
    { type: 'circle', id: 'lamp', cx: L.lamp[0], cy: L.lamp[1], r: L.lamp[2], fill: 'accent2', opacity: 0.12, blur: 60, at: 0, enter: 'none' },
    { type: 'line', id: 'desk', x1: L.desk[0], y1: L.desk[2], x2: L.desk[1], y2: L.desk[2], stroke: 'muted', width: 5, cap: 'round', rough: { amount: 1, passes: 2 }, at: 0, enter: 'none' },
  ];
  const time = (text, extra = {}) => ({ type: 'text', id: 'time', text, x: L.time[0], y: L.time[1], size: L.timeSize, font: 'display', fill: 'ink', anchor: 'middle', ...extra });
  const beats = [
    { id: 'two', vo: 'Two in the morning.', hold: 1.8,
      elements: [...room, time('2:14', { at: 0.2, enter: 'fade', dur: 1.2 })],
      cast: { look: 'drawn', objects: [
        { id: 'phone', shape: 'phone', color: 'accent', size: 240, enter: 'none', float: false },
        { id: 'person', shape: 'person', color: 'surface', size: 290, enter: 'none', float: false },
      ], formations: [{ form: 'cluster', ids: ['phone'], center: L.phone, at: 0 }, { form: 'cluster', ids: ['person'], center: L.person, at: 0 },
        { form: 'wave', ids: ['phone'], at: 1.7 }, { form: 'wave', ids: ['phone'], at: 2.3 }] } },
    { id: 'report', vo: "A report slips out of someone's phone and finds the one person awake.",
      elements: [...room, time('2:14', { at: 0, enter: 'none', exitAt: 0.6, exit: 'fade' })],
      cast: { objects: [{ id: 'report', shape: 'bubble', color: 'accent2', size: 200, float: false }],
        formations: [{ form: 'split', from: 'phone', ids: ['report'], say: 'slips', spread: 0.6 }, { form: 'travel', ids: ['report'], to: 'person', via: [L.out], say: 'finds', dur: 1.8 }] } },
    { id: 'dive', vo: 'She opens it.', hold: 0.9,
      elements: room,
      cast: { formations: [{ form: 'camera', zoom: 1.35, on: 'report', at: 0, dur: 1.6 }, { form: 'fill', ids: ['report'], say: 'opens', dur: 0.9 }] } },
    { id: 'code', vo: 'One stray comma, and the line that drops it.', hold: 1.2, block: 'stage',
      props: { code: { commit: 'f0bcc0b', file: 'engine/lib/agent/tools.mjs', repo: '../..', window: [34, 39], title: 'tools.mjs', say: 'comma' } } },
    { id: 'back', vo: 'The fix goes back the way the report came.', hold: 0.9,
      elements: room,
      cast: { objects: [{ id: 'check', icon: 'check', color: 'positive', size: 190, float: false }],
        formations: [{ form: 'emerge', ids: ['report'], at: 0, dur: 0.9 }, { form: 'camera', zoom: 1, at: 0.2, dur: 1.2 },
          { form: 'swap', out: 'report', in: 'check', by: ['person'], say: 'fix', dur: 0.6 }, { form: 'travel', ids: ['check'], to: 'phone', via: [L.home], say: 'back', dur: 1.6 }] } },
    { id: 'morning', vo: 'By six, nobody knows it broke.', hold: 1.6,
      elements: [...room, time('6:00', { at: 0.4, enter: 'fade', dur: 1.2 })],
      cast: { formations: [{ form: 'merge', ids: ['check'], into: 'phone', say: 'six', dur: 0.8 }] } },
  ];
  const storyboard = {
    version: 2,
    title: 'Night shift',
    logline: 'A curated cast study: a report travels from a phone to the one person awake, becomes the fix, and goes home before morning.',
    format: { preset: shape, fps: 30 },
    theme: 'ink', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none', lens: { handheld: 0, bloom: 0.25 },
    texture: { grain: 0.3, vignette: 0.45 }, captions: false, music: false,
    beats: beats.map(({ id, vo, hold, block, props, elements, cast }) => ({ id, block: block ?? 'canvas', vo, ...(hold ? { hold } : {}), props: props ?? { elements, cast } })),
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
