// Generates concept-explainer.json (run from the repository root: node library/playbooks/_concept-explainer.mjs).
// One idea on one road: traffic flows under the title; side by side, a road with room to spare
// absorbs a tap of the brakes while a full one stops car by car; the curve that follows is
// computed from the queueing formula; the camera finds the jam close up for the turn, and the
// film ends on the road flowing again.
import fs from 'node:fs';

const MATH = 'Queueing theory (M/M/1): wait grows as load ÷ (1 − load)';
const SCENARIO = 'Illustrative scenario';
const r = v => Math.round(v * 10) / 10;
const still = el => ({ at: 0, enter: 'none', ...el });

// ------------------------------------------------------------------ a car, side on, facing right
// Body and cabin, glass, two wheels with hubs, a headlight and a tail light that brightens when
// it brakes. `brake: [at, until]` lights the brake; `fill` is the body colour.
function car(x, y, fill, keys, { brake, scale = 1 } = {}) {
  const s = v => r(v * scale);
  const children = [
    { type: 'ellipse', cx: x + s(85), cy: y + s(24), rx: s(92), ry: s(7), fill: 'ink', opacity: 0.18 },
    { type: 'rect', x, y: y - s(30), w: s(170), h: s(36), r: s(12), fill },
    {
      type: 'poly',
      points: [
        [x + s(34), y - s(28)],
        [x + s(58), y - s(60)],
        [x + s(118), y - s(60)],
        [x + s(144), y - s(28)],
      ].map(p => p.map(r)),
      closed: true,
      fill,
    },
    {
      type: 'poly',
      points: [
        [x + s(48), y - s(30)],
        [x + s(64), y - s(53)],
        [x + s(112), y - s(53)],
        [x + s(130), y - s(30)],
      ].map(p => p.map(r)),
      closed: true,
      fill: 'bg',
      opacity: 0.72,
    },
    { type: 'rect', x: x + s(86), y: y - s(55), w: s(6), h: s(26), fill },
    ...[38, 132].flatMap(cx => [
      { type: 'circle', cx: x + s(cx), cy: y + s(6), r: s(17), fill: 'ink' },
      { type: 'circle', cx: x + s(cx), cy: y + s(6), r: s(6), fill: 'line' },
    ]),
    { type: 'rect', x: x + s(164), y: y - s(24), w: s(7), h: s(9), r: s(2), fill: 'bg', opacity: 0.9 },
    { type: 'rect', x: x - s(1), y: y - s(24), w: s(6), h: s(11), r: s(2), fill: 'accent2', opacity: 0.45 },
  ].map(still);
  if (brake)
    children.push({
      type: 'rect',
      x: x - s(3),
      y: y - s(26),
      w: s(9),
      h: s(15),
      r: s(3),
      fill: 'accent2',
      glow: { blur: 12, opacity: 0.95 },
      at: brake[0],
      enter: 'pop',
      dur: 0.2,
      ...(brake[1] ? { exitAt: brake[1], exitDur: 0.3 } : {}),
    });
  return { type: 'group', at: 0, enter: 'none', keys, children };
}

// A road seen side on: the surface under the wheels and a kerb line.
const road = y => [
  still({ type: 'rect', x: -100, y: y + 22, w: 2120, h: 26, fill: 'line', opacity: 0.55 }),
  still({ type: 'line', x1: -100, y1: y + 22, x2: 2020, y2: y + 22, stroke: 'muted', width: 3 }),
];

const v = 120;
const flow = (x0, dx, n, y, dur, opts = {}) =>
  Array.from({ length: n }, (_, i) =>
    car(x0 + i * dx, y, 'muted', [{ at: 0, x: v * dur, dur, ease: 'linear', hold: false }], opts),
  );

