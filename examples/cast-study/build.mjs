// A short told by one cast of objects instead of a card per line: material arrives as a pile, the
// pieces that matter line up into a sequence, one becomes the moment on screen, a note lands and
// that one moment turns into a new one, and the sequence plays on with it. The same objects carry
// across every cut. Positions come from the frame, so one storyboard serves landscape and vertical.
// usage: node examples/cast-study/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const sequence = ['report', 'chart', 'quote', 'voice', 'photo'];

const beats = [
  { id: 'pile', vo: 'Every film starts as a pile of material.',
    cast: { objects: [
      { id: 'report', icon: 'file', color: 'accent', enter: 'none' }, { id: 'chart', icon: 'chart-bar', color: 'accent2', enter: 'none' },
      { id: 'quote', icon: 'message', color: 'positive', enter: 'drop' }, { id: 'voice', icon: 'microphone', color: 'ink', enter: 'none' },
      { id: 'photo', icon: 'photo', color: 'negative', enter: 'drop' }, { id: 'idea', icon: 'lightbulb', color: 'surface' },
    ], formations: [{ form: 'scatter', at: 0.3, stagger: 0.22 }] } },
  { id: 'order', vo: 'So the agent pulls what matters into an order.', tail: 0.9,
    cast: { formations: [{ form: 'exit', ids: ['idea'], say: 'pulls', dur: 0.8 }, { form: 'line', ids: sequence, say: 'pulls', thread: true }] } },
  { id: 'moment', vo: 'One piece becomes the moment on screen.', tail: 0.8,
    cast: { formations: [{ form: 'hero', hero: 'chart', say: 'becomes', word: 'the moment' }, { form: 'fill', ids: ['chart'], say: 'screen', dur: 0.9 }] } },
  // Not a cast beat: a sourced figure on the chart's colour, which the fill hands it.
  { id: 'figure', vo: 'Here, about six seconds to render the whole draft.', block: 'stat',
    props: { value: 6.3, decimals: 1, suffix: ' s', label: 'to render the 17-second first draft', align: 'center', source: 'Measured 2026-10-06 on an 8 GB iMac (examples/cast-study README)' } },
  { id: 'note', vo: 'But a note lands, and only that moment changes.', tail: 0.6,
    cast: { objects: [{ id: 'note', icon: 'pencil', color: 'surface', enter: 'drop' }, { id: 'chart2', icon: 'chart-line', color: 'positive' }],
      formations: [{ form: 'emerge', ids: ['chart'], at: 0, dur: 1 }, { form: 'cluster', ids: ['note'], beside: 'chart', say: 'lands' }, { form: 'swap', out: 'chart', in: 'chart2', by: ['note'], say: 'changes', dur: 0.7 }] } },
  { id: 'plays', vo: 'So the film plays on, with one moment new.', min: 4,
    cast: { formations: [{ form: 'exit', ids: ['note'], at: 0.1, dur: 0.7 }, { form: 'line', ids: ['report', 'chart2', 'quote', 'voice', 'photo'], say: 'film', thread: true }, { form: 'wave', ids: ['report', 'chart2', 'quote', 'voice', 'photo'], say: 'new' }] } },
];

for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'One cast, five moves',
    logline: 'A cast study: the same objects carry the story across every cut, moving into a pile, a sequence, a hero, a swap and back into the sequence.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none', lens: { handheld: 0 },
    texture: { grain: 0.25, vignette: 0.35 }, captions: false, music: false,
    sources: [{ id: 'render', title: 'clearframe draft of examples/cast-study, 520 frames in 6.3 s on an 8 GB iMac (README)', date: '2026-10-06' }],
    beats: beats.map(({ id, vo, cast, min, tail, block, props }) => ({ id, block: block ?? 'canvas', vo, ...(min ? { min } : {}), ...(tail ? { tail } : {}), props: props ?? { cast } })),
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
