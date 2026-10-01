import { round, rng } from '../../fframes/sketch-kit.mjs';

// A city at night seen from a plane: thousands of lights laid out in true perspective, sized by
// their distance, along a street grid turned against the view; boulevards brighter, a black river
// with lit embankments, a highway whose car lights stream both ways, and haze where the city meets
// the sky. It sleeps dim on the first frame; then the lights come on in a wave rolling from the
// horizon toward the camera, as if a signal has arrived.
export default {
  name: 'citygrid',
  order: 11.5,
  summary:
    'A night city from a plane: a carpet of perspective lights on a street grid, a black river, a highway of moving car lights, and a wave of light rolling toward the camera.',
  use: 'Scale and spread: "every city", "it reached everyone", a network switching on. A trailer montage beat or the turn of a story about infrastructure.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 23),
      tallFrame = h > w,
      // Tall frames tilt further down so the city fills the height; the haze is a band at the top.
      y0 = round(h * (tallFrame ? 0.15 : 0.27)),
      vx = round(w * 0.5),
      f = Math.min(w, h) * 0.9,
      Hc = 6,
      dMin = (f * Hc) / (h * 1.04 - y0),
      dMax = 320,
      span = tallFrame ? 0.75 : 0.62;
    const P = (u, d) => [vx + (f * u) / d, y0 + (f * Hc) / d];
    const visible = (u, d) => d >= dMin && d <= dMax && Math.abs(u) <= ((w * span) / f) * d;
    const th = (24 * Math.PI) / 180,
      A = [Math.cos(th), Math.sin(th)],
      B = [-Math.sin(th), Math.cos(th)];
    // Ground point from grid coordinates (a along the cross streets, b along the avenues).
    const G = (a, b) => [A[0] * a + B[0] * b, 30 + A[1] * a + B[1] * b];
    // One path of many dots: a light every `step` along a street, sized by distance.
    // A dot is a zero-length stroke with a round cap; its band sets the stroke width.
    const dot = (x, y) => `M${Math.round(x)} ${Math.round(y)}h.1`;
    const BANDS = 9,
      bandOf = d => Math.max(0, Math.min(BANDS - 1, Math.floor((Math.log(d / dMin) / Math.log(dMax / dMin)) * BANDS)));
    const lamps = Array.from({ length: BANDS }, () => []),
      bright = Array.from({ length: BANDS }, () => []),
      windows = Array.from({ length: BANDS }, () => []);
    const river = b => -6 + 5 * Math.sin(b / 11);
    const onRiver = (a, b) => Math.abs(a - river(b)) < 1.1;
    const avenues = [],
      streets = [];
    for (let a = -90; a <= 90; a += 1.5) avenues.push({ a, wide: Math.abs(Math.round(a / 1.5)) % 5 === 2 });
    for (let b = -80; b <= 320; b += 1.2) streets.push({ b, wide: Math.abs(Math.round(b / 1.2)) % 7 === 3 });
    const lay = (pt, list) => {
      const [u, d] = pt;
      if (!visible(u, d)) return;
      const [x, y] = P(u, d);
      list[bandOf(d)].push(dot(x, y));
    };
    // The depth at the middle of each band, for sizing its lights.
    const bandDepth = i => dMin * (dMax / dMin) ** ((i + 0.5) / BANDS);
    // Lamps are spaced wider in the distance, where they merge into a carpet anyway.
    const stepAt = d => Math.max(0.5, d / 12);
    for (const { a, wide } of avenues)
      for (let b = -80; b <= 320; ) {
        const pt = G(a, b);
        if (!onRiver(a, b)) lay(pt, wide ? bright : lamps);
        b += stepAt(pt[1]);
      }
    for (const { b, wide } of streets)
      for (let a = -90; a <= 90; ) {
        const pt = G(a, b);
        if (!onRiver(a, b)) lay(pt, wide ? bright : lamps);
        a += stepAt(pt[1]);
      }
    // The streets themselves as lines of light, so the grid reads as a city plan, not a starfield.
    const lineBands = Array.from({ length: BANDS }, () => []),
      wideBands = Array.from({ length: BANDS }, () => []);
    const trace = (pointAt, from, to, wide) => {
      let prev = null;
      for (let t = from; t <= to; ) {
        const pt = pointAt(t),
          ok = visible(pt[0], pt[1]) && !onRiver(...(pointAt.grid ? pointAt.grid(t) : [0, 0]));
        // Some blocks are dark (parks, rail yards), so the plan is not a uniform mesh.
        if (ok && prev && rand() > 0.18) {
          const [x1, y1] = P(...prev),
            [x2, y2] = P(...pt);
          (wide ? wideBands : lineBands)[bandOf(pt[1])].push(`M${Math.round(x1)} ${Math.round(y1)}L${Math.round(x2)} ${Math.round(y2)}`);
        }
        prev = ok ? pt : null;
        t += Math.max(0.5, pt[1] / 6);
      }
    };
    for (const { a, wide } of avenues) {
      const fn = b => G(a, b);
      fn.grid = b => [a, b];
      trace(fn, -80, 320, wide);
    }
    for (const { b, wide } of streets) {
      const fn = a => G(a, b);
      fn.grid = a => [a, b];
      trace(fn, -90, 90, wide);
    }
    // Windows and rooftops: scattered warm points inside the blocks.
    for (let i = 0; i < 1400; i++) {
      const a = -40 + 80 * rand(),
        b = -60 + 140 * rand() ** 0.7;
      if (!onRiver(a, b)) lay(G(a, b), windows);
    }
    // The river's embankments: a lit line along each bank, the water black between them.
    const bankPts = k => {
      const out = [];
      for (let b = -80; b <= 320; ) {
        const [u, d] = G(river(b) + k, b);
        if (d >= dMin * 0.9 && d <= dMax) out.push([u, d]);
        b += Math.max(0.5, d / 14);
      }
      return out.sort((p, q) => q[1] - p[1]);
    };
    const bankL = bankPts(-1.1),
      bankR = bankPts(1.1);
    const water = `M ${[...bankL, ...[...bankR].reverse()]
      .map(([u, d]) => P(u, d).map(round).join(' '))
      .join(' L ')} Z`;
    const bankLights = [...bankL, ...bankR].filter((_, i) => i % 2 === 0);
    const embank = Array.from({ length: BANDS }, () => []);
    bankLights.forEach(pt => lay(pt, embank));
    // A highway sweeping in from the left: two lanes of car lights streaming opposite ways.
    const hw = [];
    for (let t = 0; t <= 1.0001; t += 0.04) hw.push([-34 + 44 * t, dMin + 1 + 46 * (1 - t) ** 1.8]);
    const lane = k =>
      `M ${hw
        .map(([u, d]) => P(u + k, d).map(round))
        .filter(([x]) => x > -w * 0.5 && x < w * 1.5)
        .map(p => p.join(' '))
        .join(' L ')}`;
    // The wave: far bands brighten first, near bands last.
    const wave = i => round(0.05 + ((BANDS - 1 - i) / (BANDS - 1)) * 1.0);
    // Path data is capped at 12,000 characters an element: long bands are split into runs.
    const chunks = ds => {
      const out = [];
      let cur = '';
      for (const d of ds) {
        if (cur.length + d.length > 11800) {
          out.push(cur);
          cur = '';
        }
        cur += d;
      }
      if (cur) out.push(cur);
      return out;
    };
    const bandGroup = (lists, stroke, opacity, size) =>
      lists
        .flatMap((ds, i) => chunks(ds).map(d => [d, i]))
        .map(([d, i]) =>
          d.length
            ? {
                type: 'path',
                d,
                fill: 'none',
                stroke,
                width: round(Math.max(1.2, Math.min(9, (f * size) / bandDepth(i)))),
                cap: 'round',
                opacity,
                // Lit from the first frame (half bright), then the wave brings each band up.
                at: 0,
                enter: 'none',
                keys: [
                  { at: 0, opacity: 0.45, dur: 0 },
                  { at: wave(i), opacity: 1, dur: 0.5 },
                ],
              }
            : null,
        )
        .filter(Boolean);
    const towers = [
      [-2, 14, 11, 1.3],
      [1.5, 15.5, 7, 1.1],
      [-5, 17, 6, 1.2],
      [4, 18, 9, 1.4],
      [-1, 19.5, 15, 1.5],
      [2.5, 21, 6.5, 1.1],
      [-4, 22, 10, 1.3],
      [6, 23, 5, 1.2],
      [0.5, 24.5, 8, 1.1],
      [-7, 25, 4.5, 1.3],
      [3.5, 26.5, 12, 1.2],
      [-2.5, 28, 6, 1.0],
      [8, 30, 4, 1.4],
      [-6, 31, 5.5, 1.1],
      [1, 33, 7, 1.2],
    ]
      .map(([a, b, ht, wd]) => ({ pt: G(a, b), ht, wd }))
      .filter(({ pt }) => visible(pt[0], pt[1]))
      .sort((p, q) => q.pt[1] - p.pt[1])
      .flatMap(({ pt, ht, wd }, k) => {
        const [x, y] = P(...pt),
          s = f / pt[1],
          tw = wd * s,
          th = ht * s * 0.7,
          rows = Math.floor(ht * 2.2),
          cols = 3;
        const lights = [];
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++)
            if (rand() > 0.35) lights.push(`M${round(x - tw / 2 + tw * (c + 0.5) / cols)} ${round(y - th + th * (r + 0.6) / (rows + 0.4))}h.1`);
        return [
          { type: 'rect', x: round(x - tw / 2), y: round(y - th), w: round(tw), h: round(th), fill: { gradient: ['surface', 'bg'], angle: 90 }, at: 0, enter: 'none' },
          // Rim light from the horizon glow on one edge, and the city's glow at the foot.
          { type: 'rect', x: round(x - tw / 2), y: round(y - th), w: round(Math.max(1.2, tw * 0.07)), h: round(th), fill: 'accent2', opacity: 0.45, at: 0, enter: 'none' },
          { type: 'rect', x: round(x - tw / 2), y: round(y - th * 0.25), w: round(tw), h: round(th * 0.25), fill: { gradient: ['accent', 'accent'], angle: 270, fade: true }, opacity: 0.25, at: 0, enter: 'none' },
          { type: 'path', d: lights.join(''), fill: 'none', stroke: 'accent', width: round(Math.max(1.4, s * 0.12)), cap: 'round', opacity: 0.85, glow: { blur: 3, opacity: 0.7 }, at: 0, enter: 'none' },
          ...(ht > 8
            ? [
                { type: 'line', x1: round(x), y1: round(y - th), x2: round(x), y2: round(y - th - s * 3), stroke: 'muted', width: round(Math.max(1, s * 0.08)), at: 0, enter: 'none' },
                { type: 'circle', cx: round(x), cy: round(y - th - s * 3), r: round(Math.max(2, s * 0.12)), fill: 'negative', glow: { blur: 8, opacity: 1 }, at: 0, enter: 'none', loop: { type: 'blink', period: 1.4 + k * 0.2, amount: 0.9 } },
              ]
            : [{ type: 'circle', cx: round(x), cy: round(y - th), r: round(Math.max(1.5, s * 0.08)), fill: 'negative', glow: { blur: 6, opacity: 1 }, at: 0, enter: 'none', loop: { type: 'blink', period: 1.8 + k * 0.3, amount: 0.9 } }]),
        ];
      });
    const dim = [...lamps.keys()].flatMap(i => chunks([...lamps[i], ...bright[i]]).map(d => ({
      type: 'path',
      d,
      fill: 'none',
      stroke: 'muted',
      width: round(Math.max(1, Math.min(6, (f * 0.06) / bandDepth(i)))),
      cap: 'round',
      opacity: 0.5,
      enter: 'none',
    })));
    return {
      view: [round(w * 0.06), round(h * 0.07), round(w * 0.88), round(h * 0.88)],
      viewFrom: [0, 0, w, h],
      viewDur: 7,
      elements: [
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(-0.1 * h),
          w: round(1.2 * w),
          h: round(1.2 * h),
          fill: 'bg',
          at: 0,
          enter: 'none',
        },
        // The sky: dark overhead, warmed from below by the city where it meets the haze.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(-0.1 * h),
          w: round(1.2 * w),
          h: round(y0 + 0.1 * h),
          fill: { gradient: ['bg', 'bg', 'surface'], angle: 90 },
          at: 0,
          enter: 'none',
        },
        { type: 'group', at: 0, enter: 'none', children: dim },
        { type: 'path', d: water, fill: 'bg', stroke: 'none', at: 0, enter: 'none' },
        {
          type: 'group',
          at: 0,
          enter: 'none',
          glow: { blur: 4, color: 'accent', opacity: 0.9 },
          children: [
            ...lineBands.flatMap((ds, i) =>
              chunks(ds).map(d => ({
                type: 'path',
                d,
                fill: 'none',
                stroke: 'accent',
                width: round(Math.max(0.7, Math.min(3, (f * 0.025) / bandDepth(i)))),
                opacity: 0.3,
                at: 0,
                enter: 'none',
              })),
            ),
            ...wideBands.flatMap((ds, i) =>
              chunks(ds).map(d => ({
                type: 'path',
                d,
                fill: 'none',
                stroke: 'accent',
                width: round(Math.max(1, Math.min(5, (f * 0.05) / bandDepth(i)))),
                opacity: 0.6,
                at: 0,
                enter: 'none',
              })),
            ),
            ...bandGroup(windows, 'accent', 0.5, 0.045),
            ...bandGroup(lamps, 'accent', 0.95, 0.07),
            ...bandGroup(embank, 'accent2', 0.95, 0.09),
            ...bandGroup(bright, 'ink', 1, 0.1),
          ],
        },
        // Downtown: a cluster of towers standing up out of the plan, far ones first, with lit
        // windows and aviation lights; the tallest carries a spire.
        ...towers,
        {
          type: 'path',
          d: lane(0),
          fill: 'none',
          stroke: 'ink',
          width: 3,
          dash: [4, 20],
          cap: 'round',
          glow: { blur: 6, opacity: 0.9 },
          at: 0,
          enter: 'none',
          loop: { type: 'dash', period: 1.4 },
        },
        {
          type: 'path',
          d: lane(0.6),
          fill: 'none',
          stroke: 'negative',
          width: 3,
          dash: [4, 18],
          cap: 'round',
          glow: { blur: 6, opacity: 0.9 },
          at: 0,
          enter: 'none',
          loop: { type: 'dash', period: 1.1, amount: -1 },
        },
        // Haze where the city meets the sky: a band of its own glow, fading up and down.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(y0 - h * 0.09),
          w: round(1.2 * w),
          h: round(h * 0.09),
          fill: { gradient: ['accent2', 'accent2'], angle: 270, fade: true },
          opacity: 0.38,
          at: 0,
          enter: 'none',
        },
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: y0,
          w: round(1.2 * w),
          h: round(h * 0.16),
          fill: { gradient: ['accent2', 'accent2'], angle: 90, fade: true },
          opacity: 0.32,
          at: 0,
          enter: 'none',
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 18,
          seed: 41,
          size: 5,
          speed: 0.6,
          fill: 'ink',
          opacity: 0.18,
          blur: 3,
          at: 0,
          enter: 'none',
        },
      ],
    };
  },
};
