import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects1 = {
  doc: {
    about:
      'a page with a folded corner and lines of text: a report, a ticket body, a file, a document',
    extent: [0.36, 0.5],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.36 * s, y: -0.5 * s, w: 0.72 * s, h: s, r: 0.05 * s },
      details: [
        {
          type: 'poly',
          points: [
            [0.16 * s, -0.5 * s],
            [0.36 * s, -0.3 * s],
            [0.16 * s, -0.3 * s],
          ],
          closed: true,
          fill: d,
          opacity: 0.85,
        },
        ...[-0.16, -0.02, 0.12, 0.26].map<CanvasElement>((y, i) => ({
          type: 'line',
          x1: -0.22 * s,
          y1: y * s,
          x2: (i === 3 ? 0.06 : 0.2) * s,
          y2: y * s,
          stroke: d,
          width: 0.045 * s,
          cap: 'round',
        })),
      ],
    }),
  } satisfies ObjectDefinition,
  bubble: {
    about:
      'a speech bubble: a message, a request, a complaint, a reply, a chat',
    extent: [0.5, 0.44],
    draw: (s, d, c): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.44 * s, w: s, h: 0.7 * s, r: 0.3 * s },
      details: [
        {
          type: 'poly',
          points: [
            [-0.3 * s, 0.2 * s],
            [-0.06 * s, 0.2 * s],
            [-0.36 * s, 0.44 * s],
          ],
          closed: true,
          fill: c,
          body: true,
        },
        ...[-0.2, 0, 0.2].map<CanvasElement>((x) => ({
          type: 'circle',
          cx: x * s,
          cy: -0.09 * s,
          r: 0.06 * s,
          fill: d,
        })),
      ],
    }),
  } satisfies ObjectDefinition,
  phone: {
    about:
      'a phone with its screen lit: a user, an app, a notification, mobile',
    extent: [0.28, 0.5],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.28 * s, y: -0.5 * s, w: 0.56 * s, h: s, r: 0.09 * s },
      details: [
        {
          type: 'rect',
          x: -0.22 * s,
          y: -0.38 * s,
          w: 0.44 * s,
          h: 0.7 * s,
          r: 0.03 * s,
          fill: d,
          opacity: 0.9,
        },
        {
          type: 'line',
          x1: -0.07 * s,
          y1: 0.42 * s,
          x2: 0.07 * s,
          y2: 0.42 * s,
          stroke: d,
          width: 0.035 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
};
