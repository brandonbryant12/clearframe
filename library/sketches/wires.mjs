import { round, rng } from '../../fframes/sketch-kit.mjs';

// Power lines at dusk in one-point perspective: lattice pylons march from the near left to the
// last light on the horizon, their wires sagging between them, and pulses of light race down the
// wires toward the camera, growing as they come. A tree line and fog sit on the horizon; tall
// grass close to the lens frames the bottom of the shot.
export default {
  name: 'wires',
  order: 10.5,
  summary:
    'Power lines at dusk: pylons marching to a glowing horizon in perspective, pulses of light racing down the wires toward the camera.',
  use: 'Connection, energy, a message spreading, "it moves through every wire": a trailer montage beat or the turn in an explainer about networks.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 17),
      tallFrame = h > w,
      // A tall frame looks up from the foot of the line: the near pylons tower out of the top
      // of the frame and the wires sweep down through the whole height to the horizon.
      y0 = round(h * (tallFrame ? 0.8 : 0.6)),
      vx = round(w * (tallFrame ? 0.8 : 0.7)),
      f = tallFrame ? w * 0.62 : Math.min(w, h) * 0.24,
      X = -(tallFrame ? 3.4 : 9),
      Hc = 3,
      P = 8.5;
    // Project a point on the pylon line: lateral offset u (units), height v (units), depth d.
    const at = (u, v, d) => [vx + (f * (X + u)) / d, y0 + (f * (Hc - v)) / d];
    const depths = [];
    for (let d = 1.7; d < 40; d *= 1.42) depths.push(d);
    // A lattice pylon as one stroked path: two tapering legs, two crossarms, an earth peak, bracing.
    const pylon = d => {
      const p = (u, v) => at(u, v, d).map(round).join(' ');
      const legs = [
        [-1.1, 0],
        [-0.35, 0.72 * P],
        [-0.25, P],
        [0, P + 0.6],
        [0.25, P],
        [0.35, 0.72 * P],
        [1.1, 0],
      ];
      let path = `M ${legs.map(([u, v]) => p(u, v)).join(' L ')}`;
      for (const [v, half] of [
        [0.72 * P, 2.3],
        [0.88 * P, 1.7],
      ])
        path += ` M ${p(-half, v)} L ${p(half, v)} M ${p(-half, v)} L ${p(-0.3, v + 0.5)} M ${p(half, v)} L ${p(0.3, v + 0.5)}`;
      // Bracing: a zigzag between the legs up to the waist.
      const legAt = (v, side) => side * (1.1 - (0.75 * v) / (0.72 * P));
      for (let i = 0, v = 0; v < 0.72 * P - 0.5; i++, v += 0.9) {
        const v2 = Math.min(0.72 * P, v + 0.9);
        path += ` M ${p(legAt(v, -1), v)} L ${p(legAt(v2, 1), v2)} M ${p(legAt(v, 1), v)} L ${p(legAt(v2, -1), v2)}`;
      }
      return path;
    };
    // Wires hang from the crossarm tips; the earth wire from the peak.
    const tips = [
      [-2.3, 0.72 * P],
      [2.3, 0.72 * P],
      [-1.7, 0.88 * P],
      [1.7, 0.88 * P],
      [0, P + 0.6],
    ];
    const wire = ([u, v], ds) => {
      let d = '';
      ds.forEach((dep, i) => {
        const [x, y] = at(u, v, dep);
        if (!i) d += `M ${round(x)} ${round(y)}`;
        else {
          const prev = ds[i - 1],
            mid = (prev + dep) / 2,
            [mx, my] = at(u, v - 1.4, mid);
          d += ` Q ${round(mx)} ${round(my)} ${round(x)} ${round(y)}`;
        }
      });
      return d;
    };
    const far = [...depths].reverse();
    const pulses = [0, 0.2, 0.45, 0.7, 0.95, 1.2].map((t, i) => {
      const tip = tips[[0, 3, 1, 2, 0, 3][i]];
      return {
        type: 'circle',
        cx: 0,
        cy: 0,
        r: 5,
        fill: 'ink',
        glow: { blur: 14, color: 'accent', opacity: 1 },
        at: round(t),
        enter: 'fade',
        dur: 0.2,
        along: { d: wire(tip, far.slice(i % 2 ? 2 : 3)), at: round(t), dur: 1.8, ease: 'in' },
        keys: [
          { at: 0, scale: 0.6, dur: 0 },
          { at: round(t), scale: 4, dur: 1.8, ease: 'in' },
        ],
        echo: { count: 10, lag: 0.012, fade: 0.78, to: 'accent' },
      };
    });
    // A tree line on the horizon, irregular, with the fog in front of it.
    const trees = [];
    for (let x = -0.1 * w; x <= 1.1 * w; x += w / 90) trees.push(`${round(x)} ${round(y0 - 4 - rand() * h * 0.018)}`);
    const grass = [];
    for (let x = -20; x < w + 20; x += 14 + rand() * 18) {
      const top = h * (tallFrame ? 0.88 + rand() * 0.06 : 0.76 + rand() * 0.08),
        lean = (rand() - 0.5) * 40;
      grass.push(`M ${round(x)} ${h} Q ${round(x + lean * 0.3)} ${round((h + top) / 2)} ${round(x + lean)} ${round(top)}`);
    }
    return {
      view: [round(w * 0.04), round(h * 0.03), round(w * 0.92), round(h * 0.92)],
      viewFrom: [0, 0, w, h],
      viewDur: 7,
      elements: [
        // Dusk: night overhead, the last light on the horizon behind the line.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(-0.1 * h),
          w: round(1.2 * w),
          h: round(y0 + 0.1 * h),
          fill: { gradient: ['bg', 'surface', 'muted', 'accent2'], angle: 90 },
          at: 0,
          enter: 'none',
        },
        {
          type: 'ellipse',
          cx: vx,
          cy: y0,
          rx: round(w * 0.45),
          ry: round(h * 0.16),
          fill: { gradient: ['accent', 'accent2'], radial: true, fade: true },
          opacity: 0.6,
          at: 0,
          enter: 'none',
        },
        // Long clouds lit from below.
        ...[0.32, 0.4, 0.47].map((k, i) => ({
          type: 'ellipse',
          cx: round(w * (0.3 + 0.25 * i)),
          cy: round((y0 * k) / 0.6),
          rx: round(w * (0.3 - 0.06 * i)),
          ry: round(h * 0.012),
          fill: 'bg',
          opacity: 0.35,
          blur: 8,
          at: 0,
          enter: 'none',
          loop: { type: 'float', period: 14 + i * 4, amount: 10 },
        })),
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: y0,
          w: round(1.2 * w),
          h: round(h - y0 + 0.1 * h),
          fill: { gradient: ['surface', 'bg'], angle: 90 },
          at: 0,
          enter: 'none',
        },
        {
          type: 'path',
          d: `M ${trees.join(' L ')} L ${round(1.1 * w)} ${round(y0 + 6)} L ${round(-0.1 * w)} ${round(y0 + 6)} Z`,
          fill: 'bg',
          stroke: 'none',
          at: 0,
          enter: 'none',
        },
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(y0 - h * 0.025),
          w: round(1.2 * w),
          h: round(h * 0.06),
          fill: { gradient: ['ink', 'ink'], angle: 90, fade: true },
          opacity: 0.1,
          at: 0,
          enter: 'none',
          loop: { type: 'float', period: 12, amount: 8 },
        },
        // The line of pylons and their wires: silhouettes against the glow.
        {
          type: 'group',
          at: 0,
          enter: 'none',
          children: [
            ...depths.map(d => ({
              type: 'path',
              d: pylon(d),
              fill: 'none',
              stroke: 'bg',
              width: round(Math.max(1, (f * 0.07) / d)),
              join: 'round',
              cap: 'round',
              enter: 'none',
            })),
            ...tips.map(tip => ({
              type: 'path',
              d: wire(tip, depths),
              fill: 'none',
              stroke: 'bg',
              width: 2,
              enter: 'none',
            })),
          ],
        },
        ...pulses,
        // Grass close to the lens.
        {
          type: 'path',
          d: grass.join(' '),
          fill: 'none',
          stroke: 'bg',
          width: 5,
          cap: 'round',
          blur: 3,
          at: 0,
          enter: 'none',
          loop: { type: 'sway', period: 5, amount: 1.5 },
          origin: [round(w / 2), h],
        },
      ],
    };
  },
};
