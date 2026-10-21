import type { CanvasElement } from '../types.mjs';
import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects3 = {
  box: {
    about:
      'a parcel with its lid and tape: a delivery, a package, a release, a shipment',
    extent: [0.41, 0.4],
    draw: (s, d): CastDrawing => ({
      body: {
        x: -0.41 * s,
        y: -0.35 * s,
        w: 0.82 * s,
        h: 0.75 * s,
        r: 0.04 * s,
      },
      details: [
        {
          type: 'line',
          x1: -0.41 * s,
          y1: -0.14 * s,
          x2: 0.41 * s,
          y2: -0.14 * s,
          stroke: d,
          width: 0.035 * s,
        },
        {
          type: 'rect',
          x: -0.06 * s,
          y: -0.35 * s,
          w: 0.12 * s,
          h: 0.75 * s,
          fill: d,
          opacity: 0.55,
        },
      ],
    }),
  } satisfies ObjectDefinition,
  server: {
    about:
      'a server rack with three lit units: a backend, infrastructure, a service, compute',
    extent: [0.36, 0.5],
    draw: (s, d): CastDrawing => ({
      body: { x: -0.36 * s, y: -0.5 * s, w: 0.72 * s, h: s, r: 0.05 * s },
      details: [
        ...[-0.17, 0.16].map<CanvasElement>((y) => ({
          type: 'line',
          x1: -0.36 * s,
          y1: y * s,
          x2: 0.36 * s,
          y2: y * s,
          stroke: d,
          width: 0.03 * s,
        })),
        ...[-0.33, 0, 0.33].flatMap<CanvasElement>((y) => [
          {
            type: 'line',
            x1: -0.24 * s,
            y1: y * s,
            x2: 0.04 * s,
            y2: y * s,
            stroke: d,
            width: 0.05 * s,
            cap: 'round',
          },
          { type: 'circle', cx: 0.2 * s, cy: y * s, r: 0.05 * s, fill: d },
        ]),
      ],
    }),
  } satisfies ObjectDefinition,
  database: {
    about:
      'a database cylinder: stored data, records, a warehouse, the source of truth',
    extent: [0.38, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: {
        x: -0.38 * s,
        y: -0.38 * s,
        w: 0.76 * s,
        h: 0.8 * s,
        r: 0.06 * s,
      },
      details: [
        {
          type: 'ellipse',
          cx: 0,
          cy: -0.38 * s,
          rx: 0.38 * s,
          ry: 0.12 * s,
          fill: c,
          body: true,
        },
        {
          type: 'ellipse',
          cx: 0,
          cy: -0.38 * s,
          rx: 0.3 * s,
          ry: 0.07 * s,
          fill: 'none',
          stroke: d,
          width: 0.03 * s,
        },
        ...[-0.06, 0.18].map<CanvasElement>((y) => ({
          type: 'line',
          x1: -0.38 * s,
          y1: y * s,
          x2: 0.38 * s,
          y2: y * s,
          stroke: d,
          width: 0.035 * s,
        })),
      ],
    }),
  } satisfies ObjectDefinition,
};