// ------------------------------------------------------------------ 1. title over flowing traffic
const title = [
  ...road(800),
  ...flow(-900, 330, 9, 800, 7),
  {
    type: 'text',
    text: 'FIELD NOTES',
    x: 960,
    y: 300,
    size: 34,
    font: 'mono',
    anchor: 'middle',
    tracking: 0.3,
    fill: 'accent',
    at: 0.1,
    enter: 'fade',
    dur: 0.6,
  },
  {
    type: 'text',
    text: 'Why headroom matters',
    x: 960,
    y: 470,
    size: 170,
    font: 'serif-display',
    anchor: 'middle',
    fit: 1600,
    fill: 'ink',
    at: 0.3,
    enter: 'rise',
    dur: 0.7,
  },
];

// ------------------------------------------------------------------ 2. one tap of the brakes, twice
const t0 = 1.8,
  T = 9;
const ripple = [...road(400), ...road(820)];
ripple.push(
  {
    type: 'text',
    text: '70% full',
    x: 170,
    y: 270,
    size: 48,
    font: 'bold',
    fill: 'ink',
    at: 0.2,
    enter: 'rise',
    dur: 0.4,
  },
  {
    type: 'text',
    text: '90% full',
    x: 170,
    y: 690,
    size: 48,
    font: 'bold',
    fill: 'ink',
    at: 0.4,
    enter: 'rise',
    dur: 0.4,
  },
);
// Room to spare: the lead car taps its brakes and the gap behind it absorbs the slowdown.
const roomy = Array.from({ length: 13 }, (_, i) => -2000 + i * 300);
const lead = roomy.filter(x => x < 1500).length - 1;
roomy.forEach((x, i) =>
  ripple.push(
    i === lead
      ? car(
          x,
          400,
          'accent',
          [
            { at: 0, x: v * t0, dur: t0, ease: 'linear' },
            { at: t0, x: v * t0 + 30, dur: 0.6, ease: 'out' },
            { at: t0 + 0.6, x: v * t0 + 30 + v * (T - t0 - 0.6), dur: T - t0 - 0.6, ease: 'linear', hold: false },
          ],
          { brake: [t0, t0 + 0.9] },
        )
      : car(x, 400, 'muted', [{ at: 0, x: v * T, dur: T, ease: 'linear', hold: false }]),
  ),
);
// Packed: the same tap stops each car behind it in turn, a ripple running backwards.
const packed = Array.from({ length: 21 }, (_, i) => -2000 + i * 185);
const leadB = packed.filter(x => x < 1500).length - 1;
packed.forEach((x, i) => {
  const k = leadB - i;
  if (k < 0) return ripple.push(car(x, 820, 'muted', [{ at: 0, x: v * T, dur: T, ease: 'linear', hold: false }]));
  const tb = r(t0 + k * 0.32),
    d = r(v * t0 + 24 + k * 6);
  ripple.push(
    car(
      x,
      820,
      k === 0 ? 'accent' : 'muted',
      [
        { at: 0, x: d - 24, dur: tb, ease: 'linear' },
        { at: tb, x: d, dur: 0.5, ease: 'out' },
      ],
      { brake: [tb, null] },
    ),
  );
});
ripple.push({
  type: 'path',
  d: 'M 1500 650 C 1100 620 700 620 260 650',
  stroke: 'accent2',
  width: 5,
  arrow: 'end',
  head: 18,
  say: 'ripples',
  enter: 'draw',
  dur: 2.4,
  dash: [18, 12],
});

// ------------------------------------------------------------------ 4. the jam, close up
const jam = [
  ...road(700).map(el => ({ ...el })),
  ...Array.from({ length: 7 }, (_, i) =>
    car(-140 + i * 330, 700, i === 3 ? 'accent' : 'muted', [{ at: 0, x: 0, dur: 0 }], { scale: 1.8, brake: [0, null] }),
  ),
  {
    type: 'text',
    text: 'A full road has no room',
    x: 960,
    y: 260,
    size: 96,
    font: 'serif-display',
    anchor: 'middle',
    fit: 1500,
    fill: 'ink',
    say: 'full',
    enter: 'rise',
    dur: 0.6,
  },
  {
    type: 'text',
    text: 'for a single brake.',
    x: 960,
    y: 370,
    size: 96,
    font: 'serif-display',
    anchor: 'middle',
    fit: 1500,
    fill: 'accent',
    say: 'single',
    enter: 'rise',
    dur: 0.6,
  },
];

