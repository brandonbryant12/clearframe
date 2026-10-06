import { round, tall } from '../../film/sketch-kit.mjs';

export default {
  name: 'evidence-desk',
  order: 65,
  summary: 'Two annotated manuscript leaves separate an observation from the inference drawn from it.',
  use: 'Research investigations and report adaptations. Paper and annotations are qualitative, not fabricated report pages or data.',
  build(w, h) {
    const vertical = tall(w, h), short = Math.min(w, h);
    const pw = vertical ? w * 0.7 : w * 0.34, ph = vertical ? h * 0.28 : h * 0.54;
    const leaves = vertical
      ? [[w * 0.47, h * 0.34, -4], [w * 0.55, h * 0.68, 3]]
      : [[w * 0.29, h * 0.53, -4], [w * 0.73, h * 0.55, 3]];
    const elements = [
      { type: 'ellipse', cx: w * 0.52, cy: h * 0.53, rx: w * 0.42, ry: h * 0.33,
        fill: 'wash', opacity: 0.65, at: 0, enter: 'none' },
      { type: 'path', d: vertical
        ? `M ${w * 0.79} ${h * 0.36} C ${w * 0.95} ${h * 0.42} ${w * 0.93} ${h * 0.57} ${w * 0.81} ${h * 0.65}`
        : `M ${w * 0.42} ${h * 0.7} C ${w * 0.49} ${h * 0.82} ${w * 0.59} ${h * 0.8} ${w * 0.64} ${h * 0.74}`,
        fill: 'none', stroke: 'accent', width: 4, dash: [9, 12], arrow: 'end', head: 16,
        at: 1.4, enter: 'draw', dur: 1.2 },
    ];
    leaves.forEach(([cx, cy, angle], i) => {
      const x = round(cx - pw / 2), y = round(cy - ph / 2);
      elements.push({ type: 'group', origin: [cx, cy], rotate: angle, at: 0, enter: 'none',
        shadow: { dx: 8, dy: 14, blur: 20, opacity: 0.14 }, children: [
          { type: 'poly', points: [[x, y], [x + pw, y + 8], [x + pw - 8, y + ph], [x + 5, y + ph - 8]],
            fill: 'bg', stroke: 'line', width: 2, at: 0, enter: 'none' },
          { type: 'line', x1: x + pw * 0.11, y1: y + ph * 0.17, x2: x + pw * 0.88, y2: y + ph * 0.17,
            stroke: 'ink', width: 3, at: 0, enter: 'none' },
          { type: 'text', text: i ? 'INFERRED' : 'OBSERVED', x: x + pw * 0.11, y: y + ph * 0.32,
            font: 'mono', size: short * 0.03, fit: pw * 0.78, fill: 'muted', at: 0, enter: 'none' },
          { type: 'text', text: i ? 'Why it changed' : 'What changed', x: x + pw * 0.11, y: y + ph * 0.47,
            font: 'serif-display', size: short * 0.056, fit: pw * 0.78, fill: 'ink', at: 0.35 + i * 0.65,
            enter: 'wipe', dur: 0.65 },
          ...[0.59, 0.66, 0.73, 0.8].map((row, j) => ({ type: 'line',
            x1: x + pw * 0.11, y1: y + ph * row, x2: x + pw * (j === 3 ? 0.57 : 0.83), y2: y + ph * row,
            stroke: 'line', width: 3, at: 0, enter: 'none' })),
          { type: 'path', d: `M ${x + pw * 0.1} ${y + ph * 0.505} Q ${x + pw * 0.45} ${y + ph * 0.54} ${x + pw * 0.89} ${y + ph * 0.5}`,
            fill: 'none', stroke: i ? 'accent2' : 'accent', width: 5, at: 1 + i * 0.65, enter: 'draw', dur: 0.65 },
          { type: 'rect', x: x + pw * 0.42, y: y - 15, w: pw * 0.18, h: 32,
            fill: 'accent2', opacity: 0.6, rotate: -5, origin: [cx, y], at: 0, enter: 'none' },
        ] });
    });
    return { elements };
  },
};
