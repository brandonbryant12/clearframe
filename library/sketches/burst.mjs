import { tall, round } from '../../film/sketch-kit.mjs';

export default {
  name: 'burst',
  order: 6,
  summary: 'One word lands big: it wipes on, an underline draws, short rays pop around it.',
  use: 'A key term, a verdict, a surprising word the narration stresses.',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h / 2),
      size = tall(w, h) ? 170 : 230,
      half = size * 1.55;
    // Rays sit on an ellipse clear of the word and skip the horizontal, where they would strike through it.
    const angles = [-70, -40, -12, 12, 40, 70, 110, 140, 168, 192, 220, 250].filter(
      d => Math.abs(Math.sin((d * Math.PI) / 180)) > 0.3,
    );
    const rays = angles.map((d, i) => {
      const a = (d * Math.PI) / 180,
        rx = half * 1.12,
        ry = size * 0.95;
      return {
        type: 'line',
        x1: round(cx + rx * Math.cos(a)),
        y1: round(cy + ry * Math.sin(a)),
        x2: round(cx + rx * 1.18 * Math.cos(a)),
        y2: round(cy + ry * 1.3 * Math.sin(a)),
        stroke: i % 2 ? 'accent2' : 'accent',
        width: 8,
        dur: 0.35,
      };
    });
    return {
      elements: [
        {
          type: 'text',
          text: 'Enough',
          x: cx,
          y: round(cy + size * 0.34),
          size,
          anchor: 'middle',
          font: 'bold',
          fill: 'ink',
          enter: 'wipe',
          at: 0.2,
          dur: 0.6,
        },
        {
          type: 'path',
          d: `M ${round(cx - half * 0.8)} ${round(cy + size * 0.55)} Q ${cx} ${round(cy + size * 0.75)} ${round(cx + half * 0.8)} ${round(cy + size * 0.5)}`,
          stroke: 'accent',
          width: 12,
          at: 0.7,
          dur: 0.6,
        },
        { type: 'group', at: 1.0, stagger: 0.04, children: rays, glow: { blur: 10, opacity: 0.6 } },
      ],
    };
  },
};
