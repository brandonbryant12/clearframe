// Generates cinematic-explainer.json (run from the repository root:
// node library/playbooks/_cinematic-explainer.mjs).
// Where a city's water comes from, as one world drawn in cross-section: rain on lit hills, a
// reservoir behind a dam, a pipe running through the ground to a treatment plant, a second
// network under the streets to every tap. The ground is cut away, so the payoff (most of the
// journey is out of sight) is visible when the camera pulls back over the whole of it.
import fs from 'node:fs';
import { smoothPath, rng } from '../../fframes/sketch-kit.mjs';

const r = v => Math.round(v * 10) / 10;
const rand = rng(12);
const SAMPLE = 'Illustrative sample data · replace before publishing';
// On screen from the first frame, children too (a shape without an entrance would fade or draw in).
const still = list => list.map(el => ({ at: 0, enter: 'none', ...el, ...(el.children ? { children: still(el.children) } : {}) }));

// ------------------------------------------------------------------ the land in section
// The surface: peaks on the left, a valley holding the reservoir, the plain the plant and the
// city stand on. Everything below it is the cut-away ground.
const surfacePts = [
  [-600, 760],
  [-200, 520],
  [120, 330],
  [300, 430],
  [520, 250],
  [760, 420],
  [900, 520],
  [1000, 600],
  [1080, 700],
  [1200, 742],
  [1440, 744],
  [1478, 600],
  [1540, 662],
  [1700, 676],
  [2200, 680],
  [5800, 680],
];
const surface = smoothPath(surfacePts);
const BOTTOM = 2300;
const ground = `${surface} L 5800 ${BOTTOM} L -600 ${BOTTOM} Z`;
// Strata: wavy bands following the ground down into the rock.
const strata = [0, 1, 2, 3].map(i => {
  const pts = [];
  for (let x = -600; x <= 5800; x += 200) pts.push([x, 760 + i * 150 + Math.sin(x / 300 + i) * 18 + (x < 1200 ? (1200 - x) * -0.05 * (3 - i) : 0)]);
  return smoothPath(pts);
});
const pebbles = [];
for (let i = 0; i < 140; i++) {
  const x = -500 + rand() * 6200,
    y = 820 + rand() * 820;
  pebbles.push(`M ${r(x)} ${r(y)} h 0.1`);
}

// ------------------------------------------------------------------ the pipe
const PIPE1 = 'M 1505 744 L 1505 790 L 2620 790 L 2620 640 L 2700 640';
const PIPE2 = 'M 3240 640 L 3330 640 L 3330 800 L 5000 800';
const branches = [3920, 4220, 4520, 4820].map(x => `M ${x} 800 L ${x} 690`).join(' ');
const pipe = (d, at, say, extra = {}) => [
  // The pipe wall, then the water moving inside it.
  { type: 'path', d, fill: 'none', stroke: 'surface', width: 30, join: 'round', cap: 'round', at, say, enter: 'draw', dur: 1.4, ...extra },
  {
    type: 'path',
    d,
    fill: 'none',
    stroke: 'accent2',
    width: 14,
    join: 'round',
    cap: 'round',
    glow: { blur: 10, opacity: 0.7 },
    at,
    say,
    enter: 'draw',
    dur: 1.4,
    ...extra,
  },
  {
    type: 'path',
    d,
    fill: 'none',
    stroke: 'ink',
    width: 4,
    dash: [10, 34],
    cap: 'round',
    opacity: 0.8,
    at,
    say,
    enter: 'draw',
    dur: 1.4,
    loop: { type: 'dash', period: 1.2 },
    ...extra,
  },
];

