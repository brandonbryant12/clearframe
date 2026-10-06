import { body, round, tall } from '../../film/sketch-kit.mjs';

export default {
  name: 'risk-lens',
  order: 62,
  summary: 'A lens travels over the same asset to reveal access, price and loss as different questions.',
  use: 'Risk explanations and product education. A qualitative inspection metaphor, with no implied risk score.',
  build(w, h) {
    const r = body(w, h), vertical = tall(w, h);
    const centers = [0.17, 0.5, 0.83].map(v => vertical
      ? [round(r.x + r.w * 0.4), round(r.y + r.h * v)]
      : [round(r.x + r.w * (0.2 + (v - 0.17) / 0.66 * 0.6)), round(r.y + r.h * 0.5)]);
    const [firstX, firstY] = centers[0], [lastX, lastY] = centers[2];
    const radius = Math.min(vertical ? 108 : 125, r.w * 0.12);
    return {
      dolly: [{ at: 0, z: 0.05, dur: 6 }],
      elements: [
        { type: 'ellipse', cx: vertical ? firstX : w / 2, cy: round(r.y + r.h * 0.5),
          rx: vertical ? radius * 1.6 : r.w * 0.47, ry: vertical ? r.h * 0.48 : radius * 1.6,
          fill: 'none', stroke: 'line', width: 2, z: 4, at: 0, enter: 'none' },
        { type: 'line', x1: firstX, y1: firstY, x2: lastX, y2: lastY, stroke: 'line', width: 2, at: 0, enter: 'none' },
        ...centers.flatMap(([cx, cy], i) => [
          { type: 'circle', cx, cy, r: radius * 0.7, fill: 'surface', stroke: 'muted', width: 2,
            at: 0, enter: 'none' },
          { type: 'text', text: ['ACCESS', 'PRICE', 'LOSS'][i], x: vertical ? cx + radius + 65 : cx,
            y: vertical ? cy + 15 : cy + radius + 85, size: 42, fit: radius * 2.45,
            anchor: vertical ? 'start' : 'middle', font: 'semibold', fill: 'ink', at: 0.3 + i * 0.35 },
        ]),
        // One object, three inspection details. Nothing here encodes a probability or quantity.
        { type: 'path', d: `M ${firstX - 24} ${firstY + 24} L ${firstX - 24} ${firstY - 13} Q ${firstX} ${firstY - 54} ${firstX + 24} ${firstY - 13} L ${firstX + 24} ${firstY + 24}`,
          fill: 'none', stroke: 'ink', width: 6, at: 0, enter: 'none' },
        { type: 'path', d: `M ${centers[1][0] - 38} ${centers[1][1] + 10} L ${centers[1][0] - 13} ${centers[1][1] - 18} L ${centers[1][0] + 7} ${centers[1][1] + 22} L ${centers[1][0] + 38} ${centers[1][1] - 18}`,
          fill: 'none', stroke: 'ink', width: 6, at: 0, enter: 'none' },
        { type: 'path', d: `M ${lastX - 35} ${lastY - 24} L ${lastX + 30} ${lastY + 28} M ${lastX + 30} ${lastY + 28} L ${lastX + 2} ${lastY + 26} M ${lastX + 30} ${lastY + 28} L ${lastX + 26} ${lastY}`,
          fill: 'none', stroke: 'ink', width: 6, at: 0, enter: 'none' },
        { type: 'group', at: 0, enter: 'none', origin: [firstX, firstY],
          keys: [{ at: 1.6, x: centers[1][0] - firstX, y: centers[1][1] - firstY, dur: 0.8, ease: 'inOut' },
            { at: 3.5, x: lastX - firstX, y: lastY - firstY, dur: 0.8, ease: 'inOut' }],
          children: [
            { type: 'circle', cx: firstX, cy: firstY, r: radius, fill: 'none', stroke: 'accent', width: 8,
              at: 0, enter: 'none', glow: { blur: 10, opacity: 0.25 } },
            { type: 'line', x1: firstX + radius * 0.71, y1: firstY + radius * 0.71,
              x2: firstX + radius * 1.3, y2: firstY + radius * 1.3, stroke: 'accent', width: 14, cap: 'round', at: 0, enter: 'none' },
          ] },
      ],
    };
  },
};
