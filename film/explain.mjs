// Visual explanation primitives: canvas props that draw an idea as a picture that changes, computed
// exactly from a stated formula or a seeded simulation, and cued to the voice. Informed by the
// explanatory grammar of Manim (3b1b/manim, MIT) — value trackers on graphs, area as accumulation,
// vector fields — but written independently for ClearFrame's canvas; no Manim code is used here.
//
//   graph       an input moves through a function; a point rides the curve and both axes follow
//   accumulate  small amounts under a rate curve lift and stack into the total they make
//   estimate    noisy measurements arrive; their running average settles and its band narrows
//   field       a flow field: arrows show the push everywhere, particles follow it
//
// Each returns plain canvas elements (lines, paths, dots, type), so they combine with everything
// else a canvas beat draws, and `place` can make any of them a panel of a board.

const round = v => Math.round(v * 10) / 10;
const tall = frame => (frame.height ?? 1080) > (frame.width ?? 1920) * 1.1;
const cue = (c, fallback) => (c?.say != null ? { say: c.say } : { at: c?.at ?? fallback });
const num = (v, name) => {
  if (!Number.isFinite(v)) throw new Error(`${name} must be a number`);
  return v;
};

/** The function families a graph or a rate can follow: name → (params) → f(x). */
export const FUNCTIONS = {
  linear: ({ m = 1, b = 0 }) => x => m * x + b,
  // a·x^p; a domain where that is not a real number (a negative base, a fractional p) is refused.
  power: ({ a = 1, p = 2 }) => x => a * x ** p,
  exponential: ({ a = 1, k = 1 }) => x => a * Math.exp(k * x),
  logistic: ({ L = 1, k = 1, x0 = 0 }) => x => L / (1 + Math.exp(-k * (x - x0))),
  saturating: ({ L = 1, k = 1 }) => x => L * (1 - Math.exp(-k * x)),
  log: ({ a = 1, k = 1 }) => x => a * Math.log(1 + k * x),
  // An M/M/1 queue in steady state (random arrivals, one server, random service times) at
  // utilisation ρ = x, 0 ≤ ρ < 1: number in system ρ/(1−ρ) (waiting plus being served), number
  // waiting ρ²/(1−ρ), or time in system 1/(1−ρ) in units of the mean service time.
  queue: ({ measure = 'inSystem', a = 1 }) => {
    const g = { inSystem: r => r / (1 - r), waiting: r => (r * r) / (1 - r), time: r => 1 / (1 - r) }[measure];
    if (!g) throw new Error('queue.measure is inSystem, waiting or time');
    return x => (x >= 0 && x < 1 ? a * g(x) : NaN);
  },
  wave: ({ A = 1, period = 1, phase = 0 }) => x => A * Math.sin(2 * Math.PI * x / period + phase),
  bell: ({ mu = 0, sigma = 1 }) => x => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)),
  constant: ({ c = 1 }) => () => c,
};
function fnOf(spec, name) {
  if (typeof spec === 'number') return () => spec;
  const make = FUNCTIONS[spec?.kind];
  if (!make) throw new Error(`${name}.kind must be one of ${Object.keys(FUNCTIONS).join(', ')}`);
  return make(spec);
}

/** A plot area and the maps from data to frame pixels; y grows upward. */
function axesFor(frame, box, [x0, x1], [y0, y1]) {
  const T = tall(frame);
  const [bx, by, bw, bh] = box ?? (T ? [130, 520, 830, 900] : [260, 170, 1300, 720]);
  if (!(x1 > x0) || !(y1 > y0)) throw new Error('domains run from a smaller to a larger number');
  const X = x => round(bx + ((x - x0) / (x1 - x0)) * bw), Y = y => round(by + bh - ((y - y0) / (y1 - y0)) * bh);
  const fromX = px => x0 + ((px - bx) / bw) * (x1 - x0);
  return { bx, by, bw, bh, X, Y, fromX, size: T ? 40 : 34 };
}
/** A soft halo in the background colour, so a label reads over dots, bands and curves. */
const HALO = { dx: 0, dy: 0, blur: 6, opacity: 1, color: 'bg' };
function axisElements(A, { xLabel, yLabel, at = 0 }) {
  const { bx, by, bw, bh, size } = A, base = by + bh;
  return [
    { type: 'line', x1: bx, y1: base, x2: bx + bw + 30, y2: base, stroke: 'muted', width: 4, arrow: 'end', enter: 'draw', at, dur: 0.6 },
    { type: 'line', x1: bx, y1: base, x2: bx, y2: by - 30, stroke: 'muted', width: 4, arrow: 'end', enter: 'draw', at, dur: 0.6 },
    ...(xLabel ? [{ type: 'text', text: xLabel, x: bx + bw, y: base + size * 1.6, size, font: 'semibold', fill: 'muted', anchor: 'end', enter: 'fade', at: at + 0.3 }] : []),
    ...(yLabel ? [{ type: 'text', text: yLabel, x: bx + 18, y: by - 50, size, font: 'semibold', fill: 'muted', enter: 'fade', at: at + 0.3 }] : []),
  ];
}
const samples = (f, [a, b], n = 120) => Array.from({ length: n + 1 }, (_, i) => { const x = a + ((b - a) * i) / n; return [x, f(x)]; });
const pathOf = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
const autoDomain = ys => { const lo = Math.min(0, ...ys), hi = Math.max(...ys); const pad = (hi - lo || 1) * 0.08; return [lo, hi + pad]; };