// ------------------------------------------------------------------ station 1: rain and reservoir
const sky = [
  { type: 'rect', x: -700, y: -1600, w: 6600, h: 2400, fill: { gradient: ['bg', 'bg', 'surface', 'accent2'], angle: 90 } },
  // The morning sun low over the city end of the world.
  {
    type: 'ellipse',
    cx: 4600,
    cy: 640,
    rx: 3000,
    ry: 1000,
    fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
    opacity: 0.55,
  },
  { type: 'particles', x: -600, y: -1500, w: 6400, h: 1300, kind: 'stars', count: 60, seed: 3, size: 2, fill: 'ink', opacity: 0.35 },
];
const far = smoothPath([
  [-600, 600],
  [-100, 380],
  [300, 470],
  [700, 340],
  [1100, 520],
  [1400, 600],
  [1800, 640],
]);
const hills = [
  // A far range in the haze.
  { type: 'path', d: `${far} L 1800 760 L -600 760 Z`, fill: 'muted', opacity: 0.3, stroke: 'none', z: 3 },
  { type: 'path', d: ground, fill: { gradient: ['surface', 'bg', 'bg'], angle: 90 }, stroke: 'none' },
  // Morning light catching the east-facing ridges.
  {
    type: 'path',
    d: smoothPath([
      [120, 330],
      [300, 430],
    ]) + ' ' + smoothPath([
      [520, 250],
      [760, 420],
      [900, 520],
      [1000, 600],
    ]),
    fill: 'none',
    stroke: 'accent',
    width: 5,
    opacity: 0.7,
    glow: { blur: 8, opacity: 0.6 },
  },
  // Strata and stones in the cut-away ground.
  ...strata.map((d, i) => ({ type: 'path', d, fill: 'none', stroke: 'muted', width: 3, opacity: 0.22 + 0.04 * i })),
  // Groundwater: a lens of water held in the rock far below.
  {
    type: 'ellipse',
    cx: 2400,
    cy: 1330,
    rx: 2300,
    ry: 120,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.22,
  },
  { type: 'path', d: pebbles.join(' '), fill: 'none', stroke: 'muted', width: 7, cap: 'round', opacity: 0.18 },
  // The cut edge of the ground: a lit line along the surface.
  { type: 'path', d: surface, fill: 'none', stroke: 'accent', width: 3, opacity: 0.5 },
];
// A cumulus: a billowing top built from arcs over a flat base, lit from above, its base in shadow.
const cumulus = (cx, base, w, h, seed) => {
  const g = rng(seed),
    n = 7,
    xs = Array.from({ length: n + 1 }, (_, i) => cx - w / 2 + (w * i) / n + (i && i < n ? (g() - 0.5) * (w / n) * 0.5 : 0));
  let d = `M ${r(xs[0])} ${r(base)}`;
  xs.slice(1).forEach((x, i) => {
    const t = (i + 1) / n,
      y = i + 1 < n ? base - h * Math.sin(Math.PI * t) ** 0.7 * (0.65 + 0.35 * g()) : base,
      rad = (x - xs[i]) * (0.55 + 0.25 * g());
    d += ` A ${r(rad)} ${r(rad * 0.9)} 0 0 1 ${r(x)} ${r(y)}`;
  });
  d += ` Q ${r(cx)} ${r(base + h * 0.06)} ${r(xs[0])} ${r(base)} Z`;
  return [
    { type: 'path', d, fill: { gradient: ['ink', 'muted', 'surface'], angle: 90 }, stroke: 'none', opacity: 0.94 },
    { type: 'path', d, fill: 'none', stroke: 'accent', width: 2.5, opacity: 0.35 },
  ];
};
const source = [
  ...still(sky),
  ...still(hills),
  {
    type: 'group',
    at: 0,
    enter: 'none',
    z: 0.6,
    loop: { type: 'float', period: 9, amount: 10 },
    children: still([...cumulus(880, 372, 560, 160, 2), ...cumulus(420, 410, 760, 200, 1)]),
  },
  {
    type: 'particles',
    x: 120,
    y: 220,
    w: 1050,
    h: 420,
    kind: 'rain',
    count: 120,
    seed: 6,
    fill: 'accent2',
    opacity: 0.6,
    say: 'rain',
    enter: 'fade',
    dur: 0.6,
  },
  // The reservoir fills the valley behind the dam.
  {
    type: 'path',
    d: 'M 1008 612 L 1476 612 L 1476 744 L 1200 744 L 1080 702 Z',
    fill: { gradient: ['accent2', 'surface'], angle: 90 },
    stroke: 'none',
    say: 'collected',
    enter: 'wipe-up',
    dur: 1,
  },
  { type: 'line', x1: 1012, y1: 613, x2: 1474, y2: 613, stroke: 'ink', width: 2, opacity: 0.6, say: 'collected', enter: 'draw', dur: 0.8 },
  // The dam: a concrete wall lit on its face.
  {
    type: 'poly',
    points: [
      [1472, 590],
      [1500, 590],
      [1548, 748],
      [1472, 748],
    ],
    closed: true,
    fill: { gradient: ['ink', 'muted'], angle: 0 },
    at: 0,
    enter: 'none',
  },
  {
    type: 'text',
    text: 'Reservoir',
    x: 1240,
    y: 540,
    size: 56,
    font: 'bold',
    fill: 'ink',
    anchor: 'middle',
    say: 'reservoir',
    shadow: { blur: 12, opacity: 0.8 },
    exitAt: 9,
    exit: 'fade',
  },
];

