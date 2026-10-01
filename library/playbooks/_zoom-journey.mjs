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

// ------------------------------------------------------------------ terrain
// One elevation field on the sphere decides land and sea at every scale, from orbit down to a
// street: the planet's coasts, the coastline the camera flies down to, and the ground the city
// is built on are all contours of the same function, so each scale really sits inside the last.
const R = 20000;

// ---- 3D value noise (seeded hash, smoothstep interpolation), fractal sum.
const hash = (x, y, z, s) => {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const fade = t => t * t * (3 - 2 * t);
function noise3(x, y, z, s) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = fade(x - xi),
    yf = fade(y - yi),
    zf = fade(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz, s);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), xf), l(c(0, 1, 0), c(1, 1, 0), xf), yf),
    l(l(c(0, 0, 1), c(1, 0, 1), xf), l(c(0, 1, 1), c(1, 1, 1), xf), yf),
    zf,
  );
}
function fbm(x, y, z, oct, s) {
  let a = 0,
    amp = 1,
    norm = 0;
  for (let i = 0; i < oct; i++) {
    a += amp * (noise3(x, y, z, s + i) - 0.5);
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
  }
  return a / norm;
}

// Continents where the story wants them (the target coast on the night side, east of centre).
const MASK = [
  [7000, -2400, 7600, 1.0],
  [2500, -9500, 4200, 0.8],
  [-9500, 7600, 5600, 0.95],
  [-4500, 11500, 3200, 0.7],
  [-7000, -11500, 3600, 0.8],
  [-15000, -2000, 2400, 0.6],
  [12500, 11000, 2600, 0.6],
];
const mask = (x, y) => MASK.reduce((m, [cx, cy, rr, k]) => Math.max(m, k * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (rr * rr))), 0);

/** Elevation at disc point (x, y): above 0 is land. `oct` trades detail for speed. */
function elevation(x, y, oct = 9) {
  const d2 = x * x + y * y;
  if (d2 >= R * R * 0.995) return -1;
  const z = Math.sqrt(R * R - d2);
  const f = 1 / 7000;
  // Domain warp gives coasts gulfs and peninsulas instead of blobs.
  const wx = fbm(x * f * 0.7, y * f * 0.7, z * f * 0.7, 4, 101) * 2.2,
    wy = fbm(x * f * 0.7 + 5.2, y * f * 0.7, z * f * 0.7, 4, 202) * 2.2;
  const n = fbm(x * f + wx, y * f + wy, z * f, oct, 7);
  return mask(x, y) * 0.95 - 0.5 + n * 2.1;
}

// ---- marching squares over a grid, stitched into closed loops (land on the left).
function contour(x0, y0, x1, y1, step, field, level = 0) {
  const nx = Math.ceil((x1 - x0) / step) + 1,
    ny = Math.ceil((y1 - y0) / step) + 1;
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const edge = i === 0 || j === 0 || i === nx - 1 || j === ny - 1;
      v[j * nx + i] = edge ? -1 : field(x0 + i * step, y0 + j * step) - level;
    }
  const P = (i, j) => [x0 + i * step, y0 + j * step];
  const val = (i, j) => v[j * nx + i];
  const lerpPt = (a, b, va, vb) => {
    const t = va / (va - vb);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };
  // Edge keys: top (i,j)-(i+1,j) = h i j; left (i,j)-(i,j+1) = v i j.
  const next = new Map(),
    pos = new Map();
  const seg = (ka, pa, kb, pb) => {
    pos.set(ka, pa);
    pos.set(kb, pb);
    next.set(ka, kb);
  };
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = val(i, j),
        b = val(i + 1, j),
        c = val(i + 1, j + 1),
        d = val(i, j + 1);
      const idx = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const T = [`h${i},${j}`, () => lerpPt(P(i, j), P(i + 1, j), a, b)],
        Rr = [`v${i + 1},${j}`, () => lerpPt(P(i + 1, j), P(i + 1, j + 1), b, c)],
        B = [`h${i},${j + 1}`, () => lerpPt(P(i, j + 1), P(i + 1, j + 1), d, c)],
        L = [`v${i},${j}`, () => lerpPt(P(i, j), P(i, j + 1), a, d)];
      // Segments run so land lies on the left (screen coordinates, y down).
      const S = (e1, e2) => seg(e1[0], e1[1](), e2[0], e2[1]());
      const centre = (a + b + c + d) / 4;
      switch (idx) {
        case 1: S(B, L); break;
        case 2: S(Rr, B); break;
        case 3: S(Rr, L); break;
        case 4: S(T, Rr); break;
        case 5: if (centre > 0) { S(T, L); S(B, Rr); } else { S(T, Rr); S(B, L); } break;
        case 6: S(T, B); break;
        case 7: S(T, L); break;
        case 8: S(L, T); break;
        case 9: S(B, T); break;
        case 10: if (centre > 0) { S(L, B); S(Rr, T); } else { S(L, T); S(Rr, B); } break;
        case 11: S(Rr, T); break;
        case 12: S(L, Rr); break;
        case 13: S(B, Rr); break;
        case 14: S(L, B); break;
      }
    }
  const loops = [],
    seen = new Set();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let k = start;
    while (k && !seen.has(k)) {
      seen.add(k);
      loop.push(pos.get(k));
      k = next.get(k);
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}

