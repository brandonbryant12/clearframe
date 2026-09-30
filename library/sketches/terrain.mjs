import { round } from '../../fframes/sketch-kit.mjs';

// A grid floor running to the horizon under a glowing sky: the ground of a data world, a
// launch, a synth-lit future. Cross lines sit at increasing depth, so as the camera dollies
// forward the ground rushes toward the lens and passes under it.
export default {
  name: 'terrain',
  order: 14,
  summary: 'A perspective grid floor to a glowing horizon; the camera glides forward and the ground rushes under it.',
  use: 'The floor of a data landscape, a product launch, a "future" beat, or a trailer montage shot. Put objects on it with z to stand them at a depth.',
  build(w, h) {
    const horizon = round(h * 0.5),
      cx = round(w / 2),
      spread = w * 1.6;
    // Where the floor at depth z meets the screen (a camera 1 unit above the floor).
    const floorY = z => round(horizon + (h - horizon) / (1 + z));
    // Cross lines lie on the floor at increasing depth: the renderer's perspective moves
    // each toward the lens at exactly the floor's rate as the camera flies forward.
    const cross = [];
    for (let i = 0; i < 18; i++) {
      const z = i * 0.55;
      cross.push({
        type: 'line',
        x1: round(cx - spread),
        y1: floorY(z),
        x2: round(cx + spread),
        y2: floorY(z),
        stroke: 'accent',
        width: round(3 / (1 + z) + 0.8),
        opacity: 0.85,
        z,
        at: 0.1 + i * 0.03,
        enter: 'draw',
        dur: 0.6,
      });
    }
    // Depth lines are drawn once, converging on the vanishing point.
    const rays = [];
    for (let i = -12; i <= 12; i++)
      rays.push({
        type: 'line',
        x1: round(cx + i * 22),
        y1: horizon,
        x2: round(cx + i * (spread / 6)),
        y2: round(h * 1.05),
        stroke: 'accent',
        width: 2,
        opacity: 0.6,
        at: 0.05,
        enter: 'draw',
        dur: 0.8,
      });
    return {
      dolly: [{ at: 0, z: 2.2, dur: 10, ease: 'linear' }],
      elements: [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w,
          h: horizon,
          fill: { gradient: ['bg', 'surface', 'accent2'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h: round(horizon * 0.8),
          kind: 'stars',
          count: 110,
          fill: 'ink',
          opacity: 0.6,
          size: 2,
          at: 0,
          enter: 'fade',
          dur: 1.5,
        },
        {
          type: 'ellipse',
          cx,
          cy: horizon,
          rx: round(w * 0.55),
          ry: round(h * 0.2),
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.55,
          at: 0,
          enter: 'fade',
          dur: 1.5,
        },
        { type: 'rect', x: 0, y: horizon, w, h: round(h - horizon), fill: 'bg', at: 0, dur: 0 },
        { type: 'group', glow: { blur: 8, opacity: 0.7 }, children: [...rays, ...cross] },
        {
          type: 'rect',
          x: 0,
          y: horizon,
          w,
          h: round(h * 0.12),
          fill: { gradient: ['accent2', 'accent2'], angle: 90, fade: true },
          opacity: 0.35,
          at: 0.4,
          enter: 'fade',
          dur: 1,
        },
      ],
    };
  },
};
