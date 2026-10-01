// Generates zoom-journey.json (run from the repository root: node library/playbooks/_zoom-journey.mjs).
// One world at four scales, each ten times smaller: a planet at dusk, a stretch of its coast on
// the night side, the city at a river mouth on that coast, and one window in that city. Each
// scale is drawn where the last one said it was: the coast is the continent's own outline, which
// carries finer bays only where the camera will look; the city's lights are the specks seen from
// orbit; the window is in that city's street.
import fs from 'node:fs';
import { smoothPath, rng } from '../../fframes/sketch-kit.mjs';

const r = v => Math.round(v * 10) / 10;
const rand = rng(21);
const view = (cx, cy, w) => [r(cx - w / 2), r(cy - (w * 9) / 32), r(w), r((w * 9) / 16)];
const dot = ([x, y]) => `M${Math.round(x)} ${Math.round(y)}h.1`;
const dotF = ([x, y]) => `M${r(x)} ${r(y)}h.01`;
/** Long path data split into elements under the 12,000-character cap. */
const chunked = (parts, el) => {
  const out = [];
  let cur = '';
  for (const p of parts) {
    if (cur.length + p.length > 11500) {
      out.push({ ...el, d: cur });
      cur = '';
    }
    cur += p;
  }
  if (cur) out.push({ ...el, d: cur });
  return out;
};
const inside = (pt, poly) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const polyD = pts => `M ${pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L ')} Z`;

// Compact path data for long outlines: an absolute start, then integer relative steps.
const compact = (pts, close = true) => {
  const q = pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
  let d = `M${q[0][0]} ${q[0][1]}l`;
  for (let i = 1; i < q.length; i++) d += `${q[i][0] - q[i - 1][0]} ${q[i][1] - q[i - 1][1]} `;
  return d.trim() + (close ? 'z' : '');
};

// ------------------------------------------------------------------ continents
const R = 20000;
/**
 * A continent: radius by angle at many scales (bays and capes down to inlets a few pixels wide
 * from orbit), plus `fine(a)`, extra detail only where the camera will come close.
 */
const continent = (cx, cy, rad, wob, seed, fine = () => 0) => {
  const g = rng(seed),
    ph = Array.from({ length: 10 }, () => g() * Math.PI * 2);
  const radius = a =>
    rad *
      (1 +
        wob *
          (0.42 * Math.sin(2 * a + ph[0]) +
            0.26 * Math.sin(3 * a + ph[1]) +
            0.16 * Math.sin(7 * a + ph[2]) +
            0.1 * Math.sin(13 * a + ph[3]) +
            0.06 * Math.sin(23 * a + ph[4]) +
            0.035 * Math.sin(41 * a + ph[5])) +
        0.012 * Math.sin(67 * a + ph[7]) +
        0.005 * Math.sin(131 * a + ph[8]) +
        0.0025 * Math.sin(263 * a + ph[9])) +
    fine(a);
  const at = a => [cx + Math.cos(a) * radius(a), cy + Math.sin(a) * radius(a) * (0.82 + 0.12 * Math.sin(a + ph[6]))];
  return { at, cx, cy, rad };
};
const sample = (c, step) => {
  const pts = [];
  for (let a = -Math.PI; a < Math.PI; a += step(a)) pts.push(c.at(a));
  return pts;
};
// Where the story lands: an eastern coast, just past the terminator.
const A1 = -0.3,
  AC = A1 + 0.006;
const bump = (a, c, w) => Math.exp(-(((a - c) / w) ** 2));
// Each octave's height is a fraction of its wavelength, so the coast is rugged, not spiky.
const fineMain = a =>
  bump(a, A1, 0.2) * (320 * Math.sin(a * 40 + 1) + 110 * Math.sin(a * 140 + 2) + 45 * Math.sin(a * 330 + 0.5) + 18 * Math.sin(a * 760)) +
  bump(a, AC, 0.014) * (5 * Math.sin(a * 2900 + 1.4) + 2 * Math.sin(a * 7100 + 0.3));
