import { round } from '../../fframes/sketch-kit.mjs';

export default {
  name: 'ambient',
  order: 7,
  summary: "Soft, slowly drifting shapes for a beat's art.under layer: depth without distraction.",
  use: 'Behind statements, quotes and kinetic type so a held frame never looks frozen.',
  build(w, h) {
    const blobs = [
      [0.15, 0.2, 0.22, 'accent'],
      [0.82, 0.3, 0.3, 'accent2'],
      [0.7, 0.85, 0.2, 'accent'],
      [0.3, 0.8, 0.16, 'accent2'],
      [0.5, 0.45, 0.12, 'ink'],
    ];
    return {
      layer: 'under',
      elements: [
        // A few specks of dust drift through: the held frame is never perfectly still.
        { type: 'particles', x: 0, y: 0, w, h, kind: 'dust', count: 36, fill: 'ink', opacity: 0.35, size: 3, at: 0 },
        ...blobs.map(([u, v, k, color], i) => ({
          type: 'circle',
          cx: round(u * w),
          cy: round(v * h),
          r: round(k * Math.max(w, h)),
          fill: { gradient: [color, color], radial: true, fade: true },
          opacity: 0.3,
          enter: 'fade',
          at: 0,
          dur: 1.2,
          loop: { type: i % 2 ? 'float' : 'orbit', period: 9 + i * 2.5, amount: 18 + i * 4 },
        })),
      ],
    };
  },
};
