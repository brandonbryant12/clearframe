import { round, rng, smoothPath } from '../../fframes/sketch-kit.mjs';

// A transmission mast on a ridge at first light: a lattice tower against a sky warming from night
// to dawn, its beacon blinking, rings of signal rolling out from the tip over a valley filled with
// low cloud. The far ranges fade into the light; the near ridge is a black silhouette.
export default {
  name: 'mast',
  order: 12.5,
  summary:
    'A transmission mast on a ridge at dawn: a lattice tower, a blinking beacon and rings of signal rolling out over a valley of low cloud.',
  use: 'Reach and morning: "every morning after", a broadcast, a message carried over distance. A trailer montage beat or an ending.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 29),
      tallFrame = h > w,
      y0 = round(h * (tallFrame ? 0.58 : 0.64)),
      mx = round(w * (tallFrame ? 0.6 : 0.68)),
      ridgeY = round(h * (tallFrame ? 0.7 : 0.74)),
      mastH = round(h * (tallFrame ? 0.36 : 0.5)),
      tipY = round(ridgeY - mastH),
      base = round(Math.min(w, h) * 0.05);
    const range = (y, rough, n, off) => {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([-0.1 * w + (1.2 * w * i) / n, y - rough * h * (0.3 + 0.7 * rand())]);
      return `${smoothPath(pts)} L ${round(1.1 * w)} ${round(h * 1.1)} L ${round(-0.1 * w)} ${round(h * 1.1)} Z`;
    };
    // The near ridge rises to the mast's footing.
    const ridge = [];
    for (let i = 0; i <= 10; i++) {
      const x = -0.1 * w + (1.2 * w * i) / 10,
        k = Math.exp(-(((x - mx) / (w * 0.32)) ** 2));
      ridge.push([x, ridgeY + h * 0.14 * (1 - k) + (rand() - 0.5) * h * 0.02]);
    }
    // The lattice: legs taper to the tip; cross-bracing in panels; two antenna platforms.
    const legs = v => base * (1 - 0.88 * v);
    let lattice = `M ${round(mx - legs(0))} ${ridgeY} L ${round(mx - legs(1))} ${tipY} M ${round(mx + legs(0))} ${ridgeY} L ${round(mx + legs(1))} ${tipY}`;
    for (let v = 0, i = 0; v < 0.98; i++) {
      const v2 = Math.min(1, v + 0.045 + 0.03 * (1 - v));
      const [ya, yb] = [ridgeY - mastH * v, ridgeY - mastH * v2];
      lattice += ` M ${round(mx - legs(v))} ${round(ya)} L ${round(mx + legs(v2))} ${round(yb)} M ${round(mx + legs(v))} ${round(ya)} L ${round(mx - legs(v2))} ${round(yb)}`;
      v = v2;
    }
    for (const v of [0.62, 0.84])
      lattice += ` M ${round(mx - legs(v) - base * 0.5)} ${round(ridgeY - mastH * v)} L ${round(mx + legs(v) + base * 0.5)} ${round(ridgeY - mastH * v)}`;
    lattice += ` M ${mx} ${tipY} L ${mx} ${round(tipY - mastH * 0.08)}`;
    // Guy wires from two heights down to anchors on the slope.
    const guys = [0.45, 0.8]
      .flatMap(v => [-1, 1].map(side => [v, side]))
      .map(([v, side]) => `M ${round(mx + side * legs(v))} ${round(ridgeY - mastH * v)} L ${round(mx + side * mastH * (0.35 + 0.25 * v))} ${round(ridgeY + h * 0.02)}`)
      .join(' ');
    const tip = [mx, round(tipY - mastH * 0.08)];
    // Rings of signal: each grows from the tip and fades, one after another, all beat long.
    const rings = [0, 0.45, 0.9, 1.35].map(t => ({
      type: 'circle',
      cx: tip[0],
      cy: tip[1],
      // Drawn at full size and scaled up from the tip, so the stroke thickens as it travels.
      r: round(Math.min(w, h) * 0.42),
      fill: 'none',
      stroke: 'accent',
      width: 2.5,
      glow: { blur: 6, opacity: 0.6 },
      origin: tip,
      at: round(t),
      enter: 'fade',
      dur: 0.15,
      keys: [
        { at: round(t), scale: 0.06, opacity: 0.85, dur: 0 },
        { at: round(t), scale: 1, dur: 2.6, ease: 'out' },
        { at: round(t + 0.3), opacity: 0, dur: 2.3, ease: 'in' },
      ],
    }));
    // Low cloud filling the valley: long soft bands drifting at their own pace.
    const fog = [0, 1, 2, 3].map(i => ({
      type: 'ellipse',
      cx: round(w * (0.2 + 0.25 * i)),
      cy: round(y0 + h * (0.04 + 0.025 * i)),
      rx: round(w * 0.38),
      ry: round(h * 0.045),
      fill: { gradient: ['ink', 'ink'], radial: true, fade: true },
      opacity: 0.16,
      z: round(3 - i * 0.6),
      at: 0,
      enter: 'none',
      loop: { type: 'float', period: 16 + i * 5, amount: 18 },
    }));
    return {
      view: [0, round(-h * 0.04), w, h],
      viewFrom: [0, round(h * 0.03), w, h],
      viewDur: 7,
      elements: [
        // Dawn: night overhead to warm light at the horizon, and the glow where the sun will rise.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(-0.2 * h),
          w: round(1.2 * w),
          h: round(y0 + 0.3 * h),
          fill: { gradient: ['bg', 'surface', 'accent2', 'accent'], angle: 90 },
          at: 0,
          enter: 'none',
        },
        {
          type: 'ellipse',
          cx: round(w * 0.3),
          cy: y0,
          rx: round(w * 0.5),
          ry: round(h * 0.26),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.6,
          z: 12,
          at: 0,
          enter: 'none',
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h: round(h * 0.35),
          kind: 'stars',
          count: 50,
          seed: 7,
          size: 1.6,
          fill: 'ink',
          opacity: 0.45,
          z: 12,
          at: 0,
          enter: 'none',
        },
        // Far ranges take the sky's colour (atmospheric perspective).
        { type: 'path', d: range(y0, 0.05, 9), fill: 'accent2', opacity: 0.55, stroke: 'none', z: 6, at: 0, enter: 'none' },
        { type: 'path', d: range(y0 + h * 0.035, 0.06, 7), fill: 'surface', opacity: 0.9, stroke: 'none', z: 3, at: 0, enter: 'none' },
        ...fog,
        { type: 'group', at: 0, enter: 'none', children: rings },
        // The near ridge and the mast: one black silhouette.
        {
          type: 'path',
          d: `${smoothPath(ridge)} L ${round(1.1 * w)} ${round(h * 1.1)} L ${round(-0.1 * w)} ${round(h * 1.1)} Z`,
          fill: 'bg',
          stroke: 'none',
          at: 0,
          enter: 'none',
        },
        {
          type: 'path',
          d: lattice,
          fill: 'none',
          stroke: 'bg',
          width: round(Math.max(2, base * 0.07)),
          cap: 'round',
          at: 0,
          enter: 'none',
        },
        { type: 'path', d: guys, fill: 'none', stroke: 'bg', width: 1.2, opacity: 0.8, at: 0, enter: 'none' },
        // Rim light on the mast's sunward leg.
        {
          type: 'line',
          x1: round(mx - legs(0)),
          y1: ridgeY,
          x2: round(mx - legs(1)),
          y2: tipY,
          stroke: 'accent',
          width: 1.5,
          opacity: 0.5,
          at: 0,
          enter: 'none',
        },
        {
          type: 'circle',
          cx: tip[0],
          cy: tip[1],
          r: 6,
          fill: 'negative',
          glow: { blur: 16, opacity: 1 },
          at: 0,
          enter: 'none',
          loop: { type: 'blink', period: 1.6 },
        },
      ],
    };
  },
};
