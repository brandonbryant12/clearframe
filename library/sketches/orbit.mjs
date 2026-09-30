import { round, body } from '../../fframes/sketch-kit.mjs';

export default {
  name: 'orbit',
  order: 1,
  summary: 'A system around a centre: rings draw, satellites circle at different speeds.',
  use: 'Ecosystems, stakeholders around a product, forces around a decision.',
  build(w, h) {
    const r = body(w, h),
      cx = round(r.x + r.w / 2),
      cy = round(r.y + r.h / 2),
      R = (Math.min(r.w, r.h) / 2) * 0.92;
    const rings = [0.45, 0.72, 1].map(k => round(R * k));
    return {
      elements: [
        ...rings.map((rad, i) => ({
          type: 'circle',
          cx,
          cy,
          r: rad,
          fill: 'none',
          stroke: 'line',
          width: 3,
          at: 0.2 + i * 0.15,
          dur: 1,
        })),
        {
          type: 'circle',
          cx,
          cy,
          r: round(R * 0.26),
          fill: 'accent',
          at: 0.3,
          glow: { blur: 22, opacity: 0.7 },
          loop: { type: 'pulse', period: 2.4, amount: 0.04 },
        },
        {
          type: 'text',
          text: 'Core',
          x: cx,
          y: round(cy + 16),
          size: 46,
          anchor: 'middle',
          font: 'bold',
          fill: 'bg',
          at: 0.5,
        },
        ...rings.flatMap((rad, i) =>
          [0, 1].map(j => ({
            type: 'circle',
            cx: round(cx + rad * Math.cos(j * Math.PI + i)),
            cy: round(cy + rad * Math.sin(j * Math.PI + i)),
            r: 18 - i * 3,
            fill: j ? 'accent2' : 'ink',
            origin: [cx, cy],
            at: round(0.9 + i * 0.2 + j * 0.1),
            loop: { type: 'spin', period: 7 + i * 4, amount: i % 2 ? -1 : 1 },
          })),
        ),
      ],
    };
  },
};
