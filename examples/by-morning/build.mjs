// A human, a product and a place: one person builds an app at night, the app appears, and by
// morning the city's windows light up with people using it. Three existing sketches, each chosen
// for one part of the story and adapted where the brief needed it:
//   night   — desk, copied: its laptop light is cued to "building" (the sketch's own advice:
//             "cue the screen glow to the line"), keeping its slow push;
//   app     — device, as a sketch: its slots carry the product's name and line;
//   morning — rooftops, copied: its windows, which come on at scattered fixed seconds, are
//             gathered into one group cued to "morning", so the city wakes on the word.
// usage: node examples/by-morning/build.mjs
import fs from 'node:fs';
import { sketch } from '../../film/sketches.mjs';
import { rng } from '../../film/sketch-kit.mjs';

const dir = new URL('.', import.meta.url);

// desk: cue the screen's light (the two accent2 elements that fade in at 0.3 s) to a word.
function desk(preset, word) {
  const drawn = sketch('desk', preset);
  for (const el of drawn.elements)
    if (el.at === 0.3 && (el.stroke === 'accent2' || el.fill?.gradient?.[0] === 'accent2')) {
      el.say = word;
      delete el.at;
    }
  return drawn;
}

// rooftops: the small lit windows become one group that starts on a word, in a seeded order.
function rooftops(preset, word) {
  const drawn = sketch('rooftops', preset);
  const isWindow = el => el.type === 'rect' && el.w === 14 && el.h === 20 && el.enter === 'fade';
  const rand = rng(5);
  const windows = drawn.elements.filter(isWindow).map(({ at, z, ...el }) => ({ ...el, k: rand() })).sort((a, b) => a.k - b.k).map(({ k, ...el }) => el);
  // The group goes where the first window was drawn (over the roofs), in their plane (z 1.2).
  const at = drawn.elements.findIndex(isWindow);
  const rest = drawn.elements.filter(el => !isWindow(el));
  rest.splice(at, 0, { type: 'group', enter: 'none', z: 1.2, say: word, stagger: Math.round(2.2 / Math.max(1, windows.length) * 1000) / 1000, children: windows });
  return { ...drawn, elements: rest };
}

for (const shape of ['landscape', 'vertical']) {
  const night = desk(shape, 'building');
  const morning = rooftops(shape, 'morning');
  const storyboard = {
    version: 2,
    title: 'By morning',
    logline: 'One person builds a budgeting app at night; by morning the city is opening it.',
    format: { preset: shape, fps: 30 },
    theme: 'cinema', type: 'geometric', motion: { preset: 'gentle', intensity: 0.7 }, transition: 'cut', backdrop: 'none',
    captions: false, music: false,
    beats: [
      {
        id: 'night', block: 'canvas', tail: 0.8,
        vo: 'At two in the morning, one person was still at the desk, building the app they wished they had.',
        props: { elements: night.elements, dolly: night.dolly },
      },
      {
        id: 'app', block: 'canvas', transition: 'iris', tail: 0.4,
        vo: 'Penny. A budget you keep in one minute a day.',
        props: { sketch: 'device', sketchText: { PRODUCT: 'Penny', LINE: 'Your budget, one minute a day' } },
      },
      {
        id: 'morning', block: 'canvas', hold: 1.6,
        vo: 'By morning, the whole city was opening it.',
        props: { elements: morning.elements, view: morning.view, viewFrom: morning.viewFrom, viewDur: morning.viewDur },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json');
