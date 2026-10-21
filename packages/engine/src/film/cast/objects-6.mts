import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects6 = {
  truck: {
    about:
      'a delivery truck: shipping, logistics, getting something to someone, fulfilment',
    extent: [0.5, 0.36],
    draw: (s, d, c): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.36 * s, w: 0.62 * s, h: 0.5 * s, r: 0.04 * s },
      details: [
        {
          type: 'rect',
          x: 0.14 * s,
          y: -0.18 * s,
          w: 0.32 * s,
          h: 0.32 * s,
          r: 0.07 * s,
          fill: c,
          body: true,
        },
        {
          type: 'rect',
          x: 0.22 * s,
          y: -0.12 * s,
          w: 0.15 * s,
          h: 0.1 * s,
          r: 0.02 * s,
          fill: d,
        },
        ...[-0.3, 0.27].map<CanvasElement>((x) => ({
          type: 'circle',
          cx: x * s,
          cy: 0.2 * s,
          r: 0.11 * s,
          fill: 'ink',
        })),
      ],
    }),
  } satisfies ObjectDefinition,
  paycheck: {
    about:
      'a paycheck: pay, salary, a paycheck deduction, take-home pay, payday',
    extent: [0.5, 0.26],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.26 * s, w: s, h: 0.52 * s, r: 0.04 * s },
      details: [
        {
          type: 'rect',
          x: 0.16 * s,
          y: -0.16 * s,
          w: 0.26 * s,
          h: 0.14 * s,
          r: 0.02 * s,
          fill: d,
          opacity: 0.85,
        },
        ...[-0.1, 0.04].map<CanvasElement>((y, i) => ({
          type: 'line',
          x1: -0.4 * s,
          y1: y * s,
          x2: (i ? -0.02 : 0.06) * s,
          y2: y * s,
          stroke: d,
          width: 0.035 * s,
          cap: 'round',
        })),
        {
          type: 'path',
          d: `M ${0.1 * s} ${0.16 * s} q ${0.05 * s} ${-0.08 * s} ${0.1 * s} 0 t ${0.1 * s} 0 t ${0.1 * s} 0`,
          fill: 'none',
          stroke: d,
          width: 0.03 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  calendar: {
    about:
      'a calendar page: a date, a deadline, an enrollment window, a schedule, a month',
    extent: [0.42, 0.46],
    draw: (s, d): CastDrawing => ({
      body: {
        x: -0.42 * s,
        y: -0.38 * s,
        w: 0.84 * s,
        h: 0.84 * s,
        r: 0.06 * s,
      },
      details: [
        {
          type: 'rect',
          x: -0.42 * s,
          y: -0.38 * s,
          w: 0.84 * s,
          h: 0.2 * s,
          r: 0.06 * s,
          fill: d,
          opacity: 0.85,
        },
        ...[-0.22, 0.22].map<CanvasElement>((x) => ({
          type: 'line',
          x1: x * s,
          y1: -0.46 * s,
          x2: x * s,
          y2: -0.3 * s,
          stroke: 'ink',
          width: 0.05 * s,
          cap: 'round',
        })),
        ...[0, 1, 2].flatMap<CanvasElement>((r) =>
          [0, 1, 2, 3].map<CanvasElement>((k) => ({
            type: 'circle',
            cx: (-0.27 + k * 0.18) * s,
            cy: (-0.04 + r * 0.16) * s,
            r: 0.035 * s,
            fill: d,
          })),
        ),
        {
          type: 'circle',
          cx: 0.27 * s,
          cy: 0.28 * s,
          r: 0.09 * s,
          fill: 'none',
          stroke: d,
          width: 0.03 * s,
        },
      ],
    }),
  } satisfies ObjectDefinition,
};
