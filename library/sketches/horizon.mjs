import { round, smoothPath, rng } from '../../fframes/sketch-kit.mjs';

// Dawn over layered hills: a sky warming toward the horizon, the sun rising behind three
// ridges that fade with distance (atmospheric perspective), mist between them, and a slow
// crane up that separates the ridges.
export default {
  name: 'horizon',
  order: 12,
  summary: 'Dawn over three ridges that fade with distance, mist between them, the sun rising, and a slow crane up.',
  use: 'The establishing shot: a beginning, a new era, "every morning…", the calm before a turn. Works with the warm or teal-orange grade and bloom.',
  build(w, h) {
    const rand = rng(3);
    const ridges = {};
    const ridge = (base, rough, seed) => (ridges[seed] ??= ridgePath(base, rough, seed));
    const ridgePath = (base, rough, seed) => {
      const pts = [];
      for (let i = 0; i <= 8; i++)
        pts.push([-0.2 * w + (i / 8) * 1.4 * w, base - rough * h * (0.3 + rand() * 0.7) * (seed % 2 ? 1 : 0.8)]);
      return `${smoothPath(pts)} L ${round(1.2 * w)} ${round(h * 1.2)} L ${round(-0.2 * w)} ${round(h * 1.2)} Z`;
    };
    const horizon = h * 0.62;
    // Atmospheric perspective: the farther the ridge, the more it takes the sky's colour.
    const layers = [
      { z: 6, base: horizon + h * 0.02, rough: 0.07, fill: 'muted', opacity: 0.45 },
      { z: 2.4, base: horizon + h * 0.1, rough: 0.1, fill: 'surface', opacity: 1 },
      { z: 0.5, base: horizon + h * 0.22, rough: 0.13, fill: 'bg', opacity: 1 },
    ];
    return {
      view: [0, 0, w, h],
      viewFrom: [0, round(h * 0.07), w, h],
      viewDur: 8,
      elements: [
        // Sky: night overhead warming to the sun's colour at the horizon line.
        {
          type: 'rect',
          x: round(-0.2 * w),
          y: round(-0.3 * h),
          w: round(1.4 * w),
          h: round(horizon + 0.34 * h),
          fill: { gradient: ['bg', 'surface', 'accent2'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'rect',
          x: round(-0.2 * w),
          y: round(horizon),
          w: round(1.4 * w),
          h: round(h * 0.6),
          fill: 'surface',
          at: 0,
          dur: 0,
        },
        {
          type: 'circle',
          cx: round(w * 0.58),
          cy: round(horizon),
          r: round(h * 0.5),
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.45,
          z: 14,
          at: 0.2,
          enter: 'fade',
          dur: 2,
        },
        {
          type: 'circle',
          cx: round(w * 0.58),
          cy: round(horizon + h * 0.03),
          r: round(h * 0.065),
          fill: 'ink',
          z: 14,
          glow: { blur: 40, color: 'accent2', opacity: 1 },
          at: 0.2,
          enter: 'fade',
          dur: 1.2,
          keys: [{ at: 0.4, y: round(-h * 0.1), dur: 8, ease: 'out' }],
        },
        ...layers.flatMap((l, i) => [
          // Each ridge is opaque (the sun sets behind it); haze tints the far ones.
          {
            type: 'group',
            z: l.z,
            at: 0.05 + i * 0.1,
            enter: 'rise',
            dur: 0.8,
            dist: 40,
            children: [
              {
                type: 'path',
                d: ridge(l.base, l.rough, i + 1),
                fill: i ? l.fill : 'surface',
                stroke: 'none',
                at: 0,
                dur: 0,
              },
              ...(i
                ? []
                : [
                    {
                      type: 'path',
                      d: ridge(l.base, l.rough, 1),
                      fill: 'muted',
                      stroke: 'none',
                      opacity: 0.4,
                      at: 0,
                      dur: 0,
                    },
                  ]),
            ],
          },
          ...(i < 2
            ? [
                {
                  type: 'rect',
                  x: round(-0.2 * w),
                  y: round(l.base - h * 0.02),
                  w: round(1.4 * w),
                  h: round(h * 0.1),
                  fill: { gradient: ['ink', 'ink'], angle: 90, fade: true },
                  opacity: 0.12,
                  z: l.z - 0.3,
                  at: 0.6,
                  enter: 'fade',
                  dur: 2,
                  loop: { type: 'float', period: 11 + i * 3, amount: 14 },
                },
              ]
            : []),
        ]),
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 30,
          fill: 'ink',
          opacity: 0.35,
          size: 4,
          z: -0.3,
          at: 0,
          enter: 'fade',
          dur: 1,
        },
      ],
    };
  },
};
