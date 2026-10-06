import { tall, round, body, smoothPath } from '../../film/sketch-kit.mjs';

export default {
  name: 'route',
  order: 0,
  summary: 'A journey: the path draws through stops, each stop lands as the line reaches it, a marker travels.',
  use: 'Processes over time, customer journeys, travel, a story with milestones.',
  build(w, h) {
    const r = body(w, h),
      n = 4;
    const stops = tall(w, h)
      ? [
          [r.x + r.w * 0.2, r.y + r.h * 0.92],
          [r.x + r.w * 0.8, r.y + r.h * 0.64],
          [r.x + r.w * 0.22, r.y + r.h * 0.36],
          [r.x + r.w * 0.78, r.y + r.h * 0.08],
        ]
      : [
          [r.x + r.w * 0.06, r.y + r.h * 0.78],
          [r.x + r.w * 0.36, r.y + r.h * 0.3],
          [r.x + r.w * 0.64, r.y + r.h * 0.66],
          [r.x + r.w * 0.94, r.y + r.h * 0.16],
        ];
    const d = smoothPath(stops),
      draw = 2.4,
      labels = ['Start', 'First step', 'Setback', 'Arrive'];
    return {
      elements: [
        { type: 'path', d, stroke: 'line', width: 14, at: 0.2, dur: 0.01, enter: 'fade', opacity: 0.6 },
        { type: 'path', d, stroke: 'accent', width: 8, at: 0.3, dur: draw, arrow: 'end' },
        ...stops.flatMap(([x, y], i) => [
          {
            type: 'circle',
            cx: round(x),
            cy: round(y),
            r: 26,
            fill: i === n - 1 ? 'accent2' : 'accent',
            stroke: 'bg',
            width: 6,
            at: round(0.3 + (draw * i) / (n - 1)),
            ...(i === n - 1 ? { glow: { blur: 16 } } : {}),
          },
          // Vertical routes zigzag, so labels sit outside the curve; wide routes label below.
          tall(w, h)
            ? {
                type: 'text',
                text: labels[i],
                x: round(x + (i % 2 ? 50 : -50)),
                y: round(y + 13),
                size: 38,
                anchor: i % 2 ? 'start' : 'end',
                font: 'semibold',
                fill: 'ink',
                at: round(0.4 + (draw * i) / (n - 1)),
              }
            : {
                type: 'text',
                text: labels[i],
                x: round(x),
                y: round(y + 78),
                size: 38,
                anchor: 'middle',
                font: 'semibold',
                fill: 'ink',
                at: round(0.4 + (draw * i) / (n - 1)),
              },
        ]),
        {
          type: 'circle',
          cx: round(stops[0][0]),
          cy: round(stops[0][1]),
          r: 13,
          fill: 'bg',
          enter: 'fade',
          at: 0.3,
          along: { d, dur: draw, ease: 'inOut' },
        },
      ],
    };
  },
};
