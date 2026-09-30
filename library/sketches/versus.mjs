import { tall, round, body } from '../../fframes/sketch-kit.mjs';

export default {
  name: 'versus',
  order: 5,
  summary: 'Two sides split by a drawn divider, each with an icon and a word; a badge lands in the middle.',
  use: 'Before and after, myth and fact, two options, us and them.',
  build(w, h) {
    const r = body(w, h),
      vert = tall(w, h),
      mid = vert ? round(r.y + r.h / 2) : round(r.x + r.w / 2);
    const side = (i, icon, word, color) => {
      const [x, y] = vert
        ? [round(r.x + r.w / 2), round(r.y + r.h * (i ? 0.75 : 0.25))]
        : [round(r.x + r.w * (i ? 0.75 : 0.25)), round(r.y + r.h / 2)];
      return {
        type: 'group',
        at: round(0.5 + i * 0.6),
        children: [
          { type: 'icon', name: icon, x, y: round(y - 70), size: 120, stroke: color },
          {
            type: 'text',
            text: word,
            x,
            y: round(y + 90),
            size: 76,
            anchor: 'middle',
            font: 'bold',
            fill: 'ink',
            enter: 'rise',
          },
        ],
      };
    };
    return {
      elements: [
        vert
          ? { type: 'line', x1: r.x, y1: mid, x2: r.x + r.w, y2: mid, stroke: 'line', width: 4, at: 0.2, dur: 0.8 }
          : { type: 'line', x1: mid, y1: r.y, x2: mid, y2: r.y + r.h, stroke: 'line', width: 4, at: 0.2, dur: 0.8 },
        side(0, 'clock', 'Waiting', 'muted'),
        side(1, 'bolt', 'Moving', 'accent'),
        {
          type: 'group',
          at: 1.6,
          children: [
            {
              type: 'circle',
              cx: vert ? round(r.x + r.w / 2) : mid,
              cy: vert ? mid : round(r.y + r.h / 2),
              r: 54,
              fill: 'accent2',
              enter: 'pop',
            },
            {
              type: 'text',
              text: 'vs',
              x: vert ? round(r.x + r.w / 2) : mid,
              y: (vert ? mid : round(r.y + r.h / 2)) + 14,
              size: 40,
              anchor: 'middle',
              font: 'bold',
              fill: 'bg',
              enter: 'fade',
            },
          ],
        },
      ],
    };
  },
};
