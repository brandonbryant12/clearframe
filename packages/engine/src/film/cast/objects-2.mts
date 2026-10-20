import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects2 = {
  card: {
    about:
      'a card holding a small bar chart: a dashboard, a metric, a report with numbers',
    extent: [0.5, 0.38],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.38 * s, w: s, h: 0.76 * s, r: 0.07 * s },
      details: [
        ...[0.18, 0.34, 0.25, 0.44].map<CanvasElement>((h, i) => ({
          type: 'rect',
          x: (-0.32 + i * 0.17) * s,
          y: (0.24 - h) * s,
          w: 0.11 * s,
          h: h * s,
          r: 0.015 * s,
          fill: d,
        })),
        {
          type: 'line',
          x1: -0.38 * s,
          y1: 0.26 * s,
          x2: 0.38 * s,
          y2: 0.26 * s,
          stroke: d,
          width: 0.03 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  person: {
    about: 'head and shoulders: a user, a customer, an engineer, a team member',
    extent: [0.4, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: { x: -0.4 * s, y: 0.04 * s, w: 0.8 * s, h: 0.46 * s, r: 0.23 * s },
      details: [
        {
          type: 'circle',
          cx: 0,
          cy: -0.24 * s,
          r: 0.21 * s,
          fill: c,
          body: true,
        },
      ],
    }),
  } satisfies ObjectDefinition,
  ticket: {
    about:
      'a ticket stub with a perforation: a support ticket, an order, a booking, a queue item',
    extent: [0.5, 0.28],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.28 * s, w: s, h: 0.56 * s, r: 0.05 * s },
      details: [
        {
          type: 'line',
          x1: 0.22 * s,
          y1: -0.2 * s,
          x2: 0.22 * s,
          y2: 0.2 * s,
          stroke: d,
          width: 0.03 * s,
          dash: [0.05 * s, 0.05 * s],
        },
        ...[-1, 1].map<CanvasElement>((k) => ({
          type: 'circle',
          cx: 0.22 * s,
          cy: k * 0.28 * s,
          r: 0.07 * s,
          fill: 'bg',
        })),
        ...[-0.08, 0.08].map<CanvasElement>((y, i) => ({
          type: 'line',
          x1: -0.36 * s,
          y1: y * s,
          x2: (i ? -0.04 : 0.06) * s,
          y2: y * s,
          stroke: d,
          width: 0.04 * s,
          cap: 'round',
        })),
      ],
    }),
  } satisfies ObjectDefinition,
};
