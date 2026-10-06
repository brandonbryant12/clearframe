import { round } from '../../film/sketch-kit.mjs';

// A turning globe: a graticule on a dark body, places marked, and routes that lift off the
// surface and draw on one after another. The places are real cities; the routes between
// them are illustrative until you replace them with real ones.
const PLACES = {
  london: [51.5, -0.1],
  newYork: [40.7, -74],
  lagos: [6.5, 3.4],
  saoPaulo: [-23.5, -46.6],
  singapore: [1.35, 103.8],
  tokyo: [35.7, 139.7],
};
const ROUTES = [
  ['london', 'newYork'],
  ['london', 'lagos'],
  ['lagos', 'saoPaulo'],
  ['london', 'singapore'],
  ['singapore', 'tokyo'],
];

export default {
  name: 'globe',
  order: 18,
  summary:
    'A turning globe: graticule on a dark body, places marked, routes lifting off the surface and drawing on in turn.',
  use: 'Global stories: trade, travel, spread, supply chains, "everywhere at once". Replace PLACES and ROUTES with real ones (they are [lat, lon]).',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h * 0.52),
      size = round(Math.min(w, h) * 0.36);
    return {
      elements: [
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'stars',
          count: 120,
          fill: 'ink',
          opacity: 0.55,
          size: 2,
          at: 0,
          enter: 'fade',
          dur: 1.5,
        },
        {
          type: 'circle',
          cx,
          cy,
          r: round(size * 1.18),
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.28,
          at: 0.1,
          enter: 'fade',
          dur: 1.5,
        },
        {
          type: 'solid',
          shape: 'globe',
          cx,
          cy,
          size,
          spin: [0, 9, 0],
          tilt: [-22, -20],
          perspective: 0.15,
          fill: 'bg',
          stroke: 'muted',
          width: 1.4,
          marks: Object.values(PLACES),
          arcs: ROUTES.map(([a, b]) => [...PLACES[a], ...PLACES[b]]),
          at: 0.2,
          dur: 1.8,
          glow: { blur: 8, opacity: 0.8 },
        },
      ],
    };
  },
};
