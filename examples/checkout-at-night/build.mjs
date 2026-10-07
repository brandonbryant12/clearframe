// One brief, composed from the library and adapted to it: why checkout slowed down every night,
// what changed, and what it does now. Four beats on one palette:
//   search  — the searchlight sketch, filled with the brief's three causes (sketchText, sketchSay);
//   turn    — a colour-block statement: the punctuation that breaks a run of drawings;
//   fix     — the untangle sketch copied and adapted beyond its slots: its six cards carry this
//             checkout's own pieces (cart, logs, database, the cron clock, retry settings, done);
//   result  — the shortcut sketch: fewer waits, the same speed, there first.
// usage: node examples/checkout-at-night/build.mjs
import fs from 'node:fs';
import { sketch } from '../../film/sketches.mjs';

const dir = new URL('.', import.meta.url);
// The brief's own pieces, in the order the order passes through them.
const PIECES = ['shopping-cart', 'file', 'database', 'clock', 'settings', 'check'];

// Copy a sketch's filled elements and swap its card icons for this checkout's pieces.
function adaptedUntangle(preset, text, say) {
  const { elements } = sketch('untangle', preset, { text, say });
  let k = 0;
  const walk = list => list.forEach(el => {
    if (el.type === 'icon') el.name = PIECES[k++];
    if (el.children) walk(el.children);
  });
  walk(elements);
  return elements;
}

for (const shape of ['landscape', 'vertical']) {
  const storyboard = {
    version: 2,
    title: 'Checkout at night',
    logline: 'Three slow-downs that were one problem, the fix that pulled checkout into one path, and why it is faster now.',
    format: { preset: shape, fps: 30 },
    theme: 'ink', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'search', block: 'canvas', tail: 1.8,
        vo: 'Every night, checkout slowed to a crawl, so we went looking. First, stale logs. Then a retry storm. Then a cron job. Lights on.',
        props: {
          sketch: 'searchlight',
          sketchText: { FIRST: 'Stale logs', SECOND: 'Retry storm', THIRD: 'Cron job' },
          sketchSay: { SEARCH: 'looking', FIRST: 'logs', SECOND: 'storm', THIRD: 'cron', ALL: 'Lights' },
          // A slow push into the dark room while the light searches.
          dolly: [{ at: 0, z: 0.12, dur: 9, ease: 'inOut' }],
        },
      },
      {
        id: 'turn', block: 'statement', tone: 'accent', transition: 'panel', tail: 0.6,
        vo: 'It was one problem, not three.',
        props: { text: 'One problem, not three.', emphasis: ['One problem'], align: 'center', land: 'one' },
      },
      {
        id: 'fix', block: 'canvas', transition: 'panel', tail: 0.4,
        vo: 'Each order hopped between six services. We pulled them into one path, and now it flows.',
        props: { elements: adaptedUntangle(shape, { BEFORE: 'Six hops', AFTER: 'One path' }, { UNTANGLE: 'pulled', FLOW: 'flows' }) },
      },
      {
        id: 'result', block: 'canvas', hold: 1.6,
        vo: 'So checkout skips the waits. Both leave together, at the same speed. The new path is there first.',
        props: {
          sketch: 'shortcut',
          sketchText: { OLD: 'Four waits', NEW: 'Direct' },
          sketchSay: { SHORTCUT: 'skips', GO: 'leave', ARRIVE: 'first' },
          dolly: [{ say: 'leave', z: 0.1, dur: 3, ease: 'inOut' }],
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