const area = loop => {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x1, y1] = loop[i],
      [x2, y2] = loop[(i + 1) % loop.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/** Ramer–Douglas–Peucker on a closed loop, tolerance by position. */
function simplify(loop, tol) {
  const keep = new Uint8Array(loop.length);
  const rdp = (a, b) => {
    const [ax, ay] = loop[a],
      [bx, by] = loop[b];
    const dx = bx - ax,
      dy = by - ay,
      l = Math.hypot(dx, dy) || 1;
    let best = -1,
      bd = 0;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((loop[i][0] - ax) * dy - (loop[i][1] - ay) * dx) / l;
      if (d > bd) (bd = d), (best = i);
    }
    if (best > 0 && bd > tol(loop[best])) {
      keep[best] = 1;
      rdp(a, best);
      rdp(best, b);
    }
  };
  const mid = Math.floor(loop.length / 2);
  keep[0] = keep[mid] = 1;
  rdp(0, mid);
  rdp(mid, loop.length - 1);
  keep[loop.length - 1] = 1;
  return loop.filter((_, i) => keep[i]);
}

const land = (p, oct = 9) => elevation(p[0], p[1], oct) > 0;
// The story's coast: walk west along a line on the night side until the land begins.
const mouth = (() => {
  for (let x = 17500; x > 6000; x -= 4) if (elevation(x, -3200) > 0) return [x, -3200];
  throw new Error('no coast on the night side');
})();
// Inland is up the elevation slope.
const inward = (() => {
  const e = 30,
    gx = elevation(mouth[0] + e, mouth[1]) - elevation(mouth[0] - e, mouth[1]),
    gy = elevation(mouth[0], mouth[1] + e) - elevation(mouth[0], mouth[1] - e),
    l = Math.hypot(gx, gy) || 1;
  return [gx / l, gy / l];
})();
const side = [-inward[1], inward[0]];
const P2 = [mouth[0] + inward[0] * 150, mouth[1] + inward[1] * 150];
// The river meanders inland from the mouth, and stops where the land does.
const riverPts = [];
for (let i = 0; i <= 50; i++) {
  const t = i / 50,
    d = -40 + 2400 * t ** 1.25,
    sw = Math.sin(t * 8) * 170 * t + Math.sin(t * 21) * 40 * t,
    p = [mouth[0] + inward[0] * d + side[0] * sw, mouth[1] + inward[1] * d + side[1] * sw];
  if (i > 2 && !land(p)) break;
  riverPts.push(p);
}
// The city's grid is turned to the coast; the window's street sits in it.
const ang = Math.atan2(inward[1], inward[0]),
  U = [Math.cos(ang), Math.sin(ang)],
  V = [-Math.sin(ang), Math.cos(ang)];
const at = (b, a) => [P2[0] + U[0] * b + V[0] * a, P2[1] + U[1] * b + V[1] * a];
const P3 = at(160, 40);
const onLand = p => land(p);
const nearRiver = (p, k) => riverPts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < k);