/**
 * graph: {fn: {kind, …params}, x: {domain:[a,b], label}, y?: {domain, label}, box?,
 *   draw?: {say|at, dur}, sweep?: {from, to, say|at, dur}, marks?: [{x, label, say|at}]}
 */
export function graphElements(spec, frame) {
  const f = fnOf(spec.fn, 'graph.fn'), [x0, x1] = spec.x?.domain ?? [0, 1];
  num(x0, 'graph.x.domain'); num(x1, 'graph.x.domain');
  const pts = samples(f, [x0, x1]);
  if (pts.some(([, y]) => !Number.isFinite(y))) throw new Error(`graph.fn (${spec.fn?.kind}) is not a finite real number over x.domain ${x0}–${x1}${spec.fn?.kind === 'queue' ? ' (an M/M/1 queue needs 0 ≤ utilisation < 1)' : ''}`);
  const A = axesFor(frame, spec.box, [x0, x1], spec.y?.domain ?? autoDomain(pts.map(p => p[1])));
  const base = A.by + A.bh;
  const drawAt = cue(spec.draw, 0.5), drawDur = spec.draw?.dur ?? 1.4;
  const els = [
    ...axisElements(A, { xLabel: spec.x?.label, yLabel: spec.y?.label }),
    { type: 'path', d: pathOf(pts.map(([x, y]) => [A.X(x), A.Y(y)])), fill: 'none', stroke: 'accent', width: 8, cap: 'round', enter: 'draw', ...drawAt, dur: drawDur },
  ];
  if (spec.sweep) {
    // The input moves from `from` to `to`; the point, its drop to the x-axis, its line to the
    // y-axis and both axis markers follow it, keyed at 24 steps (straight between steps).
    const a = num(spec.sweep.from ?? x0, 'graph.sweep.from'), b = num(spec.sweep.to ?? x1, 'graph.sweep.to');
    const dur = spec.sweep.dur ?? 3, n = 22, start = cue(spec.sweep, (drawAt.at ?? 0) + drawDur + 0.4);
    const path = samples(f, [a, b], n).map(([x, y]) => [A.X(x), A.Y(y)]);
    const [px0, py0] = path[0], H = A.bh, W = A.bw;
    const keys = map => path.slice(1).map((p, i) => ({ ...(start.say != null ? { say: start.say, after: round(((i * dur) / n) * 100) / 100 } : { at: round((start.at + (i * dur) / n) * 100) / 100 }), dur: round((dur / n) * 100) / 100, ease: 'linear', ...map(p) }));
    const showAt = { ...start, ...(start.say != null ? { after: 0 } : {}) };
    els.push(
      // Drop to the x-axis and line to the y-axis: dashed guides that stretch with the point.
      { type: 'line', x1: px0, y1: base, x2: px0, y2: base - H, stroke: 'accent2', width: 4, dash: [10, 10], origin: [px0, base], enter: 'fade', ...showAt, dur: 0.3,
        keys: [{ ...showAt, dur: 0, scaleY: (base - py0) / H }, ...keys(([x, y]) => ({ x: x - px0, scaleY: (base - y) / H }))] },
      { type: 'line', x1: A.bx, y1: py0, x2: A.bx + W, y2: py0, stroke: 'accent2', width: 4, dash: [10, 10], origin: [A.bx, py0], enter: 'fade', ...showAt, dur: 0.3,
        keys: [{ ...showAt, dur: 0, scaleX: (px0 - A.bx) / W }, ...keys(([x, y]) => ({ y: y - py0, scaleX: (x - A.bx) / W }))] },
      { type: 'circle', cx: px0, cy: base, r: 12, fill: 'accent2', enter: 'pop', ...showAt, dur: 0.3, keys: keys(([x]) => ({ x: x - px0 })) },
      { type: 'circle', cx: A.bx, cy: py0, r: 12, fill: 'accent2', enter: 'pop', ...showAt, dur: 0.3, keys: keys(([, y]) => ({ y: y - py0 })) },
      { type: 'circle', cx: px0, cy: py0, r: 18, fill: 'accent2', stroke: 'bg', width: 5, enter: 'pop', ...showAt, dur: 0.3, keys: keys(([x, y]) => ({ x: x - px0, y: y - py0 })) },
    );
  }
  for (const m of spec.marks ?? []) {
    const x = num(m.x, 'graph.marks[].x'), px = A.X(x), py = A.Y(f(x)), c = cue(m, 1);
    // A mark in the right third labels towards the inside, so it stays in frame; the label rises
    // clear of the curve along its whole width (a nearly flat curve would run through it).
    const inward = px > A.bx + A.bw * 0.66;
    let ly = py - 26;
    if (m.label) {
      const w = m.label.length * A.size * 0.55, lx = inward ? px - 26 - w : px + 26;
      for (let i = 0; i <= 8; i++) {
        const v = f(A.fromX(lx + (i / 8) * w));
        if (Number.isFinite(v)) ly = Math.min(ly, A.Y(v) - 22);
      }
      ly = Math.max(ly, A.by + A.size);
    }
    els.push(
      { type: 'circle', cx: px, cy: py, r: 14, fill: 'ink', stroke: 'accent', width: 5, enter: 'pop', ...c, dur: 0.35 },
      ...(m.label ? [{ type: 'text', text: m.label, x: inward ? px - 26 : px + 26, y: ly, size: A.size, font: 'semibold', fill: 'ink', shadow: HALO, ...(inward ? { anchor: 'end' } : {}), enter: 'fade', ...c, dur: 0.4 }] : []),
    );
  }
  return els;
}