// ------------------------------------------------------------------ station 2: the plant
const plant = [
  ...pipe(PIPE1, 0, undefined, { dur: 2 }),
  // The building, in section: two settling tanks, then the filter bed of sand and gravel.
  { type: 'rect', x: 2700, y: 520, w: 540, h: 164, r: 8, fill: { gradient: ['surface', 'bg'], angle: 90 }, stroke: 'muted', width: 3, at: 0, enter: 'none' },
  { type: 'poly', points: [[2690, 522], [2970, 430], [3250, 522]], closed: true, fill: { gradient: ['muted', 'surface'], angle: 0 }, stroke: 'muted', width: 3, at: 0, enter: 'none' },
  { type: 'line', x1: 2970, y1: 432, x2: 3250, y2: 522, stroke: 'accent', width: 3, opacity: 0.6, at: 0, enter: 'none' },
  ...[2730, 2880].map(x => ({ type: 'rect', x, y: 560, w: 120, h: 104, r: 4, fill: 'bg', stroke: 'muted', width: 2, at: 0, enter: 'none' })),
  ...[2730, 2880].map(x => ({
    type: 'rect',
    x: x + 4,
    y: 590,
    w: 112,
    h: 70,
    fill: { gradient: ['accent2', 'surface'], angle: 90 },
    say: 'filters',
    enter: 'wipe-up',
    dur: 0.8,
  })),
  ...[2790, 2940].map(cx => ({
    type: 'line',
    x1: cx - 40,
    y1: 625,
    x2: cx + 40,
    y2: 625,
    stroke: 'ink',
    width: 3,
    origin: [cx, 625],
    say: 'filters',
    loop: { type: 'spin', period: 3 },
  })),
  { type: 'rect', x: 3040, y: 560, w: 170, h: 104, r: 4, fill: 'bg', stroke: 'muted', width: 2, at: 0, enter: 'none' },
  ...[
    ['accent2', 570, 22],
    ['muted', 592, 26],
    ['accent', 618, 22],
    ['surface', 640, 20],
  ].map(([fill, y, h]) => ({ type: 'rect', x: 3044, y, w: 162, h, fill, opacity: fill === 'accent' ? 0.55 : 0.8, say: 'cleans', enter: 'wipe', dur: 0.6 })),
  // Clean water out: the second pipe begins.
  ...pipe('M 3240 640 L 3330 640', undefined, 'cleans'),
  {
    type: 'text',
    text: 'Treatment',
    x: 2970,
    y: 380,
    size: 56,
    font: 'bold',
    fill: 'ink',
    anchor: 'middle',
    say: 'plant',
    shadow: { blur: 12, opacity: 0.8 },
    exitAt: 9,
    exit: 'fade',
  },
];

// ------------------------------------------------------------------ station 3: the streets
const G0 = 680; // street level
const windowRow = (x0, y, n, gap, w, h, litEvery) =>
  Array.from({ length: n }, (_, i) => ({
    type: 'rect',
    x: x0 + i * gap,
    y,
    w,
    h,
    fill: litEvery && i % litEvery === 1 ? 'accent' : 'bg',
    opacity: litEvery && i % litEvery === 1 ? 0.85 : 0.75,
    stroke: 'muted',
    width: 1.5,
  }));
