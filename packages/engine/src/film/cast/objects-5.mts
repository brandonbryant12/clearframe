import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects5 = {
  bulb: {
    about:
      'a light bulb: an idea, insight, a fix that occurs to someone, inspiration',
    extent: [0.32, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: {
        x: -0.32 * s,
        y: -0.5 * s,
        w: 0.64 * s,
        h: 0.64 * s,
        r: 0.32 * s,
      },
      details: [
        {
          type: 'rect',
          x: -0.15 * s,
          y: 0.12 * s,
          w: 0.3 * s,
          h: 0.28 * s,
          r: 0.05 * s,
          fill: c,
          body: true,
        },
        ...[0.22, 0.31].map<CanvasElement>((y) => ({
          type: 'line',
          x1: -0.13 * s,
          y1: y * s,
          x2: 0.13 * s,
          y2: y * s,
          stroke: d,
          width: 0.03 * s,
        })),
        {
          type: 'path',
          d: `M ${-0.08 * s} ${0.1 * s} L ${-0.08 * s} ${-0.06 * s} Q 0 ${-0.2 * s} ${0.08 * s} ${-0.06 * s} L ${0.08 * s} ${0.1 * s}`,
          fill: 'none',
          stroke: d,
          width: 0.035 * s,
          cap: 'round',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  clock: {
    about: 'a clock: time, waiting, a deadline, latency, a schedule',
    extent: [0.44, 0.44],
    draw: (s, d): CastDrawing => ({
      body: {
        x: -0.44 * s,
        y: -0.44 * s,
        w: 0.88 * s,
        h: 0.88 * s,
        r: 0.44 * s,
      },
      details: [
        ...[
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ].map<CanvasElement>(([x, y]) => ({
          type: 'line',
          x1: x * 0.3 * s,
          y1: y * 0.3 * s,
          x2: x * 0.36 * s,
          y2: y * 0.36 * s,
          stroke: d,
          width: 0.04 * s,
          cap: 'round',
        })),
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: -0.24 * s,
          stroke: d,
          width: 0.05 * s,
          cap: 'round',
        },
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 0.17 * s,
          y2: 0.06 * s,
          stroke: d,
          width: 0.05 * s,
          cap: 'round',
        },
        { type: 'circle', cx: 0, cy: 0, r: 0.05 * s, fill: d },
      ],
    }),
  } satisfies ObjectDefinition,
  envelope: {
    about:
      'an envelope: an email, a notification, an invitation, a message sent',
    extent: [0.5, 0.32],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.32 * s, w: s, h: 0.64 * s, r: 0.05 * s },
      details: [
        {
          type: 'poly',
          points: [
            [-0.46 * s, -0.28 * s],
            [0, 0.06 * s],
            [0.46 * s, -0.28 * s],
          ],
          closed: false,
          fill: 'none',
          stroke: d,
          width: 0.045 * s,
        },
      ],
    }),
  } satisfies ObjectDefinition,
};