const main = continent(4200, -2600, 8200, 0.42, 5, fineMain);
const others = [
  continent(-9600, 7600, 5000, 0.5, 8),
  continent(-7400, -11400, 2600, 0.55, 11),
  continent(12600, 8800, 1300, 0.5, 14),
  // An archipelago off the south continent and a chain of islands in the western ocean.
  ...[
    [-3600, 12600, 520],
    [-2500, 13600, 340],
    [-1500, 14300, 260],
    [-15800, -2400, 700],
    [-14900, -800, 420],
    [-15200, 700, 300],
    [-11800, -6600, 380],
    [9200, 13400, 460],
  ].map(([x, y, rr], i) => continent(x, y, rr, 0.55, 30 + i)),
];
const mainPts = sample(main, a => (Math.abs(a - AC) < 0.02 ? 0.00025 : Math.abs(a - A1) < 0.3 ? 0.0022 : 0.009));
const otherPts = others.map(c => sample(c, () => (c.rad > 2000 ? 0.011 : 0.05)));
const P1 = main.at(A1);
// The river mouth, the city just inland of it, and the street with the window.
const mouth = main.at(AC),
  inward = (() => {
    const [dx, dy] = [main.cx - mouth[0], main.cy - mouth[1]],
      l = Math.hypot(dx, dy);
    return [dx / l, dy / l];
  })(),
  side = [-inward[1], inward[0]];
const P2 = [mouth[0] + inward[0] * 150, mouth[1] + inward[1] * 150];
const riverPts = [];
for (let i = 0; i <= 50; i++) {
  const t = i / 50,
    d = -40 + 2600 * t ** 1.25,
    s = Math.sin(t * 8) * 170 * t + Math.sin(t * 21) * 40 * t;
  riverPts.push([mouth[0] + inward[0] * d + side[0] * s, mouth[1] + inward[1] * d + side[1] * s]);
}
// The city's grid is turned to the coast; the window's street sits in it.
const ang = Math.atan2(inward[1], inward[0]),
  U = [Math.cos(ang), Math.sin(ang)],
  V = [-Math.sin(ang), Math.cos(ang)];
const at = (b, a) => [P2[0] + U[0] * b + V[0] * a, P2[1] + U[1] * b + V[1] * a];
const P3 = at(160, 40);
const onLand = p => inside(p, mainPts);
const nearRiver = (p, k) => riverPts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < k);

// ------------------------------------------------------------------ lights
const g = rng(4);
// The target city and its roads, seen from orbit as specks.
const specks = [];
for (let i = 0; i < 520; i++) {
  const t = g() ** 1.7,
    d = 20 + 520 * t,
    a = g() * Math.PI * 2,
    p = [P2[0] + Math.cos(a) * d, P2[1] + Math.sin(a) * d * 0.8];
  if (onLand(p) && !nearRiver(p, 22)) specks.push(p);
}
const roads = [0.5, -0.7, 1.4].map(turn => {
  const pts = [];
  for (let k = 0; k <= 30; k++) {
    const d = 300 + k * 90,
      bend = Math.sin(k * 0.4 + turn) * 260;
    pts.push([
      P2[0] + (inward[0] * Math.cos(turn) - inward[1] * Math.sin(turn)) * d + side[0] * bend,
      P2[1] + (inward[1] * Math.cos(turn) + inward[0] * Math.sin(turn)) * d + side[1] * bend,
    ]);
  }
  return pts.filter(onLand);
});
roads.forEach(pts => pts.forEach(p => specks.push([p[0] + (g() - 0.5) * 60, p[1] + (g() - 0.5) * 60])));
// Other cities across the night side.
const nightCities = [];
for (let i = 0; i < 1100; i++) {
  const p = [-2000 + g() * 22000, -14000 + g() * 28000];
  if (Math.hypot(p[0], p[1]) > R * 0.97 || Math.hypot(p[0] - P2[0], p[1] - P2[1]) < 3200) continue;
  const land = onLand(p) || otherPts.some(o => inside(p, o));
  if (land && p[0] > 2500 + g() * 3000 && g() > 0.35) nightCities.push(p);
}

