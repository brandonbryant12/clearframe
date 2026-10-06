import { round, rng } from '../../film/sketch-kit.mjs';

// City rooftops at sunrise: wooden water tanks on their stilts in the foreground, the low sun
// behind a hazy skyline, windows coming on one by one as the city wakes, and steam from a vent.
// Three planes (haze, the middle roofs, the near tank) and a slow crane down.
export default {
  name: 'rooftops',
  order: 11.4,
  summary:
    'City rooftops at sunrise: water tanks on stilts, a hazy skyline against the low sun, windows coming on as the city wakes.',
  use: 'Mornings, cities and what they run on: water, power, deliveries. "Every morning, a city wakes up…". An establishing shot for an explainer about infrastructure.',
  build(w, h, { seed } = {}) {
    const rand = rng(seed ?? 19),
      tallFrame = h > w,
      horizon = round(h * (tallFrame ? 0.55 : 0.6)),
      sunX = round(w * (tallFrame ? 0.65 : 0.7));
    // A water tank on stilts: a stave barrel with hoops, a conical roof, legs and cross-bracing.
    const tank = (cx, base, s, z, lit) => {
      const bw = 120 * s,
        bh = 130 * s,
        legH = 90 * s,
        top = base - legH - bh;
      const legs = [-0.42, -0.14, 0.14, 0.42]
        .map(k => `M ${round(cx + k * bw)} ${round(base)} L ${round(cx + k * bw * 0.9)} ${round(base - legH)}`)
        .join(' ');
      const brace = `M ${round(cx - 0.42 * bw)} ${round(base)} L ${round(cx + 0.38 * bw)} ${round(base - legH)} M ${round(cx + 0.42 * bw)} ${round(base)} L ${round(cx - 0.38 * bw)} ${round(base - legH)}`;
      const hoops = [0.2, 0.45, 0.7, 0.9]
        .map(k => `M ${round(cx - bw / 2)} ${round(top + bh * k)} L ${round(cx + bw / 2)} ${round(top + bh * k)}`)
        .join(' ');
      return [
        { type: 'path', d: `${legs} ${brace}`, fill: 'none', stroke: 'bg', width: round(Math.max(2, 7 * s)), z },
        {
          type: 'rect',
          x: round(cx - bw / 2),
          y: round(top),
          w: round(bw),
          h: round(bh),
          fill: { gradient: lit ? ['bg', 'surface', 'accent'] : ['bg', 'surface'], angle: 0 },
          z,
        },
        { type: 'path', d: hoops, fill: 'none', stroke: 'bg', width: round(Math.max(1.5, 4 * s)), opacity: 0.8, z },
        {
          type: 'poly',
          points: [
            [round(cx - bw * 0.56), round(top + 2)],
            [round(cx), round(top - bh * 0.42)],
            [round(cx + bw * 0.56), round(top + 2)],
          ],
          closed: true,
          fill: { gradient: ['bg', 'surface'], angle: 0 },
          z,
        },
        // The sun catches the tank's east edge.
        {
          type: 'line',
          x1: round(cx + bw / 2 - 2),
          y1: round(top + 4),
          x2: round(cx + bw / 2 - 2),
          y2: round(top + bh - 4),
          stroke: 'accent',
          width: round(Math.max(1.5, 4 * s)),
          opacity: lit ? 0.9 : 0.5,
          glow: { blur: round(8 * s), opacity: 0.7 },
          z,
        },
      ];
    };
    // The far skyline: haze-coloured blocks against the sun.
    const far = [];
    for (let x = -0.1 * w; x < 1.1 * w; ) {
      const bw = w * (0.025 + rand() * 0.05),
        bh = h * (0.06 + rand() ** 1.6 * 0.26);
      far.push(`M ${round(x)} ${horizon} V ${round(horizon - bh)} H ${round(x + bw)} V ${horizon} Z`);
      x += bw + rand() * w * 0.01;
    }
    // The middle roofs: dark blocks with windows that light as the city wakes.
    const roofs = [],
      windows = [];
    for (let x = -0.08 * w; x < 1.08 * w; ) {
      const bw = w * (0.08 + rand() * 0.1),
        top = horizon + h * (0.02 + rand() * 0.1);
      roofs.push({ x: round(x), y: round(top), w: round(bw), h: round(h - top + 20) });
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < Math.floor(bw / 34); c++)
          if (rand() > 0.72)
            windows.push({
              type: 'rect',
              x: round(x + 12 + c * 34),
              y: round(top + 26 + r * 44),
              w: 14,
              h: 20,
              fill: rand() > 0.3 ? 'accent' : 'ink',
              opacity: 0.85,
              z: 1.2,
              at: round(0.3 + rand() * 2.6),
              enter: 'fade',
              dur: 0.25,
            });
      x += bw + w * 0.006;
    }
    return {
      view: [0, 0, w, h],
      viewFrom: [0, round(-h * 0.06), w, h],
      viewDur: 9,
      elements: [
        // Sunrise: deep blue overhead, warm at the horizon.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(-0.2 * h),
          w: round(1.2 * w),
          h: round(horizon + 0.2 * h),
          fill: { gradient: ['bg', 'surface', 'accent2', 'accent'], angle: 90 },
          at: 0,
          enter: 'none',
        },
        {
          type: 'ellipse',
          cx: sunX,
          cy: horizon,
          rx: round(w * 0.42),
          ry: round(h * 0.34),
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          opacity: 0.6,
          z: 10,
          at: 0,
          enter: 'none',
        },
        { type: 'path', d: far.join(' '), fill: 'muted', opacity: 0.4, stroke: 'none', z: 5, at: 0, enter: 'none' },
        // Morning haze over the far city.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(horizon - h * 0.16),
          w: round(1.2 * w),
          h: round(h * 0.2),
          fill: { gradient: ['accent', 'accent'], angle: 270, fade: true },
          opacity: 0.35,
          z: 4,
          at: 0,
          enter: 'none',
          loop: { type: 'float', period: 14, amount: 8 },
        },
        ...roofs.map(r => ({
          type: 'rect',
          ...r,
          fill: { gradient: ['surface', 'bg'], angle: 90 },
          z: 1.2,
          at: 0,
          enter: 'none',
        })),
        ...roofs.map(r => ({ type: 'rect', x: r.x, y: r.y, w: r.w, h: 3, fill: 'accent', opacity: 0.45, z: 1.2, at: 0, enter: 'none' })),
        ...windows,
        // Tanks on the middle roofs, and one close to the lens.
        ...tank(round(w * 0.2), roofs[2]?.y ?? horizon, 0.7, 1.2, false).map(el => ({ ...el, at: 0, enter: 'none' })),
        ...tank(round(w * 0.56), roofs[Math.floor(roofs.length / 2)]?.y ?? horizon, 0.55, 1.2, false).map(el => ({ ...el, at: 0, enter: 'none' })),
        {
          type: 'particles',
          x: round(w * 0.6),
          y: round(horizon - h * 0.12),
          w: round(w * 0.05),
          h: round(h * 0.16),
          kind: 'embers',
          count: 12,
          seed: 5,
          size: 9,
          speed: 0.5,
          fill: 'ink',
          opacity: 0.25,
          blur: 4,
          z: 1.2,
          at: 0,
          enter: 'none',
        },
        // The near roof and its tank, soft with nearness.
        {
          type: 'rect',
          x: round(-0.1 * w),
          y: round(h * (tallFrame ? 0.88 : 0.86)),
          w: round(w * 0.62),
          h: round(h * 0.3),
          fill: 'bg',
          z: -0.3,
          at: 0,
          enter: 'none',
        },
        ...tank(round(w * (tallFrame ? 0.24 : 0.16)), round(h * (tallFrame ? 0.88 : 0.86)), tallFrame ? 2 : 2.4, -0.3, true).map(el => ({
          ...el,
          at: 0,
          enter: 'none',
        })),
      ],
    };
  },
};
