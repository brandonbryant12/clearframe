import { threadLayout, movePath } from './_thread-kit.mjs';

export default {
  name: 'thread-opening',
  order: 68,
  summary: 'The tangled thread opens into a large listening loop with a real audio-reactive centre.',
  use: 'A reflective podcast reframe. Use the same world as thread-knot; the meter follows actual narration, never a decorative fake waveform.',
  build(w, h) {
    const { vertical, unit, shift: [dx, dy], point: p } = threadLayout(w, h);
    // The first point equals the previous shot's last point in world space.
    const route = vertical
      ? `M ${p(0.5, 0.06)} C ${p(0.51, 0.18)} ${p(0.21, 0.27)} ${p(0.21, 0.48)} C ${p(0.21, 0.79)} ${p(0.8, 0.79)} ${p(0.8, 0.49)} C ${p(0.8, 0.23)} ${p(0.24, 0.24)} ${p(0.34, 0.49)} C ${p(0.42, 0.66)} ${p(0.5, 0.78)} ${p(0.52, 0.91)}`
      : `M ${p(0.1, 0.55)} C ${p(0.21, 0.54)} ${p(0.28, 0.3)} ${p(0.49, 0.29)} C ${p(0.78, 0.28)} ${p(0.83, 0.78)} ${p(0.52, 0.78)} C ${p(0.22, 0.78)} ${p(0.23, 0.36)} ${p(0.49, 0.4)} C ${p(0.7, 0.44)} ${p(0.8, 0.59)} ${p(0.98, 0.59)}`;
    const worldRoute = movePath(route, dx, dy);
    return {
      view: [dx, dy, w, h],
      viewDur: 2.6,
      elements: [
        { type: 'ellipse', cx: dx + w * 0.5, cy: dy + h * 0.52, rx: w * 0.29, ry: h * 0.26,
          fill: 'wash2', opacity: 0.55, at: 0, enter: 'none' },
        { type: 'path', d: worldRoute, fill: 'none', stroke: 'muted', opacity: 0.24,
          width: unit * 0.025, cap: 'round', at: 0, enter: 'none' },
        { type: 'path', d: worldRoute, fill: 'none', stroke: 'accent2', width: unit * 0.008,
          cap: 'round', at: 0.2, enter: 'draw', dur: 3.4 },
        { type: 'meter', x: dx + w * 0.42, y: dy + h * 0.48, w: w * 0.16, h: h * 0.08,
          style: 'wave', bars: 30, fill: 'ink', stroke: 'ink', width: 3,
          opacity: 0.8, at: 1.7, enter: 'fade', dur: 0.9 },
      ],
    };
  },
};