// ------------------------------------------------------------------ scale 0: the planet
// The sun is to the left. Night is painted into the sea and land themselves (no shadow disc over
// space): each continent's colours step from lit to dusk to night across it.
const lit = x => Math.max(0, Math.min(1, (9000 - x) / 16000));
// Sand only in full sun; grey stone into dusk; then the night.
const landTone = L => (L > 0.75 ? 'accent' : L > 0.35 ? 'muted' : 'surface');
const bbox = pts => {
  const xs = pts.map(p => p[0]);
  return [Math.min(...xs), Math.max(...xs)];
};
const landPaint = pts => {
  const [x0, x1] = bbox(pts);
  return { gradient: [0, 1, 2, 3].map(k => landTone(lit(x0 + ((x1 - x0) * k) / 3))), angle: 0 };
};
// Mountain spines: a jagged ridge, lit on its sunward face, shadowed behind.
const ridge = (pts, seed) => {
  const g2 = rng(seed),
    out = [];
  for (let i = 0; i < pts.length - 1; i++)
    for (let k = 0; k < 6; k++) {
      const t = k / 6,
        [x, y] = [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
      out.push([x + (g2() - 0.5) * 500, y + (g2() - 0.5) * 500]);
    }
  out.push(pts.at(-1));
  return out;
};
const spines = [
  ridge([[-1800, -6400], [-400, -3200], [600, 400], [1400, 2600]], 3),
  ridge([[-12600, 4600], [-10600, 7200], [-8200, 10400]], 4),
  ridge([[-8400, -12600], [-6600, -10600]], 5),
];
const planet = [
  {
    type: 'particles',
    x: -60000,
    y: -32000,
    w: 124000,
    h: 76000,
    kind: 'stars',
    count: 260,
    seed: 2,
    fill: 'ink',
    opacity: 0.7,
    size: 40,
    at: 0,
    enter: 'none',
  },
  // The atmosphere's glow, strongest toward the sun on the left.
  {
    type: 'circle',
    cx: -1800,
    cy: 0,
    r: R + 3400,
    fill: { gradient: ['accent2', 'accent2', 'bg'], radial: true, fade: true },
    opacity: 0.3,
    at: 0,
    enter: 'none',
  },
  // Ocean: sunlit teal on the left, deeper toward the far side.
  { type: 'circle', cx: 0, cy: 0, r: R, fill: { gradient: ['accent2', 'surface', 'surface'], angle: 0 }, at: 0, enter: 'none' },
  // Shallow water over the shelves, lit only where the sun is.
  ...[mainPts, ...otherPts].map(pts => {
    const [x0, x1] = bbox(pts);
    return {
      type: 'path',
      d: compact(pts.filter((_, i) => i % 2 === 0)),
      fill: 'none',
      stroke: 'accent2',
      width: 900,
      join: 'round',
      opacity: 0.13,
      at: 0,
      enter: 'none',
    };
  }),
  // Land: sand and stone in the sun, fading through dusk into night.
  ...[mainPts, ...otherPts].map(pts => ({ type: 'path', d: compact(pts), fill: landPaint(pts), opacity: 0.62, stroke: 'none', at: 0, enter: 'none' })),
  // Green lowlands and pale desert on the sunlit south continent.
  ...[
    [-8600, 8800, 2600, 1500, 'positive', 0.2],
    [-11200, 6200, 1900, 1100, 'ink', 0.12],
    [-5600, -900, 1800, 1300, 'positive', 0.12],
  ].map(([cx, cy, rx, ry, fill, opacity]) => ({
    type: 'ellipse',
    cx,
    cy,
    rx,
    ry,
    fill: { gradient: [fill, fill], radial: true, fade: true },
    opacity,
    at: 0,
    enter: 'none',
  })),
  // Mountain ranges: the sunward face catches the light, the far face falls into shadow.
  ...spines.flatMap(pts => [
    { type: 'path', d: compact(pts.map(([x, y]) => [x + 260, y + 140]), false), fill: 'none', stroke: 'bg', width: 560, join: 'round', cap: 'round', opacity: 0.16, at: 0, enter: 'none' },
    { type: 'path', d: compact(pts, false), fill: 'none', stroke: 'ink', width: 380, join: 'round', cap: 'round', opacity: 0.1, at: 0, enter: 'none' },
    { type: 'path', d: compact(pts, false), fill: 'none', stroke: 'ink', width: 90, join: 'round', cap: 'round', opacity: 0.12, at: 0, enter: 'none' },
  ]),
  // Weather: soft clusters of cloud drifting over the day side.
  ...[
    [-7000, 3000, 1.0],
    [-13500, -4800, 0.8],
    [-3000, 12800, 1.1],
    [-11500, 9800, 0.7],
    [-4500, -12500, 0.8],
  ].flatMap(([x, y, k], i) =>
    [
      [0, 0, 3200, 1100],
      [1900, 500, 2200, 900],
      [-1800, 400, 1900, 800],
      [700, -600, 1500, 700],
    ].map(([dx, dy, rx, ry]) => ({
      type: 'ellipse',
      cx: r(x + dx * k),
      cy: r(y + dy * k),
      rx: r(rx * k),
      ry: r(ry * k),
      rotate: -12 + i * 7,
      origin: [x, y],
      fill: { gradient: ['ink', 'ink'], radial: true, fade: true },
      opacity: 0.2,
      at: 0,
      enter: 'none',
      loop: { type: 'float', period: 22 + i * 5, amount: 220 },
    })),
  ),
  // Night: the sphere's own shadow, a curved terminator softened by overlapping lunes (each one
  // a half disc closed by an elliptical arc), darkest at the far limb.
  ...Array.from({ length: 12 }, (_, i) => -0.7 + i * 0.1).map(k => ({
    type: 'path',
    d: `M 0 ${-R} A ${R} ${R} 0 0 1 0 ${R} A ${r(Math.max(1, Math.abs(k) * R))} ${R} 0 0 ${k > 0 ? 1 : 0} 0 ${-R} Z`,
    fill: 'bg',
    stroke: 'none',
    opacity: 0.1,
    at: 0,
    enter: 'none',
  })),
  // The atmosphere rings the whole disc, faint on the night side, so the sphere never ends at the
  // terminator.
  { type: 'circle', cx: 0, cy: 0, r: R + 60, fill: 'none', stroke: 'accent2', width: 120, opacity: 0.22, glow: { blur: 160, opacity: 0.7 }, at: 0, enter: 'none' },
  // City lights on the night side.
  ...chunked(nightCities.map(dot), {
    type: 'path',
    fill: 'none',
    stroke: 'accent',
    width: 46,
    cap: 'round',
    opacity: 0.75,
    glow: { blur: 90, opacity: 0.8 },
    at: 0,
    enter: 'none',
  }),
  ...chunked(specks.map(dot), {
    type: 'path',
    fill: 'none',
    stroke: 'accent',
    width: 10,
    cap: 'round',
    opacity: 0.95,
    glow: { blur: 30, opacity: 0.9 },
    at: 0,
    enter: 'none',
  }),
  // The city the camera is headed for: a warm smudge on the dark coast.
  {
    type: 'ellipse',
    cx: r(P2[0]),
    cy: r(P2[1]),
    rx: 620,
    ry: 500,
    fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
    opacity: 0.5,
    at: 0,
    enter: 'none',
    loop: { type: 'pulse', period: 3, amount: 0.08 },
  },
  // The sunlit limb.
  {
    type: 'path',
    d: `M ${r(R * 0.26)} ${r(-R * 0.96)} A ${R - 80} ${R - 80} 0 1 0 ${r(R * 0.26)} ${r(R * 0.96)}`,
    fill: 'none',
    stroke: 'accent2',
    width: 240,
    cap: 'round',
    opacity: 0.75,
    glow: { blur: 400, opacity: 0.9 },
    at: 0,
    enter: 'none',
  },
  {
    type: 'ellipse',
    cx: -12000,
    cy: -6000,
    rx: 5200,
    ry: 3400,
    rotate: 30,
    origin: [-12000, -6000],
    fill: { gradient: ['ink', 'ink'], radial: true, fade: true },
    opacity: 0.14,
    blend: 'screen',
    at: 0,
    enter: 'none',
  },
];

// ------------------------------------------------------------------ scale 1: the coast
const coastLine = mainPts.filter((p, i) => {
  const d = Math.hypot(p[0] - P1[0], p[1] - P1[1]);
  return d < 6000 && (Math.hypot(p[0] - P2[0], p[1] - P2[1]) < 700 ? i % 2 === 0 : i % 4 === 0);
});
const lineD = pts => `M ${pts.map(([x, y]) => `${r(x)} ${r(y)}`).join(' L ')}`;
// Inland relief: faint contour rings round a few hills, the way the land reads at night.
const hills = [
  [P1[0] - 1900, P1[1] - 700, 620],
  [P1[0] - 2600, P1[1] + 900, 820],
  [P1[0] - 900, P1[1] + 1700, 480],
].flatMap(([cx, cy, rad]) =>
  [1, 0.72, 0.46, 0.22].map(k => {
    const pts = Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2,
        w = 1 + 0.18 * Math.sin(3 * a + cx) + 0.1 * Math.sin(5 * a + cy);
      return [cx + Math.cos(a) * rad * k * w, cy + Math.sin(a) * rad * k * w * 0.7];
    });
    return `${smoothPath([...pts, pts[0], pts[1]])}`;
  }),
);
const coast = [
  ...chunked(hills.map(d => d + ' '), { type: 'path', fill: 'none', stroke: 'muted', width: 6, opacity: 0.16, at: 0, enter: 'fade', dur: 0.8 }),
  // Moonlight on the open sea.
  {
    type: 'ellipse',
    cx: r(P1[0] + 1500),
    cy: r(P1[1] - 300),
    rx: 1700,
    ry: 1000,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.14,
    at: 0,
    enter: 'fade',
    dur: 0.8,
  },
  // Surf along the shore, catching what light there is.
  {
    type: 'path',
    d: lineD(coastLine),
    fill: 'none',
    stroke: 'accent2',
    width: 9,
    opacity: 0.55,
    glow: { blur: 30, opacity: 0.7 },
    at: 0.1,
    enter: 'draw',
    dur: 1.6,
  },
  // The river, catching a little moonlight on its way to the sea.
  { type: 'path', d: smoothPath(riverPts), fill: 'none', stroke: 'surface', width: 22, cap: 'round', opacity: 0.9, at: 0.2, enter: 'draw', dur: 1.2 },
  { type: 'path', d: smoothPath(riverPts), fill: 'none', stroke: 'accent2', width: 4, cap: 'round', opacity: 0.4, at: 0.3, enter: 'draw', dur: 1.2 },
];
// Every zoom view is centred on the window (P3, below), so a tenfold move keeps it fixed in frame.
const coastView = () => view(P3[0], P3[1], 5200);
coast.push(
  {
    type: 'text',
    text: 'THE COAST',
    x: r(coastView()[0] + coastView()[2] * 0.1),
    y: r(coastView()[1] + coastView()[3] * 0.86),
    size: 108,
    font: 'semibold',
    tracking: 0.3,
    fill: 'ink',
    at: 0.4,
    enter: 'fade',
    dur: 0.4,
    exitAt: 3.4,
    exit: 'fade',
  },
  { type: 'rect', x: r(coastView()[0] + coastView()[2] * 0.1), y: r(coastView()[1] + coastView()[3] * 0.86 + 50), w: 360, h: 10, fill: 'accent2', at: 0.6, enter: 'grow-x', dur: 0.5, exitAt: 3.4, exit: 'fade' },
);

