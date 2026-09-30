// Generates zoom-journey.json (run from the repository root: node library/playbooks/_zoom-journey.mjs).
// One world at four scales, each ten times smaller; the ring on the way out marks the window.
import fs from 'node:fs';
import { smoothPath, rng } from '../../fframes/sketch-kit.mjs';
const r = v => Math.round(v * 100) / 100;
const rand = rng(21);
const R = 20000;
const view = (cx, cy, w) => [r(cx - w / 2), r(cy - (w * 9) / 32), r(w), r((w * 9) / 16)];
// A coastline: large bays and small inlets (several frequencies of wobble), not a potato.
const blob = (cx, cy, rad, n = 9, wob = 0.35) => {
  const pts = [],
    ph = [0, 1, 2, 3].map(() => rand() * Math.PI * 2),
    count = Math.max(28, n * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const k =
      rad *
      (1 +
        wob * (0.5 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(5 * a + ph[1]) + 0.15 * Math.sin(11 * a + ph[2])) +
        0.06 * (rand() - 0.5));
    pts.push([cx + Math.cos(a) * k, cy + Math.sin(a) * k * (0.8 + 0.2 * Math.sin(a + ph[3]))]);
  }
  pts.push(pts[0], pts[1]);
  return smoothPath(pts) + ' Z';
};
const P1 = [6000, -3000],
  P2 = [6400, -2800],
  P3 = [6420, -2790];
