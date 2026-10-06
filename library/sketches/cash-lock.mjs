import { body, tall, round } from '../../film/sketch-kit.mjs';

export default {
  name: 'cash-lock',
  order: 60,
  summary: 'A payment waits at a clearing gate, then travels into available cash. Timing is the mechanism.',
  use: 'Cash conversion, settlement and treasury explainers. A qualitative illustration, never a scaled flow chart.',
  build(w, h) {
    const r = body(w, h), vertical = tall(w, h);
    const point = u => vertical
      ? [round(w / 2), round(r.y + r.h * u)]
      : [round(r.x + r.w * u), round(r.y + r.h * 0.48)];
    const [ax, ay] = point(0.13), [gx, gy] = point(0.5), [bx, by] = point(0.87);
    const d = `M ${ax} ${ay} L ${bx} ${by}`;
    const label = (text, x, y, at = 0) => ({ type: 'text', text, x, y, size: 44,
      anchor: 'middle', fit: vertical ? 420 : 360, font: 'semibold', fill: 'ink', at, enter: at ? 'rise' : 'none' });
    return {
      dolly: [{ at: 0, z: 0.055, dur: 6 }],
      elements: [
        { type: 'ellipse', cx: gx, cy: gy, rx: vertical ? r.w * 0.5 : r.w * 0.4,
          ry: vertical ? r.h * 0.42 : r.h * 0.45, fill: 'none', stroke: 'line', width: 2,
          z: 4, at: 0, enter: 'none' },
        { type: 'path', d, fill: 'none', stroke: 'surface', width: 72, cap: 'round', at: 0, enter: 'none' },
        { type: 'path', d, fill: 'none', stroke: 'muted', width: 3, dash: [9, 14],
          at: 0, enter: 'none', opacity: 0.5, loop: { type: 'dash', period: 3 } },
        ...[[ax, ay, 'accent'], [bx, by, 'accent2']].map(([cx, cy, fill]) => ({
          type: 'circle', cx, cy, r: 46, fill: 'surface', stroke: fill, width: 5, at: 0, enter: 'none',
        })),
        label('RECEIVABLE', ax, ay - 85),
        label('AVAILABLE', bx, by + 108),
        { type: 'group', at: 0, enter: 'none', origin: [gx, gy],
          keys: [{ at: 2.5, ...(vertical ? { x: 145 } : { y: -145 }), dur: 0.8, ease: 'inOut' }],
          children: [
            { type: 'rect', x: gx - (vertical ? 92 : 14), y: gy - (vertical ? 14 : 92),
              w: vertical ? 184 : 28, h: vertical ? 28 : 184, r: 12, fill: 'accent', at: 0, enter: 'none' },
          ] },
        { ...label('CLEARING', vertical ? gx - 260 : gx, vertical ? gy + 15 : gy + 112), fit: vertical ? 280 : 360 },
        { type: 'circle', cx: ax, cy: ay, r: 19, fill: 'accent', at: 0, enter: 'none',
          keys: [
            { at: 0.25, x: (vertical ? gx : gx - 48) - ax, y: (vertical ? gy - 48 : gy) - ay, dur: 1.3, ease: 'out' },
            { at: 3.2, x: bx - ax, y: by - ay, dur: 1.6, ease: 'inOut' },
          ] },
        { type: 'circle', cx: bx, cy: by, r: 61, fill: 'none', stroke: 'accent2', width: 3,
          opacity: 0.6, at: 4.8, enter: 'draw', dur: 0.5, loop: { type: 'pulse', period: 3, amount: 0.07 } },
      ],
    };
  },
};