// ------------------------------------------------------------------ scale 2: the city
const streets = [],
  majors = [],
  lamps = [],
  windows = [];
const ok = p => onLand(p) && !nearRiver(p, 26) && Math.hypot(p[0] - P2[0], p[1] - P2[1]) < 520;
// Parks: a few blocks with no streets through them.
const park = (b, a) => {
  const k = Math.sin(Math.floor(b / 60) * 12.9898 + Math.floor(a / 72) * 78.233) * 43758.5;
  return k - Math.floor(k) < 0.1;
};
for (let a = -408; a <= 408; a += 24)
  for (let b = -120; b <= 520; b += 6) {
    const p = at(b, a),
      q = at(b + 6, a),
      major = Math.round(a / 24) % 4 === 0;
    if (ok(p) && ok(q) && (major || !park(b, a))) {
      (major ? majors : streets).push(`M ${r(p[0])} ${r(p[1])} L ${r(q[0])} ${r(q[1])}`);
      if (Math.round(b) % 18 === 0) lamps.push(p);
    }
  }
for (let b = -120; b <= 520; b += 20)
  for (let a = -408; a <= 408; a += 6) {
    const p = at(b, a),
      q = at(b, a + 6),
      major = Math.round(b / 20) % 3 === 0;
    if (ok(p) && ok(q) && (major || !park(b, a))) (major ? majors : streets).push(`M ${r(p[0])} ${r(p[1])} L ${r(q[0])} ${r(q[1])}`);
  }