/**
 * accumulate: {rate: {kind, …} | number, x: {domain, label}, rateLabel?, totalLabel?, steps?: 4–24,
 *   box?, fill?: {say|at, dur}, stack?: {say|at, dur}}
 * The rate curve over its domain, cut into equal steps (each a small amount: midpoint rate × width),
 * which then lift and stack, in order, into a column whose height is their sum. The column is
 * normalised: its full height is the total, scaled to the plot's height, not read on the rate axis.
 */
export function accumulateElements(spec, frame) {
  const f = fnOf(spec.rate, 'accumulate.rate'), [x0, x1] = spec.x?.domain ?? [0, 1];
  const n = Math.max(4, Math.min(24, Math.round(spec.steps ?? 12)));
  const T = tall(frame), [W, H] = [frame.width ?? 1920, frame.height ?? 1080];
  const pts = samples(f, [x0, x1]);
  if (pts.some(([, y]) => !Number.isFinite(y) || y < 0)) throw new Error('accumulate.rate must be finite and not negative over x.domain');
  const box = spec.box ?? (T ? [120, 560, 540, 820] : [200, 200, 1080, 640]);
  const A = axesFor(frame, box, [x0, x1], autoDomain(pts.map(p => p[1])));
  const base = A.by + A.bh, dx = (x1 - x0) / n;
  // Steps with nothing in them add nothing: they are left out, and an all-zero rate stacks nothing.
  const rects = Array.from({ length: n }, (_, i) => { const xm = x0 + (i + 0.5) * dx; return { x: A.X(x0 + i * dx), w: A.X(x0 + (i + 1) * dx) - A.X(x0 + i * dx), h: base - A.Y(f(xm)) }; }).filter(r => r.h > 0.5);
  const total = rects.reduce((s, r) => s + r.h, 0);
  // The total column: as tall as the plot, to the right of it; each piece keeps its share.
  const colX = T ? A.bx + A.bw + 120 : A.bx + A.bw + 140, colW = T ? 110 : 150, k = A.bh / (total || 1);
  const fill = cue(spec.fill, 1.6), fillDur = spec.fill?.dur ?? 2;
  const stack = cue(spec.stack, (fill.at ?? 0) + fillDur + 0.8), stackDur = spec.stack?.dur ?? 2.4;
  // Each piece scales about its bottom-left corner, then moves so that corner sits on the pieces
  // already stacked: the column's height is the sum of the pieces, in their order and proportion.
  let below = 0;
  const pieces = rects.map((r, i) => {
    const prev = below, w = Math.max(2, r.w - 2);
    below += r.h;
    const step = stackDur / n, when = stack.say != null ? { say: stack.say, after: round(i * step * 100) / 100 } : { at: round((stack.at + i * step) * 100) / 100 };
    return {
      type: 'rect', x: r.x + 1, y: base - r.h, w, h: Math.max(1, r.h), fill: i % 2 ? 'accent' : 'accent2', opacity: 0.9, origin: [r.x + 1, base],
      enter: 'grow-y', dur: 0.3,
      keys: [{ ...when, dur: Math.max(0.35, step * 2), ease: 'smooth', x: round(colX - (r.x + 1)), y: round(-prev * k), scaleX: round((colW / w) * 1000) / 1000, scaleY: round(k * 1000) / 1000 }],
    };
  });
  return [
    ...axisElements(A, { xLabel: spec.x?.label, yLabel: spec.rateLabel }),
    { type: 'path', d: pathOf(pts.map(([x, y]) => [A.X(x), A.Y(y)])), fill: 'none', stroke: 'ink', width: 6, cap: 'round', enter: 'draw', at: 0.5, dur: 1 },
    { type: 'group', enter: 'none', ...fill, stagger: round((fillDur / n) * 100) / 100, children: pieces },
    { type: 'rect', x: colX - 6, y: A.by - 6, w: colW + 12, h: A.bh + 12, r: 10, fill: 'none', stroke: 'muted', width: 4, dash: [12, 10], enter: 'fade', ...fill, dur: 0.6 },
    ...(spec.totalLabel ? [{ type: 'text', text: spec.totalLabel, x: colX + colW / 2, y: A.by - 40, size: A.size, font: 'semibold', fill: 'ink', anchor: 'middle', fit: T ? 230 : 360, enter: 'fade', ...stack, dur: 0.5 }] : []),
  ].map(el => el);
}

