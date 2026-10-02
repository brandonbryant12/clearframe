import { body, round, tall } from '../../fframes/sketch-kit.mjs';

export default {
  name: 'scenario-fork',
  order: 61,
  summary: 'One starting point splits into labelled possible paths. Equal markers avoid implying probabilities.',
  use: 'Planning scenarios, sensitivity analysis and uncertain outcomes. Paths are conceptual, not forecasts or distributions.',
  build(w, h) {
    const r = body(w, h), vertical = tall(w, h);
    const start = [round(r.x + r.w * 0.1), round(r.y + r.h * 0.5)];
    const bend = round(r.x + r.w * 0.43), endX = round(r.x + r.w * (vertical ? 0.68 : 0.78));
    const ys = [0.17, 0.5, 0.83].map(v => round(r.y + r.h * v));
    const colors = ['accent2', 'ink', 'accent'];
    return {
      dolly: [{ at: 0, z: 0.045, dur: 6 }],
      elements: [
        { id: 'scenario-origin-glow', type: 'circle', cx: start[0], cy: start[1], r: 90, fill: 'none', stroke: 'line', width: 2,
          z: 4, at: 0, enter: 'none', loop: { type: 'pulse', period: 5, amount: 0.04 } },
        { id: 'scenario-origin-dot', type: 'circle', cx: start[0], cy: start[1], r: 25, fill: 'ink', at: 0, enter: 'none' },
        { id: 'scenario-origin-label', type: 'text', text: 'TODAY', x: start[0] + (vertical ? 40 : 0), y: start[1] + 94,
          size: 40, anchor: 'middle', fit: 200, font: 'semibold', fill: 'ink', at: 0, enter: 'none' },
        ...ys.flatMap((y, i) => {
          const d = `M ${start[0]} ${start[1]} C ${bend} ${start[1]} ${bend} ${y} ${endX} ${y}`;
          const at = round(0.25 + i * 0.42);
          return [
            { id: `scenario-track-${i}`, type: 'path', d, fill: 'none', stroke: 'surface', width: 26, at: 0, enter: 'none' },
            { id: `scenario-path-${i}`, type: 'path', d, fill: 'none', stroke: colors[i], width: 4, at, dur: 1.4, enter: 'draw',
              dash: i === 1 ? [12, 12] : undefined, loop: i === 1 ? { type: 'dash', period: 3 } : undefined },
            { id: `scenario-marker-${i}`, type: 'circle', cx: start[0], cy: start[1], r: 11, fill: colors[i], at: at + 1,
              enter: 'pop', along: { d, at: at + 1, dur: 2.2, ease: 'inOut' } },
            { id: `scenario-end-${i}`, type: 'circle', cx: endX, cy: y, r: 27, fill: 'bg', stroke: colors[i], width: 4,
              at: at + 1.3, enter: 'pop' },
            { id: `scenario-label-${i}`, type: 'text', text: ['UPSIDE', 'BASE', 'DOWNSIDE'][i],
              x: vertical ? endX - 10 : endX + 66, y: vertical ? y - 57 : y + 14,
              anchor: vertical ? 'middle' : 'start', size: 40, font: 'semibold', fill: colors[i], fit: vertical ? 320 : 300,
              at: at + 1.2, enter: 'rise' },
          ];
        }),
      ],
    };
  },
};