// A boulevard cutting across the grid on the diagonal.
for (let k = -60; k < 60; k++) {
  const p = at(80 + k * 5, k * 5),
    q = at(85 + k * 5, k * 5 + 5);
  if (ok(p) && ok(q)) majors.push(`M ${r(p[0])} ${r(p[1])} L ${r(q[0])} ${r(q[1])}`);
}
for (let i = 0; i < 900; i++) {
  const p = at(-120 + g() * 640, -400 + g() * 800);
  if (ok(p)) windows.push(p);
}
const cityView = () => view(P3[0], P3[1], 520);
const city = [
  // The city's ground at night, dark enough for its lights.
  {
    type: 'ellipse',
    cx: r(P2[0] + U[0] * 120),
    cy: r(P2[1] + U[1] * 120),
    rx: 1150,
    ry: 900,
    rotate: r((ang * 180) / Math.PI),
    origin: [r(P2[0] + U[0] * 120), r(P2[1] + U[1] * 120)],
    fill: { gradient: ['bg', 'bg', 'bg'], radial: true, fade: true },
    opacity: 0.8,
    at: 0,
    enter: 'fade',
    dur: 0.6,
  },
  { type: 'path', d: smoothPath(riverPts.slice(0, 16)), fill: 'none', stroke: 'bg', width: 34, cap: 'round', at: 0, enter: 'fade', dur: 0.4 },
  ...chunked(windows.map(dotF), { type: 'path', fill: 'none', stroke: 'accent', width: 1.6, cap: 'round', opacity: 0.45, at: 0.3, enter: 'fade', dur: 0.8 }),
  ...chunked(streets, {
    type: 'path',
    fill: 'none',
    stroke: 'accent',
    width: 1,
    cap: 'round',
    opacity: 0.5,
    at: 0.2,
    enter: 'fade',
    dur: 0.8,
  }),
  ...chunked(majors, {
    type: 'path',
    fill: 'none',
    stroke: 'accent',
    width: 2,
    cap: 'round',
    opacity: 0.95,
    glow: { blur: 4, opacity: 0.9 },
    at: 0.1,
    enter: 'fade',
    dur: 0.7,
  }),
  ...chunked(lamps.map(dotF), { type: 'path', fill: 'none', stroke: 'ink', width: 3, cap: 'round', opacity: 0.9, at: 0.5, enter: 'fade', dur: 0.6 }),
  // Cars along the river road, and the city's light broken on the water.
  {
    type: 'path',
    d: smoothPath(riverPts.slice(0, 16).map(([x, y]) => [x + side[0] * 24, y + side[1] * 24])),
    fill: 'none',
    stroke: 'ink',
    width: 2.4,
    dash: [3, 12],
    cap: 'round',
    glow: { blur: 3, opacity: 0.9 },
    at: 0.3,
    enter: 'fade',
    dur: 0.5,
    loop: { type: 'dash', period: 1.4 },
  },
  {
    type: 'ellipse',
    cx: r(cityView()[0] + cityView()[2] * 0.1 + 80),
    cy: r(cityView()[1] + cityView()[3] * 0.86 - 6),
    rx: 150,
    ry: 46,
    fill: { gradient: ['bg', 'bg', 'bg'], radial: true, fade: true },
    opacity: 0.92,
    at: 0.3,
    enter: 'fade',
    dur: 0.4,
    exitAt: 3,
    exit: 'fade',
  },
  {
    type: 'text',
    text: 'THE CITY',
    x: r(cityView()[0] + cityView()[2] * 0.1),
    y: r(cityView()[1] + cityView()[3] * 0.86),
    size: 10.8,
    font: 'semibold',
    tracking: 0.3,
    fill: 'ink',
    at: 0.4,
    enter: 'fade',
    dur: 0.4,
    exitAt: 3,
    exit: 'fade',
  },
];