/** A seeded normal sample (Box–Muller on a small LCG), so a simulation is the same every render. */
function normals(seed, n) {
  let s = (seed >>> 0) || 1;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  return Array.from({ length: n }, () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u()));
}

/**
 * estimate: {value?: 0, spread?: 1, bias?: 0, count?: 8–60, seed?, label?, meanLabel?, trueLabel?, box?,
 *   show?: {say|at, dur}, band?: true, gather?: {say|at, dur}}
 * Simulated measurements of one quantity (value + spread × standard normal, independent, seeded):
 * each arrives in order; the average so far is drawn as a line, with a band of ±1 standard error
 * (spread/√n, for these independent samples with a known spread) that narrows as n grows. It is not
 * a confidence guarantee, and more samples shrink only random error, never bias. On gather the same
 * dots slide into a dot histogram: the spread of outcomes. `bias` centres the samples that far from
 * the true value (in the value's units): the average settles just as calmly, in the wrong place.
 */
export function estimateElements(spec, frame) {
  const mu = spec.value ?? 0, sd = spec.spread ?? 1, bias = spec.bias ?? 0, n = Math.max(8, Math.min(60, Math.round(spec.count ?? 32)));
  num(mu, 'estimate.value'); num(bias, 'estimate.bias'); if (!(sd > 0)) throw new Error('estimate.spread must be above 0');
  // The samples' centre: the true value, unless the sampling is biased.
  const c = mu + bias, z = normals(spec.seed ?? 7, n), xs = z.map(v => c + sd * v);
  const means = xs.map((_, i) => xs.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
  const T = tall(frame), gather = spec.gather != null;
  const box = spec.box ?? (T ? (gather ? [110, 470, 600, 1000] : [130, 470, 830, 1000]) : gather ? [200, 200, 1080, 640] : [220, 200, 1480, 640]);
  const A = axesFor(frame, box, [0.5, n + 0.5], [Math.min(mu, c) - 3.2 * sd, Math.max(mu, c) + 3.2 * sd]);
  const show = cue(spec.show, 0.8), showDur = spec.show?.dur ?? 4;
  const els = [...axisElements(A, { xLabel: spec.label ?? 'Each measurement', yLabel: null })];
  // Labels are drawn last, over the dots.
  const labels = [];
  if (spec.trueLabel) {
    els.push({ type: 'line', x1: A.bx, y1: A.Y(mu), x2: A.bx + A.bw, y2: A.Y(mu), stroke: 'ink', width: 3, dash: [6, 12], opacity: 0.7, enter: 'draw', at: 0.4, dur: 0.8 });
    labels.push(
      // Under the line at the right end, where the band has narrowed (the average's label sits above);
      // above it when a biased average settles below.
      { type: 'text', text: spec.trueLabel, x: A.bx + A.bw - 10, y: bias < 0 ? A.Y(mu) - 26 : A.Y(mu) + A.size + 22, size: A.size, font: 'semibold', fill: 'ink', anchor: 'end', shadow: HALO, enter: 'fade', at: 0.6 });
  }
  if (spec.band !== false) {
    const up = means.map((m, i) => [A.X(i + 1), A.Y(m + sd / Math.sqrt(i + 1))]), down = means.map((m, i) => [A.X(i + 1), A.Y(m - sd / Math.sqrt(i + 1))]).reverse();
    els.push({ type: 'poly', points: [...up, ...down], closed: true, fill: 'accent', opacity: 0.18, enter: 'wipe', ...show, dur: showDur });
  }
  els.push({ type: 'path', d: pathOf(means.map((m, i) => [A.X(i + 1), A.Y(m)])), fill: 'none', stroke: 'accent', width: 7, cap: 'round', join: 'round', enter: 'wipe', ...show, dur: showDur });
  // Bins for the gathered histogram: to the right of the plot, one row per bin of width spread/2.
  // Bins sit beside the value axis on both frame shapes, so a dot keeps its height when it gathers.
  const binW = sd / 2, r = T ? 9 : 11, gap = 2 * r + 4;
  const hx = A.bx + A.bw + (T ? 40 : 120), counts = {};
  const dots = xs.map((v, i) => {
    const cx = A.X(i + 1), cy = A.Y(v);
    const bin = Math.round((v - c) / binW), k = (counts[bin] = (counts[bin] ?? 0) + 1) - 1;
    const tx = hx + 30 + k * gap, ty = A.Y(c + bin * binW);
    return { type: 'circle', cx, cy, r, fill: 'accent2', opacity: 0.9, enter: 'pop', dur: 0.2,
      ...(gather ? { keys: [{ ...cue(spec.gather, showDur + 2), ...(spec.gather.say != null ? { after: round(i * 0.025 * 100) / 100 } : {}), x: tx - cx, y: ty - cy, dur: spec.gather.dur ?? 1.2, ease: 'smooth' }] } : {}) };
  });
  els.push({ type: 'group', enter: 'none', ...show, stagger: round((showDur / n) * 100) / 100, children: dots });
  els.push(...labels);
  if (spec.meanLabel) els.push({ type: 'text', text: spec.meanLabel, x: A.X(n) - 10, y: A.Y(means.at(-1)) - 34, size: A.size, font: 'semibold', fill: 'accent', anchor: 'end', shadow: HALO, enter: 'fade', ...(show.say != null ? { say: show.say, after: showDur } : { at: show.at + showDur }), dur: 0.5 });
  els.push({ type: 'text', text: 'Simulated', x: A.bx + 20, y: A.by + 10, size: Math.round(A.size * 0.8), font: 'mono', fill: 'muted', enter: 'fade', at: 0.4 });
  return els;
}

/** The flow fields: name → (u, v) in [-1, 1]² → velocity. */
export const FIELDS = {
  drift: () => [1, 0],
  swirl: (u, v) => [-v, u],
  source: (u, v) => [u, v],
  sink: (u, v) => [-u, -v],
  saddle: (u, v) => [u, -v],
  // Downhill on the bowl u² + 3v²: steep across the valley, gentle along it (gradient descent).
  valley: (u, v) => [-2 * u, -6 * v],
};

/**
 * field: {kind, box?, arrows?: true, particles?: 6–40, seed?, show?: {say|at}, flow?: {say|at, dur},
 *   labels?: [{text, pos: [u, v], say|at}]}
 * Arrows on a grid show the push at every point (direction exact; length varies with relative strength); particles
 * follow streamlines numerically integrated with RK4 (sampled as polylines, so approximate), so
 * where things go is a consequence of the field. Each particle travels its streamline at a constant
 * pace over `dur`: the routes follow the field, the speeds do not (a sink's particles do not slow).
 * The kinds are textbook shapes chosen for a picture, not models fitted to a crowd or a market.
 */
export function fieldElements(spec, frame) {
  const F = FIELDS[spec.kind];
  if (!F) throw new Error(`field.kind must be one of ${Object.keys(FIELDS).join(', ')}`);
  const T = tall(frame), [bx, by, bw, bh] = spec.box ?? (T ? [90, 420, 900, 1240] : [180, 150, 1560, 780]);
  const P = (u, v) => [round(bx + ((u + 1) / 2) * bw), round(by + ((1 - v) / 2) * bh)];
  const aspect = bh / bw, els = [];
  const show = cue(spec.show, 0.3);
  if (spec.arrows !== false) {
    const cols = T ? 6 : 11, rows = Math.max(3, Math.round(cols * aspect)), arrows = [];
    let peak = 0;
    const grid = [];
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const u = -1 + (2 * (i + 0.5)) / cols, v = -1 + (2 * (j + 0.5)) / rows, [vu, vv] = F(u, v);
      grid.push([u, v, vu, vv]); peak = Math.max(peak, Math.hypot(vu, vv));
    }
    const cell = Math.min(bw / cols, bh / rows) * 0.42;
    for (const [u, v, vu, vv] of grid) {
      const m = Math.hypot(vu, vv) / (peak || 1), [x, y] = P(u, v);
      if (m < 0.04) continue;
      // The field's (u, v) map to the box's pixels at different scales: angle in screen space.
      const len = cell * (0.35 + 0.65 * m), ang = Math.atan2(-vv * bh, vu * bw);
      arrows.push({ type: 'line', x1: round(x - Math.cos(ang) * len / 2), y1: round(y - Math.sin(ang) * len / 2), x2: round(x + Math.cos(ang) * len / 2), y2: round(y + Math.sin(ang) * len / 2), stroke: 'muted', width: 3, arrow: 'end', head: 12, opacity: 0.4 + 0.5 * m, enter: 'fade', dur: 0.3 });
    }
    els.push({ type: 'group', enter: 'none', ...show, stagger: 0.01, children: arrows });
  }
  // Particles: seeded starts, streamlines by RK4 in field space, drawn as faint trails and ridden.
  const n = Math.max(6, Math.min(40, Math.round(spec.particles ?? 18)));
  let s = ((spec.seed ?? 3) >>> 0) || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const flow = cue(spec.flow, 1.2), dur = spec.flow?.dur ?? 4;
  for (let k = 0; k < n; k++) {
    let u = -0.95 + 1.9 * rnd(), v = -0.95 + 1.9 * rnd();
    if (spec.kind === 'drift') u = -0.98;
    const pts = [P(u, v)];
    const h = 0.02;
    for (let step = 0; step < 220; step++) {
      const k1 = F(u, v), k2 = F(u + (h / 2) * k1[0], v + (h / 2) * k1[1]), k3 = F(u + (h / 2) * k2[0], v + (h / 2) * k2[1]), k4 = F(u + h * k3[0], v + h * k3[1]);
      const du = (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), dv = (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      if (Math.hypot(du, dv) < 1e-4) break;
      u += du; v += dv;
      if (Math.abs(u) > 1 || Math.abs(v) > 1) break;
      if (step % 4 === 3) pts.push(P(u, v));
    }
    if (pts.length < 3) continue;
    const d = pathOf(pts);
    els.push(
      { type: 'path', d, fill: 'none', stroke: 'accent', width: 3, opacity: 0.35, cap: 'round', enter: 'draw', ...flow, dur },
      { type: 'circle', cx: pts[0][0], cy: pts[0][1], r: T ? 11 : 10, fill: 'accent2', enter: 'pop', ...flow, dur: 0.2, along: { d, ...flow, dur, ease: 'linear', loop: true } },
    );
  }
  for (const l of spec.labels ?? []) {
    const [x, y] = P(...(l.pos ?? [0, 0]));
    els.push({ type: 'text', text: l.text, x, y, size: T ? 40 : 34, font: 'semibold', fill: 'ink', anchor: 'middle', shadow: HALO, enter: 'fade', ...cue(l, 1) });
  }
  return els;
}

export const EXPLAIN = { graph: graphElements, accumulate: accumulateElements, estimate: estimateElements, field: fieldElements };
