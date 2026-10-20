import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects7 = {
  jar: {
    about:
      'a savings jar: savings, an account that fills, an HSA or FSA, a fund, a reserve',
    extent: [0.36, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: { x: -0.34 * s, y: -0.3 * s, w: 0.68 * s, h: 0.8 * s, r: 0.14 * s },
      details: [
        {
          type: 'rect',
          x: -0.36 * s,
          y: -0.46 * s,
          w: 0.72 * s,
          h: 0.16 * s,
          r: 0.04 * s,
          fill: d,
          opacity: 0.9,
        },
        {
          type: 'line',
          x1: -0.1 * s,
          y1: -0.38 * s,
          x2: 0.1 * s,
          y2: -0.38 * s,
          stroke: c,
          width: 0.04 * s,
          cap: 'round',
        },
        {
          type: 'line',
          x1: -0.2 * s,
          y1: -0.12 * s,
          x2: -0.2 * s,
          y2: 0.3 * s,
          stroke: d,
          width: 0.04 * s,
          cap: 'round',
          opacity: 0.6,
        },
      ],
    }),
  } satisfies ObjectDefinition,
  house: {
    about: 'a house: home, a mortgage, rent, family, where someone lives',
    extent: [0.46, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: {
        x: -0.36 * s,
        y: -0.06 * s,
        w: 0.72 * s,
        h: 0.56 * s,
        r: 0.03 * s,
      },
      details: [
        {
          type: 'poly',
          points: [
            [-0.46 * s, -0.04 * s],
            [0, -0.48 * s],
            [0.46 * s, -0.04 * s],
          ],
          closed: true,
          fill: c,
          body: true,
        },
        {
          type: 'rect',
          x: -0.08 * s,
          y: 0.18 * s,
          w: 0.16 * s,
          h: 0.32 * s,
          r: 0.02 * s,
          fill: d,
        },
        {
          type: 'rect',
          x: 0.16 * s,
          y: 0.06 * s,
          w: 0.12 * s,
          h: 0.12 * s,
          r: 0.01 * s,
          fill: d,
          opacity: 0.8,
        },
      ],
    }),
  } satisfies ObjectDefinition,
  badge: {
    about: 'an ID badge: an employee, a new hire, a login, identity, access',
    extent: [0.32, 0.5],
    draw: (s, d): CastDrawing => ({
      body: {
        x: -0.32 * s,
        y: -0.38 * s,
        w: 0.64 * s,
        h: 0.88 * s,
        r: 0.07 * s,
      },
      details: [
        {
          type: 'rect',
          x: -0.08 * s,
          y: -0.5 * s,
          w: 0.16 * s,
          h: 0.18 * s,
          r: 0.03 * s,
          fill: 'ink',
        },
        { type: 'circle', cx: 0, cy: -0.08 * s, r: 0.14 * s, fill: d },
        ...[0.18, 0.3].map<CanvasElement>((y, i) => ({
          type: 'line',
          x1: -0.18 * s,
          y1: y * s,
          x2: (i ? 0.08 : 0.18) * s,
          y2: y * s,
          stroke: d,
          width: 0.04 * s,
          cap: 'round',
        })),
      ],
    }),
  } satisfies ObjectDefinition,
};