// ------------------------------------------------------------------ scale 3: one window
// The camera drops to a street front: three buildings at night, one window lit, a lamp and a
// plant on the sill.

const [wx, wy] = P3;
const fac = [];
const houses = [
  { x: wx - 26, y: wy - 9, w: 15, h: 26, tone: 'surface' },
  { x: wx - 10.5, y: wy - 13, w: 21, h: 30, tone: 'muted' },
  { x: wx + 11.5, y: wy - 7, w: 15, h: 24, tone: 'surface' },
];
houses.forEach((hs, n) => {
  const cols = Math.floor((hs.w - 2) / 3.2),
    rows = Math.floor((hs.h - 4) / 4);
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const lit = n === 1 && row === 2 && col === 2,
        dim = !lit && rand() > 0.86;
      const x = hs.x + 1.6 + col * 3.2 + (hs.w - 2 - cols * 3.2) / 2,
        y = hs.y + 2.4 + row * 4;
      fac.push({
        type: 'rect',
        x: r(x),
        y: r(y),
        w: 1.8,
        h: 2.4,
        fill: lit || dim ? 'accent' : 'bg',
        opacity: lit ? 1 : dim ? 0.35 : 0.85,
        stroke: 'line',
        width: 0.12,
        ...(lit ? { id: 'window', glow: { blur: 1.4, opacity: 1 } } : {}),
      });
      if (lit)
        fac.push(
          { type: 'rect', x: r(x + 0.15), y: r(y + 0.2), w: 0.5, h: 2, fill: 'ink', opacity: 0.35 },
          { type: 'circle', cx: r(x + 1.25), cy: r(y + 1.3), r: 0.28, fill: 'ink', glow: { blur: 0.6, opacity: 1 } },
          { type: 'rect', x: r(x + 1.1), y: r(y + 1.55), w: 0.3, h: 0.7, fill: 'bg', opacity: 0.8 },
          { type: 'ellipse', cx: r(x + 0.55), cy: r(y + 2.05), rx: 0.42, ry: 0.32, fill: 'bg', opacity: 0.85 },
          { type: 'ellipse', cx: r(x + 0.9), cy: r(y + 3.4), rx: 2.2, ry: 0.8, fill: { gradient: ['accent', 'accent'], radial: true, fade: true }, opacity: 0.45 },
        );
    }
});
const street = [
  // A soft-edged backdrop: opaque where the camera looks, fading into the city around it.
  {
    type: 'ellipse',
    cx: wx,
    cy: wy,
    rx: 80,
    ry: 52,
    fill: { gradient: ['bg', 'bg', 'bg', 'bg'], radial: true, fade: true },
    at: 0,
    enter: 'fade',
    dur: 0.25,
  },
  { type: 'rect', x: wx - 30, y: wy - 18, w: 60, h: 34, fill: { gradient: ['bg', 'surface'], angle: 90 }, at: 0, enter: 'fade', dur: 0.3 },
  ...houses.map(hs => ({
    type: 'rect',
    x: r(hs.x),
    y: r(hs.y),
    w: hs.w,
    h: hs.h + 10,
    fill: { gradient: [hs.tone, 'bg'], angle: 90 },
    opacity: 0.9,
    at: 0,
    enter: 'fade',
    dur: 0.3,
  })),
  ...houses.map(hs => ({ type: 'rect', x: r(hs.x - 0.4), y: r(hs.y - 0.6), w: hs.w + 0.8, h: 0.7, fill: 'bg', at: 0, enter: 'fade', dur: 0.3 })),
  { type: 'group', at: 0, enter: 'fade', dur: 0.3, children: fac },
  { type: 'rect', x: wx - 30, y: wy + 12, w: 60, h: 6, fill: 'bg', opacity: 0.9, at: 0, enter: 'fade', dur: 0.3 },
  { type: 'particles', x: wx - 28, y: wy - 16, w: 56, h: 30, kind: 'dust', count: 14, seed: 9, size: 0.12, fill: 'ink', opacity: 0.4, at: 0.4, enter: 'fade', dur: 0.6 },
  {
    type: 'text',
    text: 'ONE WINDOW, STILL LIT',
    x: r(wx - 20.8),
    y: r(wy + 11.6),
    size: 1.08,
    font: 'semibold',
    tracking: 0.3,
    fill: 'ink',
    at: 0.6,
    enter: 'fade',
    dur: 0.4,
    exitAt: 3.6,
    exit: 'fade',
  },
];

