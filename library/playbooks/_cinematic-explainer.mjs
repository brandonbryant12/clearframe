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
const still = list => list.map(el => ({ at: 0, enter: 'none', ...el }));

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
const cloud = (cx, cy, k) =>
  [
    [0, 0, 260, 90],
    [-180, 30, 170, 70],
    [190, 26, 200, 74],
    [60, -50, 160, 80],
  ].map(([dx, dy, rx, ry]) => ({
    type: 'ellipse',
    cx: cx + dx * k,
    cy: cy + dy * k,
    rx: rx * k,
    ry: ry * k,
    fill: { gradient: ['muted', 'surface'], angle: 90 },
    opacity: 0.85,
  }));
const source = [
  ...still(sky),
  ...still(hills),
  {
    type: 'group',
    at: 0,
    enter: 'none',
    z: 0.6,
    loop: { type: 'float', period: 9, amount: 10 },
    children: [...cloud(380, 170, 1.3), ...cloud(860, 130, 1)],
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
  { type: 'rect', x: 2700, y: 520, w: 540, h: 164, r: 8, fill: { gradient: ['surface', 'bg'], angle: 90 }, stroke: 'muted', width: 3, say: 'plant', enter: 'grow-y' },
  { type: 'poly', points: [[2690, 522], [2970, 430], [3250, 522]], closed: true, fill: 'surface', stroke: 'muted', width: 3, say: 'plant', enter: 'fade' },
  ...[2730, 2880].map(x => ({ type: 'rect', x, y: 560, w: 120, h: 104, r: 4, fill: 'bg', stroke: 'muted', width: 2, say: 'plant', enter: 'fade' })),
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
  { type: 'rect', x: 3040, y: 560, w: 170, h: 104, r: 4, fill: 'bg', stroke: 'muted', width: 2, say: 'cleans', enter: 'fade' },
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
const house = (x, k, lit) => {
  const w = 220,
    h = 150 * k;
  return [
    { type: 'rect', x: x - w / 2, y: 680 - h, w, h, fill: { gradient: ['surface', 'bg'], angle: 90 }, stroke: 'muted', width: 2 },
    {
      type: 'poly',
      points: [
        [x - w / 2 - 14, 682 - h],
        [x, 680 - h - 90],
        [x + w / 2 + 14, 682 - h],
      ],
      closed: true,
      fill: { gradient: ['muted', 'surface'], angle: 0 },
      stroke: 'none',
    },
    ...[-50, 50].map(dx => ({
      type: 'rect',
      x: x + dx - 22,
      y: 680 - h + 34,
      w: 44,
      h: 40,
      fill: lit ? 'accent' : 'bg',
      opacity: lit ? 0.9 : 0.8,
      ...(lit ? { glow: { blur: 10, opacity: 0.7 } } : {}),
    })),
  ];
};
const city = [
  ...pipe(`M 3330 640 L 3330 800 L 5000 800`, 0, undefined, { dur: 2.2 }),
  { type: 'group', say: 'streets', stagger: 0.15, children: [3920, 4220, 4520, 4820].map((x, i) => ({ type: 'group', children: house(x, i % 2 ? 1.2 : 1, i !== 2) })) },
  ...pipe(branches, undefined, 'every', { dur: 0.6 }),
  // The tap in the third house, and a drop.
  {
    type: 'path',
    d: 'M 4520 690 L 4520 600 L 4560 600 L 4560 618',
    fill: 'none',
    stroke: 'ink',
    width: 10,
    cap: 'round',
    join: 'round',
    say: 'tap',
    enter: 'draw',
    dur: 0.5,
  },
  {
    type: 'circle',
    cx: 4560,
    cy: 634,
    r: 7,
    fill: 'accent2',
    glow: { blur: 8 },
    say: 'tap',
    loop: { type: 'float', period: 1.2, amount: 8 },
  },
  {
    type: 'text',
    text: 'Your tap',
    x: 4370,
    y: 400,
    size: 56,
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
const leave = { exitAt: 4.3, exitDur: 0.4, exit: 'fade' };
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
    props: { world: 'journey', view: [80, 170, 1680, 945], viewFrom: [-120, -60, 2160, 1215], viewAt: 0, viewDur: 4, elements: source },
  },
  {
    id: 'plant',
    block: 'canvas',
    vo: 'But first, a pipe carries it to a plant that filters and cleans it.',
    tail: 0.7,
    props: { world: 'journey', view: [2120, 160, 1600, 900], elements: plant },
  },
  {
    id: 'city',
    block: 'canvas',
    vo: 'Then a second network runs it under the streets, to every tap.',
    tail: 0.7,
    hold: 0.5,
    props: { world: 'journey', view: [3560, 150, 1600, 900], elements: city },
  },
  {
    id: 'hidden',
    block: 'stat',
    vo: 'Nine in ten metres of that journey run underground.',
    tone: 'accent',
    transition: 'panel',
    props: {
      value: 90,
      suffix: '%',
      label: "of the pipe's length runs underground",
      align: 'center',
      land: 'ten',
      source: SAMPLE,
    },
  },
  // Silence: one drop from the tap into a still basin.
  {
    id: 'silence',
    block: 'canvas',
    hold: 1,
    props: {
      elements: [
        // A tap in close-up, lit by a window to the left; the basin below holds still water.
        { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['surface', 'bg', 'bg'], angle: 0 }, at: 0, enter: 'none' },
        {
          type: 'ellipse',
          cx: 300,
          cy: 300,
          rx: 700,
          ry: 520,
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.16,
          at: 0,
          enter: 'none',
        },
        ...[
          ['muted', 64, 0, 0, 1],
          ['bg', 18, 10, 14, 0.5],
          ['ink', 9, -12, -12, 0.75],
        ].map(([stroke, width, dx, dy, opacity]) => ({
          type: 'path',
          d: `M ${400 + dx} ${150 + dy} L ${820 + dx} ${150 + dy} Q ${960 + dx} ${150 + dy} ${960 + dx} ${290 + dy} L ${960 + dx} ${318 + dy}`,
          fill: 'none',
          stroke,
          width,
          cap: 'butt',
          join: 'round',
          opacity,
          at: 0,
          enter: 'none',
        })),
        { type: 'ellipse', cx: 960, cy: 320, rx: 32, ry: 9, fill: 'bg', stroke: 'ink', width: 2, opacity: 0.9, at: 0, enter: 'none' },
        // The basin: still water catching the window light, the tap's reflection in it.
        {
          type: 'ellipse',
          cx: 960,
          cy: 780,
          rx: 760,
          ry: 120,
          fill: { gradient: ['surface', 'accent2', 'bg'], angle: 0 },
          opacity: 0.7,
          at: 0,
          enter: 'none',
        },
        { type: 'ellipse', cx: 960, cy: 780, rx: 760, ry: 120, fill: 'none', stroke: 'muted', width: 6, opacity: 0.5, at: 0, enter: 'none' },
        { type: 'line', x1: 960, y1: 760, x2: 960, y2: 800, stroke: 'muted', width: 30, opacity: 0.15, at: 0, enter: 'none' },
        {
          type: 'circle',
          cx: 960,
          cy: 340,
          r: 13,
          fill: { gradient: ['ink', 'accent2'], angle: 90 },
          glow: { blur: 14 },
          at: 0.15,
          dur: 0.4,
          enter: 'grow',
          keys: [
            { at: 0.6, y: 430, dur: 0.6, ease: 'in' },
            { at: 1.2, opacity: 0, dur: 0.05 },
          ],
        },
        ...[0, 0.18, 0.36].map(d => ({
          type: 'ellipse',
          cx: 960,
          cy: 772,
          rx: 330,
          ry: 56,
          fill: 'none',
          stroke: 'accent2',
          width: 3,
          at: r(1.2 + d),
          enter: 'pop',
          dur: 0.15,
          keys: [
            { at: r(1.2 + d), scale: 0.14, dur: 0 },
            { at: r(1.2 + d), scale: 1, dur: 1.6, ease: 'out' },
            { at: r(1.4 + d), opacity: 0, dur: 1.2 },
          ],
          origin: [960, 772],
        })),
      ],
    },
  },
  {
    id: 'whole',
    block: 'canvas',
    vo: 'One journey, most of it out of sight.',
    tail: 0.7,
    hold: 1.2,
    lens: { letterbox: false },
    props: {
      world: 'journey',
      view: [-200, -900, 5300, 2981.3],
      viewAt: 0,
      viewDur: 3.4,
      elements: [
        { type: 'text', text: 'One journey', x: 2500, y: -140, size: 190, font: 'display', fill: 'ink', anchor: 'middle', say: 'journey', ...leave },
        ...[
          ['RESERVOIR', 1240, 470],
          ['TREATMENT', 2970, 340],
          ['YOUR TAP', 4370, 380],
        ].map(([text, x, y], i) => ({
          type: 'text',
          text,
          x,
          y,
          size: 100,
          font: 'semibold',
          tracking: 0.2,
          fill: 'ink',
          anchor: 'middle',
          at: r(0.9 + i * 0.25),
          enter: 'fade',
          dur: 0.5,
          ...leave,
        })),
        // Below the cut: the pipe's whole underground run, picked out.
        {
          type: 'path',
          d: 'M 1505 790 L 2620 790 M 3330 800 L 5000 800',
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
        { type: 'text', text: 'most of it out of sight', x: 2300, y: 1130, size: 180, font: 'serif-italic', fill: 'accent2', anchor: 'middle', say: 'sight', ...leave },
      ],
    },
  },
  // Back to the tap where it ends, and the line to take away.
  {
    id: 'end',
    block: 'canvas',
    vo: 'So follow the water in your own city.',
    hold: 0.8,
    props: {
      world: 'journey',
      view: [3480, 80, 1760, 990],
      viewAt: 0,
      viewDur: 2.6,
      elements: [
        { type: 'text', text: 'Follow the water.', x: 4360, y: 318, size: 96, font: 'serif-italic', fill: 'ink', anchor: 'middle', at: 1.4, enter: 'rise', dur: 0.8 },
        { type: 'text', text: 'START AT THE TAP', x: 4360, y: 380, size: 36, font: 'semibold', tracking: 0.3, fill: 'accent', anchor: 'middle', at: 2, enter: 'fade', dur: 0.6 },
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
  lens: { grade: 'teal-orange', gradeAmount: 0.5, bloom: 0.35, leak: 0.1, handheld: 0.15, blur: 0.5 },
  note: 'Shots, not slides (docs/cinema.md): wide establishing shot, an insert for the question, medium shots travelling one world, an insert for the figure, a silence, then the pull-back with the letterbox open. The world is drawn in section (library/playbooks/_cinematic-explainer.mjs) so the payoff is visible: redraw it for your system and keep the ground cut away. Replace the sample figure and its source before publishing.',
  beats,
};
fs.writeFileSync('library/playbooks/cinematic-explainer.json', JSON.stringify(book, null, 2) + '\n');
