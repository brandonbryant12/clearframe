import { round } from '../../fframes/sketch-kit.mjs';

export default {
  name: 'niche',
  order: 8,
  summary:
    'A mosaic niche: an arch of sky that turns from dusk to night, a moon laid in rings, a tiled sea, a sill and a beaded border.',
  use: 'Stories and places in the mosaic treatment: set a subject in the niche (a tower, a tree, a figure) and let the sky change with the story.',
  build(w, h) {
    const m = Math.min(w, h),
      cx = w / 2;
    const aw = m * 0.66,
      ax = cx - aw / 2,
      top = h * 0.5 - m * 0.44,
      sill = h * 0.5 + m * 0.4;
    const r = aw / 2,
      spring = top + r;
    const arch = `M ${round(ax)} ${round(sill)} L ${round(ax)} ${round(spring)} A ${round(r)} ${round(r)} 0 0 1 ${round(ax + aw)} ${round(spring)} L ${round(ax + aw)} ${round(sill)} Z`;
    const sea = sill - m * 0.18;
    return {
      elements: [
        {
          type: 'rect',
          x: round(cx - m * 0.46),
          y: round(h / 2 - m * 0.46),
          w: round(m * 0.92),
          h: round(m * 0.92),
          fill: 'none',
          stroke: 'accent',
          mosaic: { tile: 10 },
          enter: 'draw',
          at: 0,
          dur: 1.4,
        },
        {
          type: 'path',
          d: arch,
          fill: { gradient: ['#4a6fd0', '#f2c27a', '#e98a5a'] },
          stroke: 'ink',
          mosaic: {
            tile: 16,
            flow: 'contour',
            axis: 90,
            glint: 0.12,
            recolor: [{ at: 2.2, dur: 2, axis: 90, fill: { gradient: ['#101a78', '#2233a8'] } }],
          },
          enter: 'assemble',
          at: 0.2,
          dur: 1.8,
        },
        {
          type: 'rect',
          x: round(ax),
          y: round(sea),
          w: round(aw),
          h: round(sill - sea),
          fill: { gradient: ['#3cc0b4', '#1c5a8c'] },
          mosaic: { tile: 14, axis: 90, outline: false, glint: 0.6 },
          enter: 'assemble',
          at: 0.8,
          dur: 1.4,
        },
        {
          type: 'rect',
          x: round(ax - m * 0.02),
          y: round(sill),
          w: round(aw + m * 0.04),
          h: round(m * 0.04),
          fill: { gradient: ['#cfd3dc', '#6b7280'] },
          mosaic: { tile: 12, axis: 90, outline: false },
          enter: 'assemble',
          at: 0.3,
          dur: 1,
        },
        {
          type: 'circle',
          cx: round(ax + aw * 0.28),
          cy: round(top + r * 0.62),
          r: round(m * 0.07),
          fill: 'accent',
          mosaic: { tile: 11, flow: 'rings', glint: 0.4, build: 'fly', from: [round(cx), round(sea)], spread: 160 },
          enter: 'assemble',
          at: 2.2,
          dur: 1.4,
          glow: { blur: 22, opacity: 0.7 },
        },
      ],
    };
  },
};