const W = (id, vo, v, elements, extra = {}, props = {}) => ({
  id,
  block: 'canvas',
  vo,
  ...extra,
  props: { world: 'zoom', view: v, elements, ...props },
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
  // No shutter blur: a tenfold zoom smeared by motion blur reads as mush, not a camera move.
  lens: { grade: 'teal-orange', gradeAmount: 0.5, bloom: 0.45, blur: 0 },
  note: "One world at four scales, each ten times smaller than the last; the camera zooms at a constant pace in log space. Each scale is drawn inside the one before (library/playbooks/_zoom-journey.mjs): the coast is the continent's own outline, carrying finer bays only where the camera goes; the city's lights are the specks seen from orbit. Strokes and type are sized for the zoom they are seen at. The planet is stylised: do not add real coastlines without verified geography.",
  beats: [
    W('planet', 'From out here, the planet looks calm.', view(P3[0], P3[1], 52000), planet, { transition: 'cut' }, { viewFrom: view(1500, -800, 52000), viewAt: 0, viewDur: 2.4 }),
    W('coast', 'Come closer, and there is a coast,', coastView(), coast, { hold: 0.8 }, { viewAt: 0, viewDur: 2.2 }),
    W('city', 'a city that never quite sleeps,', cityView(), city, { hold: 0.8 }, { viewAt: 0, viewDur: 2.2 }),
    W('window', 'and one window, still lit.', view(wx, wy + 1, 52), street, { hold: 1 }, { viewAt: 0, viewDur: 2.2 }),
    W(
      'whole',
      'Every story is that small, and that big.',
      view(P3[0], P3[1], 52000),
      [
        {
          type: 'circle',
          cx: r(P3[0]),
          cy: r(P3[1]),
          r: 1300,
          fill: 'none',
          stroke: 'accent',
          width: 150,
          glow: { blur: 260 },
          at: 2.2,
          enter: 'pop',
          dur: 0.5,
          loop: { type: 'pulse', period: 1.8, amount: 0.12 },
        },
      ],
      { hold: 0.8 },
      { viewAt: 0, viewDur: 3 },
    ),
    // Further back still: the whole planet in the dark, and the line to take away.
    W(
      'end',
      'Start with one window.',
      view(0, 5500, 96000),
      [
        {
          type: 'text',
          text: 'Start with one window.',
          x: 0,
          y: 23000,
          size: 3600,
          font: 'semibold',
          anchor: 'middle',
          fill: 'ink',
          at: 1.4,
          enter: 'rise',
          dur: 0.8,
        },
      ],
      { hold: 0.8 },
      { viewAt: 0, viewDur: 3 },
    ),
  ],
};
fs.writeFileSync('library/playbooks/zoom-journey.json', JSON.stringify(book, null, 2) + '\n');
