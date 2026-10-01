import { round, rng } from '../../fframes/sketch-kit.mjs';

// Open water at night: swell lines rolling at three depths (slower and fainter with
// distance), a low moon, and its reflection breaking into dashes that shimmer on the water.
export default {
  name: 'ocean',
  order: 16,
  summary:
    'Open water at night: swell lines rolling at three depths, a low moon, and its reflection shimmering in broken dashes.',
  use: 'Crossings, trade, climate, distance, waiting: "somewhere out at sea…". Recolour the moon (accent2) for a sunset.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 11),
      horizon = round(h * 0.46),
      mx = round(w * 0.62);
    const swell = (y, amp, z, width, opacity, period) => {
      const pts = [];
      for (let x = -0.3 * w; x <= 1.3 * w; x += w / 12) pts.push(`${round(x)} ${round(y + (rand() - 0.5) * amp)}`);
      return {
        type: 'path',
        d: `M ${pts.join(' L ')}`,
        stroke: 'muted',
        width,
        opacity,
        fill: 'none',
        z,
        at: 0.2,
        enter: 'draw',
        dur: 1.4,
        loop: { type: 'orbit', period, amount: round(amp * 0.35) },
        rough: false,
      };
    };
    const lines = [];
    for (let i = 0; i < 14; i++) {
      const t = i / 13,
        y = horizon + (h - horizon) * t ** 1.6;
      lines.push(
        swell(y, 6 + 30 * t, round((1 - t) * 6 * 100) / 100, round(1 + 3 * t), round(0.25 + 0.5 * t), round(9 - 5 * t)),
      );
    }
    const glints = [];
    for (let i = 0; i < 26; i++) {
      const t = rand() ** 1.3,
        y = horizon + 12 + (h - horizon - 12) * t,
        len = 12 + 90 * t;
      glints.push({
        type: 'line',
        x1: round(mx - len / 2 + (rand() - 0.5) * 60 * t),
        y1: round(y),
        x2: round(mx + len / 2 + (rand() - 0.5) * 60 * t),
        y2: round(y),
        stroke: 'ink',
        width: round(1.5 + 3 * t),
        cap: 'round',
        opacity: 0.8,
        at: round(0.8 + rand()),
        enter: 'fade',
        dur: 0.6,
        loop: { type: 'blink', period: round(1.5 + rand() * 3) },
      });
    }
    return {
      view: [0, 0, w, h],
      viewFrom: [round(w * 0.04), round(-h * 0.03), round(w * 0.92), round(h * 0.92)],
      viewDur: 10,
      elements: [
        {
          type: 'rect',
          x: round(-0.2 * w),
          y: round(-0.2 * h),
          w: round(1.4 * w),
          h: round(horizon + 0.2 * h),
          fill: { gradient: ['bg', 'surface'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'rect',
          x: round(-0.2 * w),
          y: horizon,
          w: round(1.4 * w),
          h: round(h * 0.8),
          fill: { gradient: ['surface', 'bg'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h: round(horizon * 0.9),
          kind: 'stars',
          count: 80,
          fill: 'ink',
          opacity: 0.5,
          size: 2,
          z: 12,
          at: 0,
          enter: 'fade',
          dur: 1.5,
        },
        {
          type: 'circle',
          cx: mx,
          cy: round(horizon - h * 0.16),
          r: round(h * 0.28),
          fill: { gradient: ['ink', 'ink'], radial: true, fade: true },
          opacity: 0.18,
          z: 12,
          at: 0.2,
          enter: 'fade',
          dur: 2,
        },
        {
          type: 'circle',
          cx: mx,
          cy: round(horizon - h * 0.16),
          r: round(h * 0.045),
          fill: 'ink',
          z: 12,
          glow: { blur: 24 },
          at: 0.2,
          enter: 'fade',
          dur: 1.5,
        },
        ...lines,
        { type: 'group', glow: { blur: 6, opacity: 0.8 }, children: glints },
      ],
    };
  },
};