// The planet's coasts, contoured coarse but simplified finely near the story's coast; the
// higher ground in bands, like a relief map.
const near = p => Math.hypot(p[0] - P3[0], p[1] - P3[1]);
const tolAt = p => (near(p) < 7000 ? 8 : 34);
const planetLoops = level =>
  contour(-R, -R, R, R, 90, (x, y) => elevation(x, y, 8), level)
    .filter(l => Math.abs(area(l)) > 1.2e5)
    .map(l => ({ pts: simplify(l, tolAt), lake: area(l) > 0 }));
const coastsLoops = planetLoops(0),
  uplands = planetLoops(0.22),
  highlands = planetLoops(0.42),
  peaks = planetLoops(0.6);

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
  if (p[0] > 3500 + g() * 3000 && g() > 0.35 && elevation(p[0], p[1], 6) > 0.03) nightCities.push(p);
}

// ------------------------------------------------------------------ scale 0: the planet
// The sun is to the left; the night is the sphere's own shadow laid over sea and land alike.
const relief = (loops, fill, opacity) =>
  loops
    .filter(l => !l.lake)
    .map(l => ({ type: 'path', d: compact(l.pts), fill, opacity, stroke: 'none', at: 0, enter: 'none' }));
const lakes = loops => loops.filter(l => l.lake).map(l => ({ type: 'path', d: compact(l.pts), fill: 'accent2', opacity: 0.85, stroke: 'none', at: 0, enter: 'none' }));
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
  { type: 'circle', cx: 0, cy: 0, r: R, fill: { gradient: ['accent2', 'surface'], angle: 0 }, at: 0, enter: 'none' },
  // Shallow water: a thin pale band along every coast, inside the sea.
  ...coastsLoops
    .filter(l => !l.lake)
    .map(l => ({ type: 'path', d: compact(l.pts), fill: 'none', stroke: 'ink', width: 140, join: 'round', opacity: 0.1, at: 0, enter: 'none' })),
  // Land in elevation bands: green coastal plains, dry uplands, grey highlands, pale peaks.
  ...relief(coastsLoops, { gradient: ['positive', 'accent'], angle: 60 }, 0.78),
  ...relief(uplands, 'accent', 0.6),
  ...relief(highlands, 'muted', 0.7),
  ...relief(peaks, 'ink', 0.55),
  ...lakes(coastsLoops),
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
  // The night side: one disc shaded by a smooth gradient, opaque on the far side and fading to
  // nothing across the day side. With the sun side-on the terminator is a great circle seen
  // edge-on, a straight soft band, and the disc's edge is the planet's own, so nothing steps.
  {
    type: 'circle',
    cx: 0,
    cy: 0,
    r: R,
    fill: { gradient: ['bg', 'bg'], angle: 180, fade: true },
    stroke: 'none',
    opacity: 0.95,
    at: 0,
    enter: 'none',
  },
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
// The same field contoured finely around the story's coast: the coastline the camera flies
// down to, and the higher ground inland as faint relief lines.
const BOX = [P3[0] - 3300, P3[1] - 2000, P3[0] + 3300, P3[1] + 2000];
const openLines = (loops, step) =>
  loops.flatMap(l => {
    // Break each loop where it runs along the box edge (the grid's border is forced to sea).
    const edge = ([x, y]) => x < BOX[0] + step * 1.5 || x > BOX[2] - step * 1.5 || y < BOX[1] + step * 1.5 || y > BOX[3] - step * 1.5;
    const runs = [];
    let cur = [];
    for (const p of l) {
      if (edge(p)) {
        if (cur.length > 2) runs.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 2) runs.push(cur);
    return runs;
  });
const fineAt = level => contour(BOX[0], BOX[1], BOX[2], BOX[3], 8, (x, y) => elevation(x, y, 9), level);
const coastLines = openLines(fineAt(0), 8).map(l => simplify([...l, l.at(-1)], () => 1.5));
const reliefLines = [0.22, 0.42].flatMap(level => openLines(fineAt(level), 8).map(l => simplify([...l, l.at(-1)], () => 3)));
const lineD = pts => compact(pts, false);
const coast = [
  ...chunked(reliefLines.filter(l => l.length > 6).map(l => lineD(l) + ' '), { type: 'path', fill: 'none', stroke: 'muted', width: 5, opacity: 0.16, at: 0, enter: 'none' }),
  // Moonlight on the open sea.
  {
    type: 'ellipse',
    cx: r(P3[0] + 2200),
    cy: r(P3[1] - 600),
    rx: 1700,
    ry: 1000,
    fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
    opacity: 0.14,
    at: 0,
    enter: 'none',
  },
  // Surf along the shore, catching what light there is.
  ...chunked(coastLines.map(l => lineD(l) + ' '), {
    type: 'path',
    fill: 'none',
    stroke: 'accent2',
    width: 7,
    opacity: 0.6,
    join: 'round',
    glow: { blur: 22, opacity: 0.7 },
    at: 0,
    enter: 'none',
  }),
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
// The street dissolves in over the city plan as the camera arrives, and back out as it leaves:
// a handoff between scales, not a cut.
const away = { exitAt: 3.7, exitDur: 0.6, exit: 'fade' };
const street = [
  // A soft-edged backdrop: opaque where the camera looks, fading into the city around it.
  {
    type: 'ellipse',
    cx: wx,
    cy: wy,
    rx: 80,
    ry: 52,
    fill: { gradient: ['bg', 'bg', 'bg', 'bg'], radial: true, fade: true },
    at: 0.5,
    enter: 'fade',
    dur: 0.9,
    ...away,
  },
  { type: 'rect', x: wx - 30, y: wy - 18, w: 60, h: 34, fill: { gradient: ['bg', 'surface'], angle: 90 }, at: 0.5, enter: 'fade', dur: 0.9, ...away },
  ...houses.map(hs => ({
    type: 'rect',
    x: r(hs.x),
    y: r(hs.y),
    w: hs.w,
    h: hs.h + 10,
    fill: { gradient: [hs.tone, 'bg'], angle: 90 },
    opacity: 0.9,
    at: 0.5,
    enter: 'fade',
    dur: 0.9,
    ...away,
  })),
  ...houses.map(hs => ({ type: 'rect', x: r(hs.x - 0.4), y: r(hs.y - 0.6), w: hs.w + 0.8, h: 0.7, fill: 'bg', at: 0.5, enter: 'fade', dur: 0.9, ...away })),
  { type: 'group', at: 0.5, enter: 'fade', dur: 0.9, ...away, children: fac },
  { type: 'rect', x: wx - 30, y: wy + 12, w: 60, h: 6, fill: 'bg', opacity: 0.9, at: 0.5, enter: 'fade', dur: 0.9, ...away },
  { type: 'particles', x: wx - 28, y: wy - 16, w: 56, h: 30, kind: 'dust', count: 14, seed: 9, size: 0.12, fill: 'ink', opacity: 0.4, at: 0.6, enter: 'fade', dur: 0.8, ...away },
  {
    type: 'text',
    text: 'ONE WINDOW, STILL LIT',
    x: r(wx - 20.8),
    y: r(wy + 11.6),
    size: 1.08,
    font: 'semibold',
    tracking: 0.3,
    fill: 'ink',
    at: 1.2,
    enter: 'fade',
    dur: 0.4,
    exitAt: 3.4,
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
    // One unbroken push: each scale's move begins before the last one has settled (a negative
    // viewAt starts it in the outgoing shot), and the camera keeps creeping in while it holds.
    W('planet', 'From out here, the planet looks calm.', view(P3[0], P3[1], 52000), planet, { transition: 'cut' }, { viewFrom: view(1500, -800, 52000), viewAt: 0, viewDur: 2.4, viewDrift: 0.05 }),
    W('coast', 'Come closer, and there is a coast,', coastView(), coast, { hold: 0.6 }, { viewAt: -0.9, viewDur: 2.7, viewDrift: 0.08 }),
    W('city', 'a city that never quite sleeps,', cityView(), city, { hold: 0.6 }, { viewAt: -0.9, viewDur: 2.5, viewDrift: 0.08 }),
    W('window', 'and one window, still lit.', view(wx, wy + 1, 52), street, { hold: 1 }, { viewAt: -0.9, viewDur: 2.5, viewDrift: 0.06 }),
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
      { viewAt: -0.4, viewDur: 3, viewDrift: 0.04 },
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
