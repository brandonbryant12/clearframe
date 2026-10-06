import { tall, round, body } from '../../film/sketch-kit.mjs';

export default {
  name: 'pipeline',
  order: 2,
  summary: 'Connected stages: cards pop in order, dashed connectors march between them.',
  use: 'How data or work flows; a handoff chain; cause and effect.',
  build(w, h) {
    const r = body(w, h),
      labels = ['Collect', 'Clean', 'Model', 'Ship'],
      n = labels.length,
      vert = tall(w, h);
    const cw = vert ? r.w * 0.7 : (r.w - 90 * (n - 1)) / n,
      ch = vert ? (r.h - 70 * (n - 1)) / n : 170;
    const pos = i => (vert ? [r.x + (r.w - cw) / 2, r.y + i * (ch + 70)] : [r.x + i * (cw + 90), r.y + (r.h - ch) / 2]);
    const els = [];
    labels.forEach((label, i) => {
      const [x, y] = pos(i),
        at = round(0.3 + i * 0.5);
      els.push({
        type: 'group',
        at,
        children: [
          {
            type: 'rect',
            x: round(x),
            y: round(y),
            w: round(cw),
            h: round(ch),
            r: 28,
            fill: i === n - 1 ? 'accent' : 'surface',
            enter: 'pop',
          },
          {
            type: 'text',
            text: label,
            x: round(x + cw / 2),
            y: round(y + ch / 2 + 16),
            size: 44,
            anchor: 'middle',
            font: 'bold',
            fill: i === n - 1 ? 'bg' : 'ink',
            enter: 'fade',
          },
        ],
      });
      if (i < n - 1) {
        const [nx, ny] = pos(i + 1);
        const line = vert
          ? { x1: round(x + cw / 2), y1: round(y + ch + 10), x2: round(nx + cw / 2), y2: round(ny - 10) }
          : { x1: round(x + cw + 10), y1: round(y + ch / 2), x2: round(nx - 10), y2: round(ny + ch / 2) };
        els.push({
          type: 'line',
          ...line,
          stroke: 'accent',
          width: 6,
          dash: [14, 12],
          arrow: 'end',
          at: round(at + 0.3),
          dur: 0.4,
          enter: 'fade',
          loop: { type: 'dash', period: 0.8 },
        });
      }
    });
    return { elements: els };
  },
};