// ------------------------------------------------------------------ 5. flowing again
const after = [
  ...road(800),
  ...flow(-1200, 360, 10, 800, 9),
  {
    type: 'text',
    text: 'Leave room for the unexpected.',
    x: 960,
    y: 400,
    size: 104,
    font: 'serif-display',
    anchor: 'middle',
    fit: 1560,
    fill: 'ink',
    say: 'Leave',
    enter: 'rise',
    dur: 0.7,
  },
  {
    type: 'text',
    text: 'Plan for about 70% full, not 100%.',
    x: 960,
    y: 486,
    size: 40,
    anchor: 'middle',
    fit: 1300,
    fill: 'muted',
    say: 'plan',
    enter: 'fade',
    dur: 0.6,
  },
];

const beats = [
  {
    id: 'title',
    block: 'canvas',
    vo: 'Why does a road at ninety percent full jam, when one at seventy keeps flowing?',
    props: { elements: title },
    camera: { move: 'in', amount: 0.5 },
  },
  {
    id: 'ripple',
    block: 'canvas',
    vo: 'One driver taps the brakes. With room to spare, the gap absorbs it. Packed full, the slowdown ripples back down the line.',
    transition: 'whip',
    props: { source: SCENARIO, elements: ripple },
    sfx: [
      { src: 'brake', at: 'word:taps', volume: 0.25 },
      { src: 'brake', at: 'word:ripples', volume: 0.35 },
    ],
    camera: { move: 'left', amount: 0.5 },
  },
  {
    id: 'curve',
    block: 'canvas',
    vo: 'Queueing math says the wait grows with load over spare room. At ninety percent full, it is nine times the wait at half full.',
    transition: 'dissolve',
    props: {
      source: MATH,
      chart: {
        kind: 'bars',
        id: 'load',
        suffix: '×',
        values: [
          { label: '50% full', value: 1 },
          { label: '60%', value: 1.5 },
          { label: '70%', value: 2.3 },
          { label: '80%', value: 4 },
          { label: '90%', value: 9, highlight: true },
        ],
        note: { text: '9 times the wait at half full', to: '90%', say: 'nine' },
      },
      elements: [],
    },
    camera: { move: 'in', amount: 0.6 },
  },
  {
    id: 'jam',
    block: 'canvas',
    vo: 'A full road has no room for a single brake.',
    transition: 'cut',
    props: { elements: jam },
    camera: { move: 'right', amount: 0.4 },
    hold: 0.5,
  },
  {
    id: 'end',
    block: 'canvas',
    vo: 'Leave room for the unexpected: plan for about seventy percent, not a hundred.',
    transition: 'dissolve',
    props: { source: MATH, elements: after },
    hold: 1,
  },
];

const book = {
  order: 0,
  title: 'Explain a mechanism',
  audience: 'A curious beginner',
  inputs: 'One concept, an example, a caveat',
  backdrop: 'paper',
  heading: 'bottom',
  textMotion: 'words',
  transition: 'cut',
  sfx: 'subtle',
  texture: { grain: 0.2, vignette: 0.35 },
  lens: { grade: 'warm', gradeAmount: 0.3, handheld: 0.1, blur: 0.5 },
  note: 'One idea, one example, one curve, all on one road. Draw the mechanism with the example (a brake rippling through full traffic), show the curve it implies (computed from a formula, so its source is the formula), find the jam close up for the turn, and end on the road flowing again (library/playbooks/_concept-explainer.mjs). Replace the example with yours and keep every comparator visible (×, of what).',
  beats,
};
fs.writeFileSync('library/playbooks/concept-explainer.json', JSON.stringify(book, null, 2) + '\n');