// A terrace house: three floors, a parapet, a door; lit from the right by the low sun.
const terrace = (x, w) => [
  { type: 'rect', x, y: G0 - 300, w, h: 300, fill: { gradient: ['surface', 'muted', 'surface'], angle: 0 }, opacity: 0.95 },
  { type: 'rect', x: x - 6, y: G0 - 312, w: w + 12, h: 14, fill: 'surface', stroke: 'muted', width: 1.5 },
  { type: 'rect', x: x + w - 6, y: G0 - 300, w: 6, h: 300, fill: 'accent', opacity: 0.35 },
  ...[0, 1, 2].flatMap(f => windowRow(x + 22, G0 - 280 + f * 92, 3, (w - 44) / 3, 40, 56, f === 1 ? 2 : 0)),
  { type: 'rect', x: x + w / 2 - 22, y: G0 - 70, w: 44, h: 70, fill: 'bg', stroke: 'muted', width: 1.5 },
];
// A gabled house with a chimney.
const gabled = (x, w) => [
  { type: 'rect', x, y: G0 - 190, w, h: 190, fill: { gradient: ['surface', 'muted', 'surface'], angle: 0 }, opacity: 0.95 },
  { type: 'poly', points: [[x - 14, G0 - 188], [x + w / 2, G0 - 300], [x + w + 14, G0 - 188]], closed: true, fill: { gradient: ['bg', 'surface', 'muted'], angle: 0 } },
  { type: 'line', x1: x + w / 2, y1: G0 - 300, x2: x + w + 14, y2: G0 - 188, stroke: 'accent', width: 3, opacity: 0.6 },
  { type: 'rect', x: x + w * 0.68, y: G0 - 296, w: 26, h: 70, fill: 'surface', stroke: 'muted', width: 1.5 },
  ...windowRow(x + 26, G0 - 160, 3, (w - 52) / 3, 40, 52, 3),
  { type: 'rect', x: x + 26, y: G0 - 80, w: 40, h: 80, fill: 'bg', stroke: 'muted', width: 1.5 },
  ...windowRow(x + 100, G0 - 72, 2, 64, 44, 48, 0),
];
// An apartment block, four floors.
const block = (x, w) => [
  { type: 'rect', x, y: G0 - 390, w, h: 390, fill: { gradient: ['surface', 'muted', 'surface'], angle: 0 }, opacity: 0.95 },
  { type: 'rect', x: x + w - 6, y: G0 - 390, w: 6, h: 390, fill: 'accent', opacity: 0.35 },
  ...[0, 1, 2, 3].flatMap(f => windowRow(x + 20, G0 - 366 + f * 88, 4, (w - 40) / 4, 36, 52, f % 2 ? 3 : 4)),
  { type: 'rect', x: x + 30, y: G0 - 404, w: 60, h: 14, fill: 'surface' },
];
// The tap house, cut open: its walls in section, a kitchen with a sink, the riser coming up
// through the floor to the tap.
// The tap house, cut open in section: two storeys at the same floor height as its neighbours, a
// kitchen downstairs with the riser coming up through the floor to the tap, a lamp upstairs.
const FLOOR = 92;
const CUT = { x: 4250, w: 300 };
const TAP = [CUT.x + 150, G0 - 52];
const cutaway = (x, w) => [
  // Rooms behind the cut: warm walls, a window each floor.
  { type: 'rect', x, y: G0 - 2 * FLOOR, w, h: 2 * FLOOR, fill: { gradient: ['accent', 'muted', 'surface'], angle: 90 } },
  { type: 'rect', x, y: G0 - 2 * FLOOR, w, h: 2 * FLOOR, fill: { gradient: ['ink', 'ink'], radial: true, fade: true }, opacity: 0.16 },
  ...[0, 1].map(f => ({ type: 'rect', x: x + 30, y: G0 - (f + 1) * FLOOR + 22, w: 44, h: 50, fill: { gradient: ['accent2', 'accent'], angle: 90 }, stroke: 'surface', width: 4 })),
  // Upstairs: a lamp and a shelf.
  { type: 'line', x1: x + w - 80, y1: G0 - 2 * FLOOR, x2: x + w - 80, y2: G0 - 2 * FLOOR + 28, stroke: 'bg', width: 2 },
  { type: 'path', d: `M ${x + w - 96} ${G0 - 2 * FLOOR + 40} h 32 l -6 -12 h -20 Z`, fill: 'bg', stroke: 'none' },
  { type: 'ellipse', cx: x + w - 80, cy: G0 - 2 * FLOOR + 56, rx: 60, ry: 36, fill: { gradient: ['ink', 'accent'], radial: true, fade: true }, opacity: 0.35 },
  { type: 'rect', x: x + 110, y: G0 - 2 * FLOOR + 50, w: 80, h: 5, fill: 'surface' },
  // The cut: walls, floor slab and roof drawn solid in section, edged in the low sun.
  { type: 'rect', x: x - 12, y: G0 - 2 * FLOOR, w: 14, h: 2 * FLOOR, fill: 'bg', stroke: 'muted', width: 2 },
  { type: 'rect', x: x + w - 2, y: G0 - 2 * FLOOR, w: 14, h: 2 * FLOOR, fill: 'bg', stroke: 'muted', width: 2 },
  { type: 'rect', x: x - 12, y: G0 - FLOOR - 5, w: w + 24, h: 10, fill: 'bg', stroke: 'muted', width: 2 },
  { type: 'rect', x: x - 12, y: G0 - 2 * FLOOR - 4, w: w + 24, h: 10, fill: 'bg', stroke: 'muted', width: 2 },
  {
    type: 'poly',
    points: [
      [x - 26, G0 - 2 * FLOOR - 2],
      [x + w / 2, G0 - 2 * FLOOR - 82],
      [x + w + 26, G0 - 2 * FLOOR - 2],
      [x + w + 4, G0 - 2 * FLOOR - 2],
      [x + w / 2, G0 - 2 * FLOOR - 62],
      [x - 4, G0 - 2 * FLOOR - 2],
    ],
    closed: true,
    fill: { gradient: ['surface', 'muted'], angle: 0 },
    stroke: 'bg',
    width: 2,
  },
  { type: 'line', x1: x + w / 2, y1: G0 - 2 * FLOOR - 82, x2: x + w + 26, y2: G0 - 2 * FLOOR - 2, stroke: 'accent', width: 3, opacity: 0.7 },
  // Downstairs: the kitchen counter with the sink set in it, a cupboard below.
  { type: 'rect', x: x + 100, y: G0 - 36, w: 120, h: 36, fill: 'surface', stroke: 'bg', width: 2 },
  { type: 'rect', x: x + 94, y: G0 - 42, w: 132, h: 7, fill: 'ink', opacity: 0.85 },
  { type: 'path', d: `M ${TAP[0] - 26} ${G0 - 42} q 26 16 52 0`, fill: 'bg', stroke: 'ink', width: 2, opacity: 0.9 },
];
const house = (x, w, kind) => (kind === 'terrace' ? terrace : kind === 'gabled' ? gabled : block)(x, w);
const tree = (x, s = 1) => [
  { type: 'rect', x: x - 5, y: G0 - 90 * s, w: 10, h: 90 * s, fill: 'bg' },
  ...[
    [0, -120, 56],
    [-34, -96, 44],
    [32, -92, 46],
  ].map(([dx, dy, rr]) => ({ type: 'circle', cx: x + dx * s, cy: G0 + dy * s, r: rr * s, fill: { gradient: ['positive', 'surface'], angle: 60 }, opacity: 0.85 })),
];
const branchXs = [3790, 4060, TAP[0] - 34, 4800];
const city = [
  ...pipe(`M 3330 640 L 3330 800 L 5600 800`, 0, undefined, { dur: 2.2 }),
  {
    type: 'group',
    at: 0,
    enter: 'none',
    children: still([
      { type: 'group', children: house(3690, 200, 'terrace') },
      { type: 'group', children: tree(3940, 0.9) },
      { type: 'group', children: house(3980, 170, 'gabled') },
      { type: 'group', children: cutaway(CUT.x, CUT.w) },
      { type: 'group', children: house(4640, 230, 'block') },
      { type: 'group', children: tree(4960, 1.1) },
    ]),
  },
  { type: 'rect', x: 3340, y: G0 - 4, w: 1700, h: 8, fill: 'surface', at: 0, enter: 'none' },
  ...pipe(
    branchXs.map(x => `M ${x} 800 L ${x} ${x === TAP[0] - 34 ? G0 - 30 : G0 - 14}`).join(' ') + ` M ${TAP[0] - 34} ${G0 - 30} L ${TAP[0] - 34} ${G0 - 66} L ${TAP[0]} ${G0 - 66}`,
    undefined,
    'every',
    { dur: 0.8 },
  ),
  // Each branch ends at a meter where it enters its building.
  ...branchXs
    .filter(x => x !== TAP[0] - 34)
    .map(x => ({ type: 'rect', x: x - 11, y: G0 - 30, w: 22, h: 18, r: 3, fill: 'bg', stroke: 'ink', width: 2, say: 'every', enter: 'pop', dur: 0.3 })),
  // The tap: a spout from the riser, and a drop forming under it.
  {
    type: 'path',
    d: `M ${TAP[0] - 2} ${G0 - 66} L ${TAP[0] + 6} ${G0 - 66} L ${TAP[0] + 6} ${G0 - 56}`,
    fill: 'none',
    stroke: 'ink',
    width: 7,
    cap: 'round',
    join: 'round',
    say: 'tap',
    enter: 'draw',
    dur: 0.4,
  },
  {
    type: 'circle',
    cx: TAP[0] + 6,
    cy: G0 - 50,
    r: 4.5,
    fill: 'accent2',
    glow: { blur: 8 },
    say: 'tap',
    loop: { type: 'float', period: 1.2, amount: 4 },
  },
  // The label sits in the sky above the house, clear of everything in it.
  {
    type: 'text',
    text: 'Your tap',
    x: CUT.x + CUT.w / 2,
    y: G0 - 2 * FLOOR - 110,
    size: 48,
    font: 'bold',
    fill: 'ink',
    anchor: 'middle',
    say: 'every',
    shadow: { blur: 12, opacity: 0.8 },
    exitAt: 7,
    exit: 'fade',
  },
];

