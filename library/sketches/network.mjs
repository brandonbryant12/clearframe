import { round, body } from '../../film/sketch-kit.mjs';

export default {
  name: 'network',
  order: 3,
  summary: 'Nodes and links: edges draw, nodes pop, one node pulses as the hub.',
  use: 'Networks, communities, dependencies, spread of an idea.',
  build(w, h) {
    const r = body(w, h),
      pts = [
        [0.5, 0.5],
        [0.18, 0.25],
        [0.82, 0.2],
        [0.12, 0.78],
        [0.86, 0.74],
        [0.46, 0.1],
        [0.52, 0.92],
        [0.3, 0.52],
        [0.7, 0.5],
      ];
    const P = pts.map(([u, v]) => [round(r.x + u * r.w), round(r.y + v * r.h)]);
    const edges = [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
      [0, 7],
      [0, 8],
      [1, 5],
      [2, 5],
      [3, 6],
      [4, 6],
      [7, 1],
      [8, 2],
      [7, 3],
      [8, 4],
    ];
    return {
      elements: [
        {
          type: 'group',
          at: 0.2,
          stagger: 0.08,
          children: edges.map(([a, b]) => ({
            type: 'line',
            x1: P[a][0],
            y1: P[a][1],
            x2: P[b][0],
            y2: P[b][1],
            stroke: 'line',
            width: 4,
            dur: 0.6,
          })),
        },
        {
          type: 'group',
          at: 0.8,
          stagger: 0.07,
          children: P.slice(1).map(([x, y]) => ({ type: 'circle', cx: x, cy: y, r: 22, fill: 'ink' })),
        },
        {
          type: 'circle',
          cx: P[0][0],
          cy: P[0][1],
          r: 90,
          fill: 'none',
          stroke: 'accent',
          width: 3,
          opacity: 0.6,
          at: 1.4,
          loop: { type: 'pulse', period: 1.6, amount: 0.15 },
        },
        {
          type: 'circle',
          cx: P[0][0],
          cy: P[0][1],
          r: 48,
          fill: 'accent',
          at: 1.3,
          glow: { blur: 18, opacity: 0.7 },
        },
      ],
    };
  },
};
