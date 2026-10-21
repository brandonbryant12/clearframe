import type { ObjectDefinition, CastDrawing } from './contracts.mjs';
export const objects4 = {
  cloud: {
    about:
      'a cloud: a hosted service, the internet, somewhere else, an outside system',
    extent: [0.5, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: { x: -0.5 * s, y: -0.1 * s, w: s, h: 0.42 * s, r: 0.21 * s },
      details: [
        {
          type: 'circle',
          cx: -0.16 * s,
          cy: -0.1 * s,
          r: 0.24 * s,
          fill: c,
          body: true,
        },
        {
          type: 'circle',
          cx: 0.16 * s,
          cy: -0.18 * s,
          r: 0.3 * s,
          fill: c,
          body: true,
        },
      ],
    }),
  } satisfies ObjectDefinition,
  coin: {
    about: 'a coin: money, cost, price, revenue, a payment',
    extent: [0.42, 0.42],
    draw: (s, d): CastDrawing => ({
      body: {
        x: -0.42 * s,
        y: -0.42 * s,
        w: 0.84 * s,
        h: 0.84 * s,
        r: 0.42 * s,
      },
      details: [
        {
          type: 'circle',
          cx: 0,
          cy: 0,
          r: 0.31 * s,
          fill: 'none',
          stroke: d,
          width: 0.035 * s,
        },
        {
          type: 'text',
          text: '$',
          x: 0,
          y: 0.15 * s,
          size: 0.42 * s,
          font: 'strong',
          fill: d,
          anchor: 'middle',
        },
      ],
    }),
  } satisfies ObjectDefinition,
  lock: {
    about:
      'a padlock: security, permission, privacy, something closed until it is unlocked',
    extent: [0.36, 0.5],
    draw: (s, d, c): CastDrawing => ({
      body: {
        x: -0.36 * s,
        y: -0.08 * s,
        w: 0.72 * s,
        h: 0.58 * s,
        r: 0.08 * s,
      },
      details: [
        {
          type: 'path',
          d: `M ${-0.22 * s} ${-0.08 * s} L ${-0.22 * s} ${-0.24 * s} C ${-0.22 * s} ${-0.56 * s} ${0.22 * s} ${-0.56 * s} ${0.22 * s} ${-0.24 * s} L ${0.22 * s} ${-0.08 * s}`,
          fill: 'none',
          stroke: c,
          width: 0.1 * s,
          cap: 'round',
        },
        { type: 'circle', cx: 0, cy: 0.14 * s, r: 0.08 * s, fill: d },
        {
          type: 'rect',
          x: -0.03 * s,
          y: 0.16 * s,
          w: 0.06 * s,
          h: 0.16 * s,
          r: 0.02 * s,
          fill: d,
        },
      ],
    }),
  } satisfies ObjectDefinition,
};
