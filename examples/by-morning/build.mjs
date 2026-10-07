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

  // The same three moments as one board (detail to whole): each is a panel of one world, placed
  // with `place`; the camera holds close on each in turn, travels across the gaps between them,
  // then pulls back to show all three side by side, still alive, with one line of type.
  const tall = shape === 'vertical', [W, H] = tall ? [1080, 1920] : [1920, 1080], gap = tall ? 140 : 160;
  const at = i => (tall ? [0, i * (H + gap)] : [i * (W + gap), 0]);
  const span = 3 * (tall ? H : W) + 2 * gap, margin = 260;
  const whole = tall
    ? (() => { const h = span + 2 * margin + 900, w = Math.round(h * W / H); return [Math.round(W / 2 - w / 2), -margin, w, h]; })()
    : (() => { const w = span + 2 * margin, h = Math.round(w * H / W); return [-margin, Math.round((H + 420) / 2 - h / 2), w, h]; })(); // the panels and the line under them, centred
  const titleAt = tall ? [W / 2, span + 300] : [span / 2, H + 380];
  // The product card's words would shrink below readable in the pull-back, so (copied from the
  // device sketch) they leave while the camera is on the next panel, as world labels do.
  const app = sketch('device', shape, { text: { PRODUCT: 'Penny', LINE: 'Your budget, one minute a day' } }).elements;
  const tidy = list => list.forEach(el => { if (el.type === 'text') Object.assign(el, { exitAt: 6, exit: 'fade', exitDur: 0.5 }); if (el.children) tidy(el.children); });
  tidy(app);
  const panel = (i, beat) => ({ ...beat, props: { world: 'penny', view: [...at(i), W, H], place: at(i), ...beat.props } });
  const boardStoryboard = {
    ...storyboard,
    title: 'By morning, as one board',
    beats: [
      panel(0, { id: 'night', block: 'canvas', vo: storyboard.beats[0].vo, props: { elements: night.elements } }),
      panel(1, { id: 'app', block: 'canvas', tail: 0.6, vo: storyboard.beats[1].vo, props: { elements: app } }),
      panel(2, { id: 'morning', block: 'canvas', vo: storyboard.beats[2].vo, props: { elements: morning.elements } }),
      {
        id: 'whole', block: 'canvas', hold: 2,
        vo: 'One night, one app, and a city that woke up to it.',
        props: {
          world: 'penny', view: whole, viewDur: 1.6,
          elements: [
            // Mats in the board's own colour over the margins and gaps: a drawing made wider than its
            // frame (rooftops pans its own camera) is trimmed to its panel in the whole view.
            ...(tall
              ? [[-5000, -5000, 11080, 5000], [-5000, span, 11080, 5000], [-5000, 0, 5000, span], [W, 0, 5000, span], [0, H, W, gap], [0, 2 * H + gap, W, gap]]
              : [[-5000, -5000, span + 10000, 5000], [-5000, H, span + 10000, 5000], [-5000, 0, 5000, H], [span, 0, 5000, H], [W, 0, gap, H], [2 * W + gap, 0, gap, H]])
              .map(([x, y, w, h]) => ({ type: 'rect', x, y, w, h, fill: 'bg', enter: 'none', at: 0 })),
            ...[0, 1, 2].map(i => ({ type: 'rect', x: at(i)[0] - 14, y: at(i)[1] - 14, w: W + 28, h: H + 28, r: 36, fill: 'none', stroke: 'accent', width: 12, enter: 'draw', at: 0.6 + i * 0.25, dur: 0.8 })),
            { type: 'text', text: 'Built at night. Opened by morning.', x: titleAt[0], y: titleAt[1], size: tall ? 230 : 210, font: 'semibold', fill: 'ink', anchor: 'middle', width: Math.round(whole[2] * 0.72), leading: 1.1, enter: 'fade', say: 'city', dur: 0.8 },
          ],
        },
      },
    ],
  };
  fs.writeFileSync(new URL(`storyboard-board-${shape}.json`, dir), JSON.stringify(boardStoryboard, null, 1) + '\n');
}
console.log('wrote storyboard-{landscape,vertical}.json and storyboard-board-{landscape,vertical}.json');
