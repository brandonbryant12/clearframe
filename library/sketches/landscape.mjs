import { round } from '../../fframes/sketch-kit.mjs';

// A data landscape: rows of lit columns standing on a floor at increasing depth. Each
// column grows from its base (front, top and side faces converging on one vanishing
// point), the camera pushes in over them, and focus racks from the front row to the back.
// The heights are sample values: compute them from real data and give the beat a source.
const SAMPLE = [
  [0.35, 0.55, 0.42, 0.7, 0.5],
  [0.45, 0.62, 0.8, 0.58, 0.4],
  [0.3, 0.5, 0.66, 0.95, 0.6],
];

export default {
  name: 'landscape',
  order: 15,
  summary:
    'A data landscape: rows of lit 3D columns growing from a floor in depth, the camera pushing in, focus racking front to back.',
  use: 'Data as a place: regions, years or categories as a skyline of values. Replace SAMPLE heights with real values scaled to the tallest, and add a visible source.',
  build(w, h) {
    const horizon = h * 0.42,
      cx = w / 2,
      floorY = z => horizon + (h * 0.95 - horizon) / (1 + z),
      vp = [cx, horizon];
    const elements = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w,
        h: round(horizon),
        fill: { gradient: ['bg', 'surface'], angle: 90 },
        at: 0,
        dur: 0,
      },
      {
        type: 'rect',
        x: 0,
        y: round(horizon),
        w,
        h: round(h - horizon),
        fill: { gradient: ['surface', 'bg'], angle: 90 },
        at: 0,
        dur: 0,
      },
      {
        type: 'ellipse',
        cx: round(cx),
        cy: round(horizon),
        rx: round(w * 0.5),
        ry: round(h * 0.16),
        fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
        opacity: 0.25,
        at: 0,
        enter: 'fade',
        dur: 1.5,
      },
    ];
    // Back rows first, so nearer columns are drawn over farther ones.
    [...SAMPLE].reverse().forEach((row, r) => {
      // Rows well apart in depth, each back row shifted half a gap so it stands in the gaps.
      const back = SAMPLE.length - 1 - r,
        depth = back * 1.5,
        k = 1 / (1 + depth),
        base = floorY(depth),
        colW = w * 0.075 * k,
        gap = w * 0.19 * k,
        maxH = h * 0.5 * k;
      row.forEach((v, i) => {
        const x = cx + (i - (row.length - 1) / 2 + (back % 2 ? 0.5 : 0)) * gap - colW / 2,
          top = base - v * maxH,
          toward = ([px, py], f = 0.12) => [px + (vp[0] - px) * f, py + (vp[1] - py) * f];
        const ftl = [x, top],
          ftr = [x + colW, top],
          fbl = [x, base],
          fbr = [x + colW, base];
        const left = x + colW / 2 < cx;
        const pts = ps => ps.map(p => p.map(round));
        const hero = r === SAMPLE.length - 1 && v === Math.max(...row);
        elements.push({
          type: 'group',
          z: round(depth * 100) / 100,
          origin: [round(x + colW / 2), round(base)],
          enter: 'grow-y',
          at: round(0.3 + r * 0.25 + i * 0.08),
          dur: 0.9,
          children: [
            // The visible side faces the vanishing point.
            {
              type: 'poly',
              points: pts(left ? [ftr, fbr, toward(fbr), toward(ftr)] : [ftl, fbl, toward(fbl), toward(ftl)]),
              fill: hero ? 'accent' : 'accent2',
              opacity: 0.55,
              stroke: 'none',
              at: 0,
              dur: 0,
            },
            {
              type: 'poly',
              points: pts([ftl, ftr, toward(ftr), toward(ftl)]),
              fill: 'ink',
              opacity: 0.3,
              stroke: 'none',
              at: 0,
              dur: 0,
            },
            {
              type: 'rect',
              x: round(x),
              y: round(top),
              w: round(colW),
              h: round(base - top),
              fill: hero ? 'accent' : 'accent2',
              at: 0,
              dur: 0,
              ...(hero ? { glow: { blur: 14 } } : {}),
            },
          ],
        });
      });
    });
    return {
      dolly: [{ at: 0.2, z: 0.6, dur: 9, ease: 'out' }],
      focus: { z: 0, aperture: 0.8, keys: [{ at: 2.2, z: 2.2, dur: 1.6 }] },
      elements,
    };
  },
};