// Scale 0: the planet.
const planet = [
  {
    type: 'particles',
    x: -26000,
    y: -14700,
    w: 52000,
    h: 29400,
    kind: 'stars',
    count: 160,
    fill: 'ink',
    opacity: 0.7,
    size: 40,
    at: 0,
    enter: 'fade',
    dur: 1.5,
  },
  {
    type: 'circle',
    cx: 0,
    cy: 0,
    r: R + 900,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.35,
    at: 0.1,
    enter: 'fade',
    dur: 1.5,
  },
  { type: 'circle', cx: 0, cy: 0, r: R, fill: 'surface', at: 0.1, enter: 'fade', dur: 1.2 },
  {
    type: 'path',
    d: blob(5200, -2600, 7200, 11, 0.45),
    fill: 'muted',
    opacity: 0.55,
    stroke: 'none',
    at: 0.3,
    enter: 'fade',
    dur: 1.2,
  },
  {
    type: 'path',
    d: blob(-8200, 5200, 5200, 9, 0.5),
    fill: 'muted',
    opacity: 0.45,
    stroke: 'none',
    at: 0.4,
    enter: 'fade',
    dur: 1.2,
  },
  {
    type: 'path',
    d: blob(-4000, -11000, 3000, 8, 0.5),
    fill: 'muted',
    opacity: 0.4,
    stroke: 'none',
    at: 0.5,
    enter: 'fade',
    dur: 1.2,
  },
  // Night falls across the far side.
  {
    type: 'circle',
    cx: -9000,
    cy: 6000,
    r: R * 1.05,
    fill: { gradient: ['bg', 'bg'], radial: true, fade: true },
    opacity: 0.75,
    at: 0.2,
    enter: 'fade',
    dur: 1.5,
  },
  {
    type: 'circle',
    cx: 0,
    cy: 0,
    r: R + 160,
    fill: 'none',
    stroke: 'accent2',
    width: 220,
    opacity: 0.5,
    glow: { blur: 300 },
    at: 0.3,
    enter: 'fade',
    dur: 1.5,
  },
];
// Scale 1: a coast with city lights (10× in).
const lights = [];
for (let i = 0; i < 70; i++) {
  const a = rand() * Math.PI * 2,
    d = 380 * rand() ** 0.7;
  lights.push({
    type: 'circle',
    cx: r(P2[0] + Math.cos(a) * d),
    cy: r(P2[1] + Math.sin(a) * d * 0.6),
    r: r(4 + 10 * rand()),
    fill: rand() > 0.85 ? 'ink' : 'accent',
    opacity: 0.9,
    at: r(0.5 + rand() * 1.2),
    enter: 'fade',
    dur: 0.4,
  });
}
const coast = [
  {
    type: 'path',
    d: blob(P1[0] + 900, P1[1] + 300, 1500, 12, 0.3),
    fill: 'muted',
    opacity: 0.35,
    stroke: 'accent2',
    width: 14,
    at: 0.2,
    enter: 'fade',
    dur: 1,
  },
  { type: 'group', glow: { blur: 30, opacity: 0.9 }, children: lights },
  {
    type: 'text',
    text: 'A COAST',
    x: P1[0] - 2400,
    y: P1[1] + 1330,
    size: 80,
    font: 'mono',
    tracking: 0.3,
    fill: 'ink',
    at: 0.8,
    enter: 'type',
    exitAt: 60,
    exit: 'fade',
  },
];
// Scale 2: a city: a river and a street grid (10× in again).
const grid = [];
for (let i = -6; i <= 6; i++) {
  grid.push({
    type: 'line',
    x1: P2[0] - 240,
    y1: r(P2[1] + i * 20),
    x2: P2[0] + 240,
    y2: r(P2[1] + i * 20),
    stroke: 'muted',
    width: 0.7,
    opacity: 0.6,
    at: r(0.2 + (i + 6) * 0.03),
    enter: 'draw',
    dur: 0.6,
  });
  grid.push({
    type: 'line',
    x1: r(P2[0] + i * 36),
    y1: P2[1] - 140,
    x2: r(P2[0] + i * 36),
    y2: P2[1] + 140,
    stroke: 'muted',
    width: 0.7,
    opacity: 0.6,
    at: r(0.25 + (i + 6) * 0.03),
    enter: 'draw',
    dur: 0.6,
  });
}
const city = [
  {
    type: 'rect',
    x: P2[0] - 300,
    y: P2[1] - 170,
    w: 600,
    h: 340,
    fill: 'bg',
    opacity: 0.85,
    at: 0,
    enter: 'fade',
    dur: 0.8,
  },
  ...grid,
  {
    type: 'path',
    d: `M ${P2[0] - 300} ${P2[1] + 60} C ${P2[0] - 150} ${P2[1] + 10} ${P2[0] - 40} ${P2[1] + 120} ${P2[0] + 90} ${P2[1] + 40} S ${P2[0] + 250} ${P2[1] - 60} ${P2[0] + 300} ${P2[1] - 20}`,
    stroke: 'accent2',
    width: 9,
    fill: 'none',
    opacity: 0.8,
    at: 0.3,
    enter: 'draw',
    dur: 1.2,
  },
  {
    type: 'text',
    text: 'A CITY',
    x: P2[0] - 240,
    y: P2[1] + 132,
    size: 8,
    font: 'mono',
    tracking: 0.3,
    fill: 'ink',
    at: 0.8,
    enter: 'type',
    exitAt: 60,
    exit: 'fade',
  },
];
// Scale 3: one building, one lit window (10× in again).
// A short street at night: three buildings with dark windows, a few dimly lit, and one
// window bright enough to be the one.
const windows = [];
const houses = [
  { x: P3[0] - 24, y: P3[1] - 4, w: 12, h: 12 },
  { x: P3[0] - 10.5, y: P3[1] - 8, w: 21, h: 16 },
  { x: P3[0] + 12, y: P3[1] - 5, w: 13, h: 13 },
];
houses.forEach((hs, n) => {
  const cols = Math.floor((hs.w - 1.5) / 2.3),
    rows = Math.floor((hs.h - 3) / 2.4);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const lit = n === 1 && row === 2 && col === 5,
        dim = !lit && rand() > 0.82;
      windows.push({
        type: 'rect',
        x: r(hs.x + 1.2 + col * 2.3),
        y: r(hs.y + 1.6 + row * 2.4),
        w: 1.1,
        h: 1.4,
        fill: lit || dim ? 'accent' : 'bg',
        opacity: lit ? 1 : dim ? 0.35 : 0.9,
        at: r(0.2 + (row * 8 + col) * 0.01),
        enter: 'fade',
        dur: 0.3,
        ...(lit ? { glow: { blur: 1.2 }, id: 'window' } : {}),
      });
    }
});
const street = [
  { type: 'rect', x: P3[0] - 30, y: P3[1] - 18, w: 60, h: 36, fill: 'bg', at: 0, enter: 'fade', dur: 0.6 },
  {
    type: 'rect',
    x: P3[0] - 30,
    y: P3[1] + 8,
    w: 60,
    h: 10,
    fill: 'surface',
    opacity: 0.5,
    at: 0,
    enter: 'fade',
    dur: 0.6,
  },
  ...houses.map(hs => ({
    type: 'rect',
    ...hs,
    fill: 'surface',
    stroke: 'muted',
    width: 0.12,
    at: 0.1,
    enter: 'fade',
    dur: 0.6,
  })),
  ...windows,
  {
    type: 'text',
    text: 'ONE WINDOW, STILL LIT',
    x: P3[0] - 10.5,
    y: P3[1] + 10.6,
    size: 0.9,
    font: 'mono',
    tracking: 0.3,
    fill: 'ink',
    at: 1.2,
    enter: 'type',
    exitAt: 60,
    exit: 'fade',
  },
];
const W = (id, vo, v, elements, extra = {}) => ({
  id,
  block: 'canvas',
  vo,
  ...extra,
  props: { world: 'zoom', view: v, elements },
});
const book = {
  order: 34,
  title: 'A zoom journey: one continuous camera from a planet down to a single lit window, then all the way back',
  audience: 'Stories about scale: one person in a system, one place in the world, one number in a population',
  inputs:
    'Four nested scales (the whole, a region, a place, one detail) and the line that connects the smallest to the largest',
  theme: 'cinema',
  motion: 'gentle',
  transition: 'cut',
  sfx: 'subtle',
  texture: { grain: 0.3, vignette: 0.5, animate: true },
  lens: { grade: 'teal-orange', gradeAmount: 0.5, bloom: 0.45, blur: 0.5 },
  note: 'One world at four scales, each ten times smaller than the last; the camera zooms at a constant pace in log space. Strokes and type are sized for the zoom they are seen at (a city line is under a unit wide). The planet is stylised: do not add real coastlines without verified geography.',
  beats: [
    W('planet', 'From out here, the planet looks calm.', view(0, 0, 52000), planet),
    W('coast', 'Come closer, and there is a coast,', view(P1[0] + 400, P1[1] + 200, 5200), coast, { hold: 0.4 }),
    W('city', 'a city that never quite sleeps,', view(P2[0], P2[1], 520), city, { hold: 0.4 }),
    W('window', 'and one window, still lit.', view(P3[0], P3[1] + 1, 52), street, { hold: 0.8 }),
    W(
      'whole',
      'Every story is that small, and that big.',
      view(0, 0, 52000),
      [
        {
          type: 'circle',
          cx: P3[0],
          cy: P3[1],
          r: 420,
          fill: 'none',
          stroke: 'accent',
          width: 90,
          glow: { blur: 200 },
          at: 1.6,
          enter: 'pop',
          dur: 0.5,
          loop: { type: 'pulse', period: 1.8, amount: 0.12 },
        },
      ],
      { hold: 0.8 },
    ),
    {
      id: 'end',
      block: 'endcard',
      vo: 'Start with one window.',
      props: { title: 'Start with one window.', align: 'center' },
    },
  ],
};
fs.writeFileSync('library/playbooks/zoom-journey.json', JSON.stringify(book, null, 2) + '\n');
