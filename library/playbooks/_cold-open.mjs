// Generates cold-open.json (run from the repository root: node library/playbooks/_cold-open.mjs).
// A documentary cold open in five places, each one belonging to the story: the clock on the
// dispatch-room wall at 4:52, the harbor asleep, the operator's headset on the desk beside the
// tally of the night, a board with one light for every call, and the same harbor at first light.
import fs from 'node:fs';
import { harbor } from '../sketches/harbor.mjs';

const r = v => Math.round(v * 10) / 10;
const SAMPLE = 'Illustrative sample data · replace before publishing';
// On screen from the first frame, children too (a shape without an entrance would fade or draw in).
const still = list => list.map(el => ({ at: 0, enter: 'none', ...el, ...(el.children ? { children: still(el.children) } : {}) }));

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
/**
 * The clock on the dispatch-room wall at `hh:mm`. At night a desk lamp lights it from below; at
 * dawn the window throws four panes of low sun across the wall and the clock in them.
 */
const clockShot = (hh, mm, dawn = false) => {
  const HOUR = (hh + mm / 60) * 30,
    MINUTE = mm * 6;
  const pane = (x, y) => ({
    type: 'poly',
    points: [
      [x, y],
      [x + 300, y - 70],
      [x + 300, y + 230],
      [x, y + 300],
    ].map(([px, py]) => [r(px), r(py)]),
    closed: true,
    fill: { gradient: ['ink', 'accent2'], angle: 0 },
    opacity: 0.42,
    blend: 'screen',
    blur: 8,
  });
  return [
  { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: dawn ? ['muted', 'surface', 'bg'] : ['bg', 'surface'], angle: dawn ? 0 : 160 } },
  ...(dawn
    ? [pane(380, 300), pane(700, 225), pane(380, 620), pane(700, 545)]
    : [
        // The desk lamp's pool, below and to the right.
        {
          type: 'ellipse',
          cx: 1500,
          cy: 1000,
          rx: 1100,
          ry: 760,
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.22,
        },
      ]),
  // Its shadow on the wall, thrown by the lamp (night) or the window (dawn).
  { type: 'circle', cx: C[0] + (dawn ? 52 : -40), cy: C[1] + (dawn ? 24 : -34), r: R + 22, fill: 'bg', blur: 30, opacity: dawn ? 0.65 : 0.8, z: 0.05 },
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
};
const clock = clockShot(4, 52);
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
// An anonymous profile, never a likeness: hair gathered at the nape, a headset over it, the
// screens' light on the face and along the shoulder; the room behind falls away into blur.
const smooth = (pts, closed = false) => {
  const p = closed ? [pts.at(-1), ...pts, pts[0], pts[1]] : pts;
  let d = `M ${p[closed ? 1 : 0][0]} ${p[closed ? 1 : 0][1]}`;
  const start = closed ? 1 : 0,
    end = closed ? p.length - 2 : p.length - 1;
  for (let i = start; i < end; i++) {
    const [a, b, c, e] = [p[Math.max(0, i - 1)], p[i], p[i + 1], p[Math.min(p.length - 1, i + 2)]];
    d += ` C ${r(b[0] + (c[0] - a[0]) / 6)} ${r(b[1] + (c[1] - a[1]) / 6)} ${r(c[0] - (e[0] - b[0]) / 6)} ${r(c[1] - (e[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }
  return d;
};
// Face front, forehead to throat (facing right).
const face = [
  [566, 246],
  [584, 278],
  [595, 318],
  [600, 352],
  [604, 374],
  [597, 394],
  [600, 408],
  [614, 436],
  [630, 462],
  [642, 480],
  [637, 489],
  [622, 494],
  [614, 498],
  [613, 508],
  [621, 521],
  [617, 532],
  [610, 537],
  [616, 548],
  [611, 559],
  [602, 567],
  [610, 588],
  [606, 608],
  [588, 622],
  [556, 630],
  [530, 640],
  [520, 668],
  [526, 708],
  [534, 748],
];
const chest = [
  [548, 776],
  [610, 812],
  [700, 860],
  [772, 930],
  [812, 1020],
  [830, 1120],
];
const back = [
  [90, 1120],
  [120, 940],
  [196, 852],
  [300, 806],
  [356, 772],
  [380, 716],
  [386, 662],
];
// The hair's outer edge, nape to hairline: a low knot at the back, swept over the crown.
const hair = [
  [404, 650],
  [372, 628],
  [348, 594],
  [350, 556],
  [330, 512],
  [316, 448],
  [320, 380],
  [342, 306],
  [386, 238],
  [446, 194],
  [512, 184],
  [556, 204],
  [574, 238],
  [566, 246],
];
const hairInner = [
  [566, 246],
  [536, 262],
  [508, 300],
  [482, 350],
  [466, 400],
  [452, 452],
  [446, 520],
  [430, 590],
  [404, 650],
];
const operatorFigure = () => {
  const body = [...back, ...hair.slice(0, -1), ...face, ...chest];
  const faceLight = [...face.slice(0, 24), ...face.slice(0, 24).reverse().map(([x, y]) => [x - 46 + (y > 560 ? 10 : 0), y])];
  return [
    // Silhouette, then the hair, then the light on the face and the rim.
    { type: 'path', d: `${smooth(body)} Z`, fill: { gradient: ['surface', 'bg', 'bg'], angle: 0 }, stroke: 'none' },
    { type: 'path', d: `${smooth([...hair, ...hairInner.slice(1)])} Z`, fill: { gradient: ['bg', 'surface'], angle: 45 }, stroke: 'none' },
    {
      type: 'path',
      d: `${smooth(faceLight)} Z`,
      fill: { gradient: ['accent2', 'accent2'], angle: 180, fade: true },
      stroke: 'none',
      opacity: 0.5,
    },
    {
      type: 'path',
      d: smooth(face.slice(0, 26)),
      fill: 'none',
      stroke: 'accent2',
      width: 3.5,
      cap: 'round',
      glow: { blur: 12, opacity: 0.85 },
    },
    {
      type: 'path',
      d: smooth(hair.slice(8, 13)),
      fill: 'none',
      stroke: 'accent2',
      width: 2.5,
      cap: 'round',
      opacity: 0.6,
      glow: { blur: 8, opacity: 0.5 },
    },
    // A collar, and the screen light along the shoulder.
    { type: 'path', d: smooth([[530, 744], [560, 792], [612, 818]]), fill: 'none', stroke: 'surface', width: 10, cap: 'round' },
    { type: 'path', d: smooth([[536, 752], [566, 786], [640, 828]]), fill: 'none', stroke: 'muted', width: 2, opacity: 0.4 },
    { type: 'path', d: smooth(chest), fill: 'none', stroke: 'accent2', width: 3, cap: 'round', opacity: 0.6, glow: { blur: 10, opacity: 0.6 } },
    // The headset: the band over the crown, the cup over the ear, the boom to the mouth.
    { type: 'path', d: 'M 446 424 C 430 330 440 230 500 178', fill: 'none', stroke: 'surface', width: 15, cap: 'round' },
    { type: 'path', d: 'M 458 420 C 444 330 452 236 506 186', fill: 'none', stroke: 'muted', width: 2, cap: 'round', opacity: 0.5 },
    { type: 'ellipse', cx: 452, cy: 472, rx: 48, ry: 64, fill: { gradient: ['surface', 'bg'], angle: 0 }, stroke: 'surface', width: 3 },
    { type: 'path', d: 'M 470 412 A 48 64 0 0 1 498 480', fill: 'none', stroke: 'accent2', width: 2, opacity: 0.6 },
    { type: 'ellipse', cx: 456, cy: 472, rx: 30, ry: 44, fill: 'bg', opacity: 0.7 },
    { type: 'path', d: 'M 497 500 C 525 560 566 568 604 552', fill: 'none', stroke: 'surface', width: 8, cap: 'round' },
    { type: 'path', d: 'M 500 498 C 528 556 568 562 602 548', fill: 'none', stroke: 'accent2', width: 1.5, opacity: 0.7 },
    { type: 'rect', x: 596, y: 540, w: 22, h: 14, r: 7, fill: 'surface', stroke: 'accent2', width: 1.5 },
    { type: 'circle', cx: 482, cy: 432, r: 4, fill: 'accent', glow: { blur: 10, opacity: 1 }, loop: { type: 'blink', period: 2.2, amount: 0.7 } },
  ];
};

const operator = [
  { type: 'rect', x: -100, y: -100, w: 2120, h: 1280, fill: { gradient: ['bg', 'surface', 'bg'], angle: 0 } },
  // Screens across the room and the harbor through the window behind, far out of focus.
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
  ...[
    [80, 640, 26],
    [150, 610, 18],
    [230, 650, 22],
    [40, 700, 16],
    [300, 600, 14],
  ].map(([cx, cy, rr]) => ({ type: 'circle', cx, cy, r: rr, fill: 'accent2', opacity: 0.25, z: 5 })),
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
  { type: 'group', z: 0, subject: true, children: still(operatorFigure()) },
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
      elements: [...still(clock), ...still([console_]), lineLight],
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
    hold: 2.8,
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
  // A breath with no voice: the harbor again, only the lighthouse turning.
  {
    id: 'quiet',
    block: 'canvas',
    duration: 1.8,
    transition: 'dissolve',
    props: { world: 'harbor', view: [40, 10, 1860, 1046.3], viewAt: 0, viewDur: 1.8, elements: [] },
  },
  // Then the title, in the night sky above the cranes.
  {
    id: 'title',
    block: 'canvas',
    hold: 1.2,
    vo: 'This is the story of the night shift.',
    transition: 'cut',
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
          y: 262,
          size: 120,
          font: 'serif-display',
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
          y: 330,
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
    transition: 'dissolve',
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
          size: 80,
          font: 'serif-display-italic',
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
  // Back to the clock from the first shot, closer to the end of the shift: the sun is up.
  {
    id: 'end',
    block: 'canvas',
    vo: 'Watch the full story.',
    hold: 1,
    transition: 'cut',
    props: {
      dolly: [{ at: 0, z: 0.1, dur: 6, ease: 'linear' }],
      elements: [
        ...still(clockShot(6, 41, true)),
        {
          type: 'text',
          text: 'THE NIGHT SHIFT',
          x: 1170,
          y: 500,
          size: 66,
          font: 'serif-display',
          anchor: 'start',
          tracking: 0.08,
          fit: 620,
          fill: 'ink',
          at: 0.3,
          enter: 'fade',
          dur: 0.8,
        },
        { type: 'rect', x: 1172, y: 534, w: 120, h: 3, fill: 'accent', at: 0.7, enter: 'grow-x', dur: 0.5 },
        {
          type: 'text',
          text: 'WATCH THE FULL STORY',
          x: 1172,
          y: 600,
          size: 36,
          font: 'semibold',
          anchor: 'start',
          tracking: 0.22,
          fill: 'accent2',
          at: 0.9,
          enter: 'fade',
          dur: 0.6,
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