// ------------------------------------------------------------------ beats
// The pull-back's labels clear before the camera returns to the tap.
const leave = { exitAt: 3.8, exitDur: 0.4, exit: 'fade' };
const beats = [
  {
    id: 'establish',
    block: 'canvas',
    // The first frame is the picture, not a fade up from black.
    transition: 'cut',
    vo: 'Every morning, a city of millions wakes up thirsty.',
    props: { sketch: 'rooftops' },
  },
  {
    id: 'question',
    block: 'kinetic',
    vo: 'So where does the water actually come from?',
    props: { mode: 'stack', align: 'center', emphasis: ['come from'] },
    // A drop swelling under a tap, out of focus behind the words: the question, drawn.
    art: {
      under: [
        {
          type: 'path',
          d: 'M 1180 -40 L 1180 140 Q 1180 200 1240 200 L 1600 200',
          fill: 'none',
          stroke: 'surface',
          width: 70,
          cap: 'round',
          join: 'round',
          blur: 6,
          at: 0,
          enter: 'none',
        },
        {
          type: 'path',
          d: 'M 1180 230 C 1150 290 1140 320 1140 345 A 40 40 0 0 0 1220 345 C 1220 320 1210 290 1180 230 Z',
          fill: { gradient: ['ink', 'accent2'], angle: 90 },
          stroke: 'none',
          opacity: 0.55,
          blur: 3,
          origin: [1180, 230],
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, scale: 0.6, dur: 0 },
            { at: 0, scale: 1.1, dur: 3, ease: 'inOut' },
          ],
        },
        {
          type: 'ellipse',
          cx: 960,
          cy: 900,
          rx: 900,
          ry: 120,
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.18,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 4, amount: 0.05 },
        },
      ],
    },
  },
  {
    id: 'source',
    block: 'canvas',
    vo: 'It starts as rain on the hills, collected in a reservoir.',
    tail: 0.7,
    props: { world: 'journey', view: [80, 70, 1680, 945], viewFrom: [-120, -60, 2160, 1215], viewAt: 0, viewDur: 4, elements: source },
  },
  {
    id: 'plant',
    block: 'canvas',
    vo: 'From there, a pipe carries it to a plant that filters and cleans it.',
    tail: 0.7,
    props: { world: 'journey', view: [2120, 160, 1600, 900], viewAt: 0, viewDur: 1.5, elements: plant },
  },
  {
    id: 'city',
    block: 'canvas',
    vo: 'Then a second network runs it under the streets, to every tap.',
    tail: 0.7,
    hold: 0.5,
    props: { world: 'journey', view: [3560, 150, 1600, 900], viewAt: 0, viewDur: 1.5, elements: city },
  },
  // Down through the street into the ground: the figure sits in the soil with the pipe.
  {
    id: 'hidden',
    block: 'canvas',
    vo: 'Nine in ten metres of that journey run underground.',
    hold: 1,
    props: {
      world: 'journey',
      // Framed so the street's edge sits under the top matte: soil, pipes and the figure only.
      view: [3440, 588, 1440, 810],
      viewAt: 0,
      viewDur: 1.6,
      source: SAMPLE,
      elements: [
        {
          type: 'path',
          d: 'M 3330 800 L 5600 800',
          fill: 'none',
          stroke: 'accent2',
          width: 40,
          opacity: 0.45,
          glow: { blur: 30, opacity: 1 },
          say: 'underground',
          enter: 'draw',
          dur: 0.9,
          exitAt: 6.4,
          exit: 'fade',
        },
        {
          type: 'text',
          text: '0',
          x: 3560,
          y: 1040,
          size: 210,
          font: 'display',
          fill: 'ink',
          at: 1.5,
          enter: 'fade',
          dur: 0.2,
          count: { from: 0, to: 90, dur: 1.2, suffix: '%' },
          exitAt: 6.4,
          exit: 'fade',
        },
        {
          type: 'text',
          text: "of the pipe's length runs underground",
          x: 4130,
          y: 1010,
          size: 44,
          font: 'semibold',
          fill: 'accent2',
          width: 640,
          at: 1.8,
          enter: 'rise',
          dur: 0.5,
          exitAt: 6.4,
          exit: 'fade',
        },
      ],
    },
  },
  // Silence: one drop from a chrome tap into a still basin, and the sound of it.
  {
    id: 'silence',
    block: 'canvas',
    hold: 1,
    sfx: [{ src: 'drop', at: 1.2, volume: 0.7 }],
    props: {
      elements: still([
        // Tiles lit by a window to the left.
        { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['muted', 'surface', 'bg'], angle: 0 } },
        {
          type: 'path',
          d: Array.from({ length: 13 }, (_, i) => `M ${-60 + i * 160} -100 V 600`).join(' ') + ' ' + Array.from({ length: 5 }, (_, i) => `M -100 ${i * 160 - 60} H 2020`).join(' '),
          fill: 'none',
          stroke: 'bg',
          width: 3,
          opacity: 0.35,
        },
        // The counter and the basin set into it, seen from just above.
        { type: 'rect', x: -100, y: 600, w: 2120, h: 600, fill: { gradient: ['surface', 'bg'], angle: 90 } },
        { type: 'rect', x: -100, y: 596, w: 2120, h: 6, fill: 'muted', opacity: 0.5 },
        { type: 'ellipse', cx: 960, cy: 790, rx: 660, ry: 150, fill: { gradient: ['ink', 'muted', 'surface'], angle: 0 } },
        { type: 'ellipse', cx: 960, cy: 800, rx: 590, ry: 122, fill: { gradient: ['bg', 'surface', 'muted'], angle: 90 } },
        // Still water in the bowl, the window's light across it.
        { type: 'ellipse', cx: 960, cy: 822, rx: 520, ry: 92, fill: { gradient: ['accent2', 'surface', 'bg'], angle: 0 }, opacity: 0.75 },
        { type: 'ellipse', cx: 760, cy: 812, rx: 210, ry: 26, fill: { gradient: ['ink', 'ink'], radial: true, fade: true }, opacity: 0.22 },
        { type: 'line', x1: 960, y1: 790, x2: 960, y2: 860, stroke: 'muted', width: 26, opacity: 0.18, blur: 4 },
        // The tap: a chrome arm from the wall, an elbow and the spout, with their highlights.
        { type: 'rect', x: 300, y: 150, w: 120, h: 120, r: 16, fill: { gradient: ['ink', 'muted', 'surface'], angle: 0 } },
        { type: 'rect', x: 420, y: 178, w: 400, h: 64, fill: { gradient: ['surface', 'ink', 'muted', 'bg'], angle: 90 } },
        {
          type: 'path',
          d: 'M 820 178 A 160 160 0 0 1 980 338 L 916 338 A 96 96 0 0 0 820 242 Z',
          fill: { gradient: ['ink', 'muted', 'surface'], angle: 45 },
          stroke: 'none',
        },
        { type: 'rect', x: 916, y: 336, w: 64, h: 40, fill: { gradient: ['bg', 'muted', 'ink', 'surface'], angle: 0 } },
        { type: 'ellipse', cx: 948, cy: 376, rx: 32, ry: 9, fill: 'bg', stroke: 'muted', width: 2 },
        { type: 'path', d: 'M 430 190 L 816 190 A 148 148 0 0 1 960 330', fill: 'none', stroke: 'ink', width: 4, cap: 'round', opacity: 0.85 },
      ]).concat([
        {
          type: 'circle',
          cx: 948,
          cy: 388,
          r: 12,
          fill: { gradient: ['ink', 'accent2'], angle: 90 },
          glow: { blur: 12 },
          at: 0.15,
          dur: 0.45,
          enter: 'grow',
          keys: [
            { at: 0.6, y: 432, dur: 0.6, ease: 'in' },
            { at: 1.2, opacity: 0, dur: 0.05 },
          ],
        },
        ...[0, 0.18, 0.36].map(d => ({
          type: 'ellipse',
          cx: 948,
          cy: 820,
          rx: 420,
          ry: 72,
          fill: 'none',
          stroke: 'ink',
          width: 3,
          opacity: 0.7,
          at: r(1.2 + d),
          enter: 'pop',
          dur: 0.15,
          keys: [
            { at: r(1.2 + d), scale: 0.08, dur: 0 },
            { at: r(1.2 + d), scale: 1, dur: 1.8, ease: 'out' },
            { at: r(1.4 + d), opacity: 0, dur: 1.4 },
          ],
          origin: [948, 820],
        })),
      ]),
    },
  },
  {
    id: 'whole',
    block: 'canvas',
    vo: 'One journey, most of it out of sight.',
    tail: 0.7,
    hold: 1.2,
    props: {
      world: 'journey',
      view: [-200, -900, 5300, 2981.3],
      // Back from the silence on the street, then the long pull-back over the whole journey.
      viewFrom: [3560, 150, 1600, 900],
      viewAt: 0,
      viewDur: 2.4,
      elements: [
        { type: 'text', text: 'One journey', x: 2500, y: -40, size: 190, font: 'serif-display', fill: 'ink', anchor: 'middle', at: 2.1, enter: 'rise', dur: 0.6, ...leave },
        // Station labels on dark plates, in clear sky above each stop.
        ...[
          ['RESERVOIR', 1240, 540, 740],
          ['TREATMENT', 2970, 330, 760],
          ['YOUR TAP', 4400, 200, 640],
        ].flatMap(([text, x, y, w], i) => [
          {
            type: 'rect',
            x: x - w / 2,
            y: y - 92,
            w,
            h: 124,
            r: 62,
            fill: 'bg',
            opacity: 0.72,
            at: r(2.2 + i * 0.15),
            enter: 'fade',
            dur: 0.5,
            ...leave,
          },
          {
            type: 'text',
            text,
            x,
            y,
            size: 84,
            font: 'semibold',
            tracking: 0.2,
            fill: 'ink',
            anchor: 'middle',
            at: r(2.2 + i * 0.15),
            enter: 'fade',
            dur: 0.5,
            ...leave,
          },
        ]),
        // Below the cut: the pipe's whole underground run, picked out.
        {
          type: 'path',
          d: 'M 1505 790 L 2620 790 M 3330 800 L 5600 800',
          fill: 'none',
          stroke: 'accent2',
          width: 60,
          opacity: 0.5,
          glow: { blur: 40, opacity: 1 },
          say: 'sight',
          enter: 'draw',
          dur: 1.2,
          ...leave,
        },
        { type: 'text', text: 'most of it out of sight', x: 2300, y: 1130, size: 180, font: 'serif-display-italic', fill: 'accent2', anchor: 'middle', say: 'sight', ...leave },
      ],
    },
  },
  // Back to the tap where it ends, and the line to take away.
  {
    id: 'end',
    block: 'canvas',
    vo: 'So follow the water in your own city.',
    hold: 0.8,
    // A hard cut back to the street (its own slow push), not a double exposure.
    transition: 'cut',
    props: {
      world: 'journey',
      view: [3310, -60, 2140, 1203.8],
      viewFrom: [3380, -20, 2000, 1125],
      viewAt: 0,
      viewDur: 4.5,
      elements: [
        { type: 'text', text: 'Follow the water.', x: 3700, y: 232, size: 96, font: 'serif-display-italic', fill: 'ink', anchor: 'start', at: 1.4, enter: 'rise', dur: 0.8 },
        { type: 'text', text: 'START AT THE TAP', x: 3704, y: 296, size: 38, font: 'semibold', tracking: 0.3, fill: 'accent', anchor: 'start', at: 2, enter: 'fade', dur: 0.6 },
      ],
    },
  },
];

const book = {
  order: 32,
  title: 'A cinematic explainer: an establishing shot, a question, one world explored, the figure, a silence, the whole',
  audience: 'Anyone who should understand how something works, told as a film rather than a deck',
  inputs: 'A place or system with three to five stops, the question it answers, one sourced figure, the takeaway',
  theme: 'cinema',
  motion: 'gentle',
  transition: 'cut',
  sfx: 'subtle',
  heading: 'bottom',
  textMotion: 'words',
  texture: { grain: 0.3, vignette: 0.45, animate: true },
  lens: { grade: 'teal-orange', gradeAmount: 0.5, bloom: 0.2, leak: 0.1, handheld: 0.12, blur: 0.4 },
  note: 'Shots, not slides (docs/cinema.md): wide establishing shot, an insert for the question, medium shots travelling one world, an insert for the figure, a silence, then the pull-back over the whole world, inside the same matte throughout. The world is drawn in section (library/playbooks/_cinematic-explainer.mjs) so the payoff is visible: redraw it for your system and keep the ground cut away. Replace the sample figure and its source before publishing.',
  beats,
};
fs.writeFileSync('library/playbooks/cinematic-explainer.json', JSON.stringify(book, null, 2) + '\n');
