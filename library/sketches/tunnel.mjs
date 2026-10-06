import { round, seen } from '../../film/sketch-kit.mjs';

// Fly through a sequence of gates toward a light. Rings sit at increasing depth, each
// drawn at its apparent size; the camera dollies through them and focus follows the
// next gate, so the one about to pass is sharp and the far ones are soft.
export default {
  name: 'tunnel',
  order: 10,
  summary:
    'A fly-through: segmented rings at increasing depth, a light at the end, the camera passing gate after gate.',
  use: 'Entering a system, a scale or a story: "inside the network", "down to the cell", a trailer montage beat. Retime the dolly to the line.',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h / 2),
      R = Math.max(w, h) * 0.34;
    const gates = [1, 2.2, 3.4, 4.6, 5.8, 7].map((z, i) => ({
      type: 'circle',
      cx,
      cy,
      r: round(seen(R, z)),
      fill: 'none',
      stroke: i % 2 ? 'accent2' : 'accent',
      width: round(seen(16, z) + 1),
      dash: [round(seen(120, z)), round(seen(38, z))],
      cap: 'round',
      z,
      at: 0.1 + i * 0.12,
      enter: 'draw',
      dur: 0.9,
      glow: { blur: 10, opacity: 0.8 },
      loop: { type: 'spin', period: 18 + i * 3, amount: i % 2 ? -1 : 1 },
    }));
    return {
      dolly: [{ at: 0.6, z: 7.6, dur: 6.5, ease: 'inOut' }],
      focus: { z: 1, aperture: 0.9, keys: [{ at: 0.6, z: 8.2, dur: 6.5 }] },
      elements: [
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'warp',
          count: 120,
          fill: 'ink',
          opacity: 0.5,
          at: 0.4,
          enter: 'fade',
          dur: 1,
        },
        ...gates,
        {
          type: 'circle',
          cx,
          cy,
          r: round(seen(R * 0.5, 8.5)),
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          z: 8.5,
          at: 0.3,
          enter: 'fade',
          dur: 1.2,
          glow: { blur: 30, color: 'accent', opacity: 1 },
        },
      ],
    };
  },
};
