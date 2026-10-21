import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects8 = {
  umbrella: {
    about:
      'an umbrella: insurance, cover, protection, a safety net, a rainy day',
    extent: [0.5, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: {
        x: -0.03 * s,
        y: -0.12 * s,
        w: 0.06 * s,
        h: 0.5 * s,
        r: 0.03 * s,
      },
      details: [
        {
          type: 'path',
          d: `M ${-0.5 * s} ${-0.06 * s} Q 0 ${-0.62 * s} ${0.5 * s} ${-0.06 * s} Q ${0.33 * s} ${-0.14 * s} ${0.17 * s} ${-0.06 * s} Q 0 ${-0.14 * s} ${-0.17 * s} ${-0.06 * s} Q ${-0.33 * s} ${-0.14 * s} ${-0.5 * s} ${-0.06 * s} Z`,
          fill: c,
          body: true,
        },
        {
          type: 'path',
          d: `M 0 ${0.38 * s} q 0 ${0.12 * s} ${-0.1 * s} ${0.1 * s}`,
          fill: 'none',
          stroke: c,
          width: 0.06 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  receipt: {
    about: 'a receipt: an expense, a purchase, a claim, proof of payment',
    extent: [0.3, 0.5],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.3 * s, y: -0.5 * s, w: 0.6 * s, h: 0.92 * s, r: 0.02 * s },
      details: [
        {
          type: 'poly',
          points: Array.from({ length: 7 }, (_, k) => [
            (-0.3 + k * 0.1) * s,
            (k % 2 ? 0.5 : 0.42) * s,
          ]),
          closed: false,
          fill: 'none',
          stroke: d,
          width: 0.03 * s,
        },
        ...[-0.32, -0.2, -0.08].map<CanvasElement>((y) => ({
          type: 'line',
          x1: -0.18 * s,
          y1: y * s,
          x2: 0.18 * s,
          y2: y * s,
          stroke: d,
          width: 0.035 * s,
          cap: 'round',
        })),
        {
          type: 'line',
          x1: -0.18 * s,
          y1: 0.12 * s,
          x2: 0.18 * s,
          y2: 0.12 * s,
          stroke: d,
          width: 0.06 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  flag: {
    about:
      'a flag on a pole: a milestone, a goal, a launch, a finish line, arrival',
    extent: [0.4, 0.5],
    draw: (s): CastDrawing => ({
      body: {
        x: -0.24 * s,
        y: -0.46 * s,
        w: 0.62 * s,
        h: 0.36 * s,
        r: 0.03 * s,
      },
      details: [
        {
          type: 'line',
          x1: -0.28 * s,
          y1: -0.5 * s,
          x2: -0.28 * s,
          y2: 0.5 * s,
          stroke: 'ink',
          width: 0.05 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
};
