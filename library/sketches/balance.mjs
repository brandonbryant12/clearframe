import { tall, round, body } from '../../film/sketch-kit.mjs';

export default {
  name: 'balance',
  order: 4,
  summary: 'A metaphor that moves: a beam tips toward the heavier side on a spoken cue.',
  use: 'Trade-offs, risk versus reward, costs outweighing benefits.',
  build(w, h) {
    const r = body(w, h),
      cx = round(r.x + r.w / 2),
      base = round(r.y + r.h * (tall(w, h) ? 0.7 : 0.95)),
      span = Math.min(r.w * 0.8, 1100),
      top = round(base - Math.min(r.h * 0.55, 340));
    const pan = (x, label, color) => ({
      type: 'group',
      children: [
        { type: 'line', x1: x, y1: top, x2: x, y2: round(top + 120), stroke: 'muted', width: 4, enter: 'fade' },
        {
          type: 'path',
          d: `M ${round(x - 110)} ${round(top + 120)} Q ${x} ${round(top + 200)} ${round(x + 110)} ${round(top + 120)} Z`,
          fill: color,
          enter: 'fade',
        },
        {
          type: 'text',
          text: label,
          x,
          y: round(top + 250),
          size: 40,
          anchor: 'middle',
          font: 'semibold',
          fill: 'ink',
          enter: 'fade',
        },
      ],
    });
    const left = round(cx - span / 2),
      right = round(cx + span / 2);
    return {
      elements: [
        {
          type: 'poly',
          points: [
            [cx, top],
            [round(cx - 90), base],
            [round(cx + 90), base],
          ],
          closed: true,
          fill: 'surface',
          at: 0.2,
        },
        {
          type: 'group',
          at: 0.5,
          origin: [cx, top],
          keys: [{ at: 1.6, rotate: -9, dur: 0.9, ease: 'spring' }],
          children: [
            {
              type: 'rect',
              x: left,
              y: round(top - 8),
              w: round(span),
              h: 16,
              r: 8,
              fill: 'ink',
              enter: 'grow-x',
              origin: [cx, top],
            },
            pan(left, 'Cost', 'accent2'),
            pan(right, 'Benefit', 'accent'),
          ],
        },
        { type: 'circle', cx, cy: top, r: 14, fill: 'accent', at: 0.4 },
      ],
    };
  },
};
