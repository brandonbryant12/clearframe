import { round, rng } from '../../film/sketch-kit.mjs';

// One person in a crowd: rows of simple silhouettes standing in depth, every row a little
// hazier, one figure lit in the accent. Focus starts on the front row and racks back to the
// one who matters. Figures are anonymous shapes, never a likeness of a real person.
export default {
  name: 'crowd',
  order: 20,
  summary:
    'One person in a crowd: rows of silhouettes in depth, one lit in the accent, focus racking from the front row to them.',
  use: 'Human stories and their scale: "one of millions", a patient, a worker, a voter. Cue the rack to the word that singles them out. The highlight is one person, not a statistic.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 5),
      horizon = h * 0.36,
      cx = w / 2,
      floorY = z => horizon + (h * 1.02 - horizon) / (1 + z);
    const rows = [3.4, 2.2, 1.1, 0];
    const hero = { row: 2, index: 3 };
    const elements = [
      { type: 'rect', x: 0, y: 0, w, h, fill: { gradient: ['surface', 'bg'], angle: 90 }, at: 0, dur: 0 },
      {
        type: 'ellipse',
        cx: round(cx),
        cy: round(horizon),
        rx: round(w * 0.6),
        ry: round(h * 0.25),
        fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
        opacity: 0.18,
        at: 0,
        enter: 'fade',
        dur: 0.6,
      },
    ];
    rows.forEach((z, r) => {
      const k = 1 / (1 + z),
        size = h * 0.34 * k,
        gap = size * 0.78,
        count = Math.ceil((w * 1.2) / (gap * 1)) + 1,
        base = floorY(z);
      const children = [];
      for (let i = 0; i < count; i++) {
        const x = cx + (i - (count - 1) / 2 + (r % 2 ? 0.5 : 0)) * gap + (rand() - 0.5) * gap * 0.25,
          s = size * (0.88 + rand() * 0.24),
          head = s * 0.13,
          lit = r === hero.row && i === Math.floor(count / 2) + 1;
        const top = base - s,
          shoulder = s * 0.26;
        const fill = lit ? 'accent' : r === rows.length - 1 ? 'bg' : 'muted';
        const opacity = lit ? 1 : [0.28, 0.4, 0.55, 1][r];
        children.push(
          {
            type: 'circle',
            cx: round(x),
            cy: round(top + head),
            r: round(head),
            fill,
            opacity,
            at: 0,
            dur: 0,
            ...(lit ? { glow: { blur: 14 }, id: 'one' } : {}),
          },
          {
            type: 'path',
            d: `M ${round(x - shoulder)} ${round(base)} L ${round(x - shoulder)} ${round(top + head * 2.9)} Q ${round(x - shoulder)} ${round(top + head * 2.2)} ${round(x)} ${round(top + head * 2.2)} Q ${round(x + shoulder)} ${round(top + head * 2.2)} ${round(x + shoulder)} ${round(top + head * 2.9)} L ${round(x + shoulder)} ${round(base)} Z`,
            fill,
            stroke: 'none',
            opacity,
            at: 0,
            dur: 0,
            ...(lit ? { glow: { blur: 14 } } : {}),
          },
        );
      }
      elements.push({ type: 'group', z, at: round(0.05 + (3 - r) * 0.08), enter: 'fade', dur: 0.5, children });
    });
    return {
      dolly: [{ at: 0, z: 0.15, dur: 8, ease: 'out' }],
      focus: { z: 0, aperture: 1.1, keys: [{ at: 1.2, z: 1.1, dur: 1.2 }] },
      elements,
    };
  },
};
