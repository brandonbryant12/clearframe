// Generates cold-open.json (run from the repository root: node library/playbooks/_cold-open.mjs).
// A documentary cold open in five places, each one belonging to the story: the clock on the
// dispatch-room wall at 4:52, the harbor asleep, the operator's headset on the desk beside the
// tally of the night, a board with one light for every call, and the same harbor at first light.
import fs from 'node:fs';
import { harbor } from '../sketches/harbor.mjs';

const r = v => Math.round(v * 10) / 10;
const SAMPLE = 'Illustrative sample data · replace before publishing';
const still = list => list.map(el => ({ at: 0, enter: 'none', ...el }));

// ------------------------------------------------------------------ the clock (insert)
const C = [760, 520],
  R = 300;
const polar = (deg, rad) => [r(C[0] + rad * Math.sin((deg * Math.PI) / 180)), r(C[1] - rad * Math.cos((deg * Math.PI) / 180))];
const ticks = (n, inner, outer) =>
  Array.from({ length: n }, (_, i) => {
    const [a, b] = [polar((360 * i) / n, inner), polar((360 * i) / n, outer)];
    return `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
  }).join(' ');
// A hand pointing straight up, rotated about the centre: a tapered blade and a short tail.
const hand = (len, width, tail) =>
  `M ${r(C[0] - width / 2)} ${r(C[1] + tail)} L ${r(C[0] - width * 0.32)} ${r(C[1] - len)} L ${r(C[0])} ${r(C[1] - len - width * 0.6)} L ${r(C[0] + width * 0.32)} ${r(C[1] - len)} L ${r(C[0] + width / 2)} ${r(C[1] + tail)} Z`;
const HOUR = (4 + 52 / 60) * 30,
  MINUTE = 52 * 6;
const clock = [
  // The wall, lit by a desk lamp below and to the right.
  { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['bg', 'surface'], angle: 160 } },
  {
    type: 'ellipse',
    cx: 1500,
    cy: 1000,
    rx: 1100,
    ry: 760,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.22,
  },
  // Its shadow on the wall, thrown up and to the left by the lamp.
  { type: 'circle', cx: C[0] - 40, cy: C[1] - 34, r: R + 22, fill: 'bg', blur: 30, opacity: 0.8, z: 0.05 },
  // Bezel: brushed metal catching the lamp on its lower right.
  { type: 'circle', cx: C[0], cy: C[1], r: R + 18, fill: { gradient: ['surface', 'muted', 'ink'], angle: 45 }, z: 0 },
  { type: 'circle', cx: C[0], cy: C[1], r: R, fill: { gradient: ['muted', 'ink', 'ink'], angle: 40 }, z: 0 },
  // The dial in shadow at the top where the bezel shades it.
  {
    type: 'circle',
    cx: C[0],
    cy: C[1],
    r: R,
    fill: { gradient: ['bg', 'bg'], angle: 90, fade: true },
    opacity: 0.35,
    z: 0,
  },
  { type: 'path', d: ticks(60, R * 0.9, R * 0.95), fill: 'none', stroke: 'bg', width: 3, opacity: 0.8, z: 0 },
  { type: 'path', d: ticks(12, R * 0.78, R * 0.95), fill: 'none', stroke: 'bg', width: 11, z: 0 },
  // Hands at 4:52 with soft shadows, and the second hand sweeping.
  {
    type: 'path',
    d: hand(R * 0.52, 26, 40),
    fill: 'bg',
    stroke: 'none',
    rotate: HOUR,
    origin: [C[0] + 9, C[1] + 12],
    opacity: 0.3,
    blur: 5,
    z: 0,
  },
  { type: 'path', d: hand(R * 0.52, 26, 40), fill: 'bg', stroke: 'none', rotate: HOUR, origin: C, z: 0 },
  {
    type: 'path',
    d: hand(R * 0.8, 16, 46),
    fill: 'bg',
    stroke: 'none',
    rotate: MINUTE,
    origin: [C[0] + 12, C[1] + 15],
    opacity: 0.3,
    blur: 6,
    z: 0,
  },
  { type: 'path', d: hand(R * 0.8, 16, 46), fill: 'bg', stroke: 'none', rotate: MINUTE, origin: C, z: 0 },
  {
    type: 'group',
    origin: C,
    rotate: 200,
    z: 0,
    loop: { type: 'spin', period: 60 },
    children: [
      { type: 'line', x1: C[0], y1: C[1] + 70, x2: C[0], y2: C[1] - R * 0.88, stroke: 'accent', width: 4, cap: 'round' },
      { type: 'circle', cx: C[0], cy: C[1] + 70, r: 12, fill: 'accent' },
    ],
  },
  { type: 'circle', cx: C[0], cy: C[1], r: 16, fill: 'accent', z: 0 },
  { type: 'circle', cx: C[0], cy: C[1], r: 6, fill: 'bg', z: 0 },
  // Glass: one long reflection of the lamp across the dial.
  {
    type: 'ellipse',
    cx: C[0] + 90,
    cy: C[1] + 120,
    rx: R * 0.75,
    ry: R * 0.3,
    rotate: -35,
    origin: [C[0] + 90, C[1] + 120],
    fill: { gradient: ['ink', 'ink'], radial: true, fade: true },
    opacity: 0.16,
    blend: 'screen',
    z: 0,
  },
];
// The console in the foreground, out of focus until its line lights.
const console_ = {
  type: 'group',
  z: -0.4,
  children: [
    { type: 'rect', x: 1180, y: 860, w: 900, h: 300, r: 18, fill: 'surface' },
    { type: 'rect', x: 1180, y: 860, w: 900, h: 6, fill: 'muted', opacity: 0.4 },
    ...Array.from({ length: 6 }, (_, i) => ({
      type: 'rect',
      x: 1250 + i * 120,
      y: 920,
      w: 84,
      h: 40,
      r: 8,
      fill: 'bg',
      opacity: 0.8,
    })),
  ],
};
const lineLight = {
  type: 'rect',
  x: 1370,
  y: 920,
  w: 84,
  h: 40,
  r: 8,
  fill: 'accent',
  glow: { blur: 26, opacity: 1 },
  z: -0.4,
  say: 'call',
  enter: 'fade',
  dur: 0.15,
  loop: { type: 'blink', period: 0.9, amount: 0.85 },
};

// ------------------------------------------------------------------ the operator (close)
// An anonymous profile, never a likeness: a silhouette in a headset, rim-lit by the screens in
// front of it, the room behind falling away into soft screen light.
const profilePts = [
  [150, 1180],
  [190, 900],
  [330, 790],
  [392, 700],
  [372, 600],
  [338, 470],
  [356, 330],
  [440, 238],
  [540, 236],
  [608, 300],
  [628, 380],
  [632, 410],
  [672, 470],
  [640, 492],
  [648, 520],
  [640, 534],
  [646, 552],
  [628, 590],
  [584, 612],
  [568, 660],
  [582, 760],
  [700, 820],
  [790, 940],
  [820, 1180],
];
const smooth = pts => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, e] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    d += ` C ${r(b[0] + (c[0] - a[0]) / 6)} ${r(b[1] + (c[1] - a[1]) / 6)} ${r(c[0] - (e[0] - b[0]) / 6)} ${r(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return d;
};
const operator = [
  { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['bg', 'surface', 'bg'], angle: 0 } },
  // Screens across the room, far out of focus.
  ...[
    [-80, 180, 300, 190, 0.35],
    [250, 120, 260, 170, 0.22],
    [60, 430, 220, 150, 0.18],
  ].map(([x, y, w, h, o]) => ({
    type: 'rect',
    x,
    y,
    w,
    h,
    r: 8,
    fill: { gradient: ['accent2', 'accent'], angle: 90 },
    opacity: o,
    z: 4,
  })),
  // The light the operator faces, spilling from the right.
  {
    type: 'ellipse',
    cx: 1020,
    cy: 520,
    rx: 620,
    ry: 520,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.2,
    z: 0,
  },
  { type: 'path', d: `${smooth(profilePts)} L 150 1180 Z`, fill: 'bg', stroke: 'none', z: 0 },
  // Rim light along the brow, nose, lips and chin, and the shoulder.
  {
    type: 'path',
    d: smooth(profilePts.slice(7, 19)),
    fill: 'none',
    stroke: 'accent2',
    width: 3.5,
    cap: 'round',
    glow: { blur: 10, opacity: 0.8 },
    opacity: 0.9,
    z: 0,
  },
  {
    type: 'path',
    d: smooth(profilePts.slice(19, 23)),
    fill: 'none',
    stroke: 'accent2',
    width: 3,
    cap: 'round',
    glow: { blur: 8, opacity: 0.6 },
    opacity: 0.6,
    z: 0,
  },
  // The headset: band over the crown, the cup over the ear, the boom to the mouth.
  { type: 'path', d: 'M 412 470 C 380 300 430 214 520 218', fill: 'none', stroke: 'surface', width: 16, cap: 'round', z: 0 },
  { type: 'ellipse', cx: 430, cy: 478, rx: 56, ry: 74, fill: 'surface', stroke: 'muted', width: 2.5, z: 0 },
  { type: 'ellipse', cx: 436, cy: 478, rx: 28, ry: 40, fill: 'bg', opacity: 0.6, z: 0 },
  { type: 'path', d: 'M 470 520 C 520 580 580 572 626 548', fill: 'none', stroke: 'surface', width: 8, cap: 'round', z: 0 },
  { type: 'path', d: 'M 470 520 C 520 580 580 572 626 548', fill: 'none', stroke: 'accent2', width: 1.5, opacity: 0.6, z: 0 },
  { type: 'circle', cx: 630, cy: 546, r: 11, fill: 'surface', stroke: 'accent2', width: 1.5, z: 0 },
  { type: 'circle', cx: 470, cy: 430, r: 4, fill: 'accent', glow: { blur: 10, opacity: 1 }, z: 0, loop: { type: 'blink', period: 2.2, amount: 0.7 } },
  // Dust turning in the screen light.
  {
    type: 'particles',
    x: 600,
    y: 150,
    w: 900,
    h: 800,
    kind: 'dust',
    count: 26,
    seed: 6,
    size: 3,
    speed: 0.4,
    fill: 'accent2',
    opacity: 0.35,
    z: -0.2,
  },
];

// ------------------------------------------------------------------ the call board (insert)
const COLS = 24,
  ROWS = 13,
  CALLS = 312,
  board = { x: 140, y: 250, w: 980, h: 600 },
  gx = board.w / (COLS + 1),
  gy = board.h / (ROWS + 1),
  T0 = 0.3,
  TD = 3.1;
const cell = (c, rr) => [r(board.x + gx * (c + 1)), r(board.y + gy * (rr + 1))];
const allDots = Array.from({ length: CALLS }, (_, k) => cell(k % COLS, Math.floor(k / COLS)))
  .map(([x, y]) => `M${x} ${y}h.1`)
  .join('');
const boardEls = [
  { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['bg', 'surface', 'bg'], angle: 90 }, at: 0, enter: 'none' },
  {
    type: 'rect',
    x: board.x - 30,
    y: board.y - 30,
    w: board.w + 60,
    h: board.h + 60,
    r: 18,
    fill: 'surface',
    stroke: 'muted',
    width: 2,
    opacity: 0.9,
    shadow: { dx: 0, dy: 16, blur: 30, opacity: 0.7 },
    at: 0,
    enter: 'none',
  },
  // Every line on the board, dark until it rings.
  { type: 'path', d: allDots, fill: 'none', stroke: 'bg', width: 22, cap: 'round', at: 0, enter: 'none' },
  // One light for every call, in the order they came in.
  {
    type: 'group',
    glow: { blur: 10, opacity: 0.85 },
    at: 0,
    enter: 'none',
    children: Array.from({ length: ROWS }, (_, row) => ({
      type: 'group',
      at: r(T0 + (TD * row * COLS) / CALLS),
      stagger: r((TD / CALLS) * 1000) / 1000,
      children: Array.from({ length: COLS }, (_, c) => {
        const [x, y] = cell(c, row);
        return { type: 'circle', cx: x, cy: y, r: 10, fill: 'accent', enter: 'pop', dur: 0.2 };
      }),
    })),
  },
  {
    type: 'text',
    text: '0',
    x: 1240,
    y: 560,
    size: 230,
    font: 'display',
    fill: 'ink',
    anchor: 'start',
    at: T0,
    enter: 'fade',
    dur: 0.2,
    count: { from: 0, to: CALLS, dur: TD },
  },
  {
    type: 'text',
    text: 'calls before sunrise',
    x: 1250,
    y: 650,
    size: 54,
    font: 'semibold',
    fill: 'accent',
    anchor: 'start',
    at: 0.9,
    enter: 'rise',
    dur: 0.5,
  },
  {
    type: 'text',
    text: 'One light for each call to the line',
    x: 1250,
    y: 720,
    size: 36,
    font: 'regular',
    fill: 'muted',
    anchor: 'start',
    at: 1.3,
    enter: 'fade',
    dur: 0.6,
  },
];

// ------------------------------------------------------------------ the harbor world
const W = 1920,
  H = 1080;
const night = harbor(W, H, { seed: 37 });
const dawn = harbor(W, H, { seed: 37, dawn: true });
const NIGHT_VIEW = [0, 0, 1920, 1080],
  PUSH = [70, 20, 1800, 1012.5];

const beats = [
  {
    id: 'detail',
    block: 'canvas',
    // The first frame is the picture, not a fade up from black.
    transition: 'cut',
    vo: 'At four fifty-two in the morning, the first call came in.',
    hold: 0.3,
    props: {
      dolly: [{ at: 0, z: 0.12, dur: 8, ease: 'linear' }],
      focus: { z: 0, aperture: 1.4, keys: [{ say: 'call', z: -0.4, dur: 0.8 }] },
      elements: [...still(clock), still([console_])[0], lineLight],
    },
  },
  {
    id: 'place',
    block: 'canvas',
    vo: 'The city was still asleep.',
    transition: 'fade',
    props: {
      world: 'harbor',
      view: NIGHT_VIEW,
      viewFrom: [-110, 20, 1920, 1080],
      viewAt: 0,
      viewDur: 6,
      elements: [
        ...night,
        {
          type: 'text',
          text: 'HARBOR CITY · BEFORE DAWN',
          x: 120,
          y: 1020,
          size: 34,
          font: 'mono',
          tracking: 0.18,
          fill: 'ink',
          enter: 'type',
          at: 0.7,
          exitAt: 4.5,
          exit: 'fade',
        },
      ],
    },
  },
  {
    id: 'voice',
    block: 'canvas',
    vo: 'One operator remembers it clearly.',
    hold: 2.2,
    transition: 'cut',
    props: {
      dolly: [{ at: 0, z: 0.1, dur: 8, ease: 'linear' }],
      focus: { z: 0, aperture: 1.2 },
      elements: [
        ...still(operator),
        {
          type: 'text',
          text: '“We had no idea how big it was going to get.”',
          x: 1000,
          y: 360,
          width: 800,
          size: 64,
          leading: 1.18,
          font: 'serif-italic',
          fill: 'ink',
          at: 0.6,
          enter: 'fade',
          dur: 0.9,
        },
        { type: 'rect', x: 1000, y: 620, w: 60, h: 3, fill: 'accent', at: 1.2, enter: 'grow-x', dur: 0.5 },
        {
          type: 'text',
          text: 'Night-shift operator',
          x: 1000,
          y: 682,
          size: 40,
          font: 'semibold',
          fill: 'accent',
          at: 1.3,
          enter: 'fade',
          dur: 0.5,
        },
        {
          type: 'text',
          text: 'Illustrative quotation',
          x: 1000,
          y: 732,
          size: 30,
          font: 'regular',
          fill: 'muted',
          at: 1.4,
          enter: 'fade',
          dur: 0.5,
        },
      ],
    },
  },
  {
    id: 'scale',
    block: 'canvas',
    vo: 'By sunrise, the line had taken three hundred and twelve calls.',
    hold: 1.2,
    transition: 'cut',
    props: { source: SAMPLE, elements: boardEls },
  },
  // Back to the harbor, the camera easing in; the title sits in the night sky above the cranes.
  {
    id: 'title',
    block: 'canvas',
    hold: 1.2,
    vo: 'This is the story of the night shift.',
    transition: 'fade',
    props: {
      world: 'harbor',
      view: PUSH,
      viewAt: 0,
      viewDur: 4,
      elements: [
        {
          type: 'text',
          text: 'THE NIGHT SHIFT',
          x: 960,
          y: 215,
          size: 132,
          font: 'serif',
          anchor: 'middle',
          tracking: 0.1,
          fit: 1500,
          fill: 'ink',
          at: 0.6,
          enter: 'blur',
          dur: 1.2,
          exitAt: 60,
          exit: 'none',
        },
        {
          type: 'text',
          text: 'FOUR HOURS BEFORE MORNING',
          x: 960,
          y: 292,
          size: 36,
          font: 'semibold',
          anchor: 'middle',
          tracking: 0.32,
          fill: 'accent2',
          at: 1.4,
          enter: 'fade',
          dur: 0.8,
        },
      ],
    },
  },
  // The same frame at first light: a dissolve through the hours.
  {
    id: 'turn',
    block: 'canvas',
    vo: 'And of what they learned before morning.',
    transition: 'fade',
    props: {
      world: 'dawn',
      view: [100, 36, 1740, 978.75],
      viewFrom: PUSH,
      viewAt: 0,
      viewDur: 6,
      elements: [
        ...dawn,
        {
          type: 'text',
          text: 'What they learned before morning.',
          x: 960,
          y: 230,
          size: 76,
          font: 'serif-italic',
          anchor: 'middle',
          fit: 1400,
          fill: 'bg',
          at: 0.8,
          enter: 'fade',
          dur: 1,
        },
      ],
    },
  },
  {
    id: 'end',
    block: 'canvas',
    vo: 'Watch the full story.',
    hold: 0.8,
    props: {
      world: 'dawn',
      view: [0, 0, 1920, 1080],
      viewAt: 0,
      viewDur: 3,
      elements: [
        { type: 'rect', x: 900, y: 278, w: 120, h: 3, fill: 'bg', at: 0.4, enter: 'grow-x', dur: 0.6 },
        {
          type: 'text',
          text: 'WATCH THE FULL STORY',
          x: 960,
          y: 345,
          size: 38,
          font: 'semibold',
          anchor: 'middle',
          tracking: 0.3,
          fill: 'bg',
          at: 0.6,
          enter: 'fade',
          dur: 0.8,
        },
      ],
    },
  },
];

const book = {
  order: 30,
  title: 'A documentary cold open: a detail, the place, a voice, the scale, then the title',
  audience: 'Viewers of a true story, a case study or reportage',
  inputs: 'One vivid detail with a time and place, a first-hand quote, one sourced figure, a title',
  theme: 'ember',
  transition: 'fade',
  sfx: 'subtle',
  heading: 'bottom',
  texture: { grain: 0.45, vignette: 0.45, animate: true },
  lens: { grade: 'warm', gradeAmount: 0.5, bloom: 0.25, leak: 0.25, handheld: 0.35, blur: 0.5 },
  note: 'Start in the middle of the story, not with its title. Every place is drawn for this story (library/playbooks/_cold-open.mjs): a clock at the hour it began, the harbor the city sleeps around, the operator\'s desk, a board with one light per call, the same harbor at first light. Redraw them for yours. The quote and the figure are illustrative placeholders: replace them with real ones and their sources before publishing.',
  beats,
};
fs.writeFileSync('library/playbooks/cold-open.json', JSON.stringify(book, null, 2) + '\n');
