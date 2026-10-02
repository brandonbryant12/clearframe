import { threadLayout } from './_thread-kit.mjs';

export default {
  name: 'thread-knot',
  order: 67,
  summary: 'One conversational thread ties itself into a knot while the camera moves closer.',
  use: 'A reflective podcast moment about tension, competing thoughts or an unresolved question. Follow with thread-opening in the same world.',
  build(w, h) {
    const { vertical, unit, point: p } = threadLayout(w, h);
    const route = vertical
      ? `M ${p(0.25, 0.08)} C ${p(0.23, 0.2)} ${p(0.79, 0.26)} ${p(0.67, 0.43)} C ${p(0.48, 0.65)} ${p(0.17, 0.42)} ${p(0.39, 0.35)} C ${p(0.68, 0.28)} ${p(0.84, 0.61)} ${p(0.54, 0.62)} C ${p(0.2, 0.65)} ${p(0.3, 0.42)} ${p(0.53, 0.44)} C ${p(0.73, 0.48)} ${p(0.48, 0.75)} ${p(0.5, 0.94)}`
      : `M ${p(0.02, 0.58)} C ${p(0.2, 0.54)} ${p(0.29, 0.21)} ${p(0.47, 0.38)} C ${p(0.67, 0.61)} ${p(0.43, 0.89)} ${p(0.39, 0.65)} C ${p(0.31, 0.32)} ${p(0.67, 0.29)} ${p(0.63, 0.61)} C ${p(0.58, 0.88)} ${p(0.43, 0.62)} ${p(0.51, 0.5)} C ${p(0.61, 0.35)} ${p(0.76, 0.57)} ${p(0.98, 0.55)}`;
    return {
      view: [0, 0, w, h],
      viewFrom: [-w * 0.045, -h * 0.045, w * 1.09, h * 1.09],
      viewDur: 4.6,
      elements: [
        { type: 'ellipse', cx: w * 0.5, cy: h * 0.52, rx: w * 0.28, ry: h * 0.26,
          fill: 'wash', opacity: 0.65, at: 0, enter: 'none' },
        { type: 'path', d: route, fill: 'none', stroke: 'muted', opacity: 0.24,
          width: unit * 0.025, cap: 'round', at: 0, enter: 'none' },
        { type: 'path', d: route, fill: 'none', stroke: 'accent', width: unit * 0.008,
          cap: 'round', at: 0.2, enter: 'draw', dur: 3.4 },
        { type: 'circle', cx: 0, cy: 0, r: unit * 0.012, fill: 'ink', origin: [0, 0],
          at: 0, enter: 'none', along: { d: route, at: 0.2, dur: 4.6, ease: 'inOut' } },
      ],
    };
  },
};
