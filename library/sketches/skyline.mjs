import { round, rng } from '../../fframes/sketch-kit.mjs';

// A city at night in three planes: a hazy far skyline, a darker midground with lit windows
// that come and go, and two foreground towers cutting the frame edges. The camera trucks
// sideways across it, so the planes slide past each other at their own rates.
export default {
  name: 'skyline',
  order: 11,
  summary:
    'A night city in three planes (haze, lit midground, foreground towers) with a slow sideways truck that shows the parallax.',
  use: 'Establishing a place, "a city of millions", a trailer montage beat, or behind a lower-third title. Retime or reverse the truck to the story.',
  build(w, h) {
    const rand = rng(7),
      ground = round(h * 0.8),
      span = [-0.25 * w, 1.25 * w];
    const row = (z, min, max, fill, opacity, gap = 0, below = 0.3) => {
      const out = [];
      for (let x = span[0]; x < span[1];) {
        const bw = w * (0.035 + rand() * 0.06),
          bh = h * (min + rand() * (max - min));
        out.push({ x: round(x), y: round(ground - bh), w: round(bw), h: round(bh + h * below), fill, opacity, z });
        x += bw + gap * w * rand();
      }
      return out;
    };
    // Atmospheric perspective: the far skyline is haze, the midground a dark silhouette.
    const far = row(4, 0.14, 0.34, 'muted', 0.2, 0.01, 0);
    const mid = row(1.4, 0.2, 0.52, 'bg', 1, 0.02);
    const windows = [];
    for (const b of mid) {
      const cols = Math.max(1, Math.floor(b.w / 26)),
        rows = Math.floor((ground - b.y - 30) / 40);
      for (let r = 0; r < rows && windows.length < 170; r++)
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.22) continue;
          windows.push({
            type: 'rect',
            x: round(b.x + 10 + c * 26),
            y: round(b.y + 22 + r * 40),
            w: 9,
            h: 14,
            fill: rand() > 0.8 ? 'accent2' : 'accent',
            opacity: 0.85,
            z: 1.4,
            at: round(0.15 + rand() * 0.7),
            enter: 'fade',
            dur: 0.4,
            ...(rand() > 0.7 ? { loop: { type: 'blink', period: round(3 + rand() * 6) } } : {}),
          });
        }
    }
    const rects = (list, at) => list.map(r => ({ type: 'rect', ...r, at, enter: 'fade', dur: 0.5 }));
    // Masts on the three tallest towers, each with a slow red beacon.
    const masts = [...mid]
      .sort((a, b) => a.y - b.y)
      .slice(0, 3)
      .flatMap((b, i) => {
        const x = round(b.x + b.w / 2),
          top = round(b.y - h * 0.06);
        return [
          {
            type: 'line',
            x1: x,
            y1: round(b.y),
            x2: x,
            y2: top,
            stroke: 'bg',
            width: 3,
            z: 1.4,
            at: 0.2,
            enter: 'fade',
            dur: 0.4,
          },
          {
            type: 'circle',
            cx: x,
            cy: top,
            r: 4,
            fill: 'negative',
            z: 1.4,
            glow: { blur: 10 },
            at: 0.3,
            enter: 'fade',
            dur: 0.3,
            loop: { type: 'blink', period: round(2.2 + i * 0.7) },
          },
        ];
      });
    return {
      view: [0, 0, w, h],
      viewFrom: [round(-w * 0.12), 0, w, h],
      viewDur: 9,
      elements: [
        {
          type: 'rect',
          x: round(-0.3 * w),
          y: 0,
          w: round(1.6 * w),
          h,
          fill: { gradient: ['bg', 'surface'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'circle',
          cx: round(w * 0.78),
          cy: round(h * 0.2),
          r: round(h * 0.04),
          fill: 'ink',
          z: 12,
          glow: { blur: 26, opacity: 0.9 },
          at: 0.1,
          enter: 'fade',
          dur: 0.6,
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h: round(h * 0.6),
          kind: 'stars',
          count: 90,
          fill: 'ink',
          opacity: 0.5,
          size: 2,
          z: 12,
          at: 0,
          enter: 'fade',
          dur: 0.6,
        },
        // The city's own glow on the low sky, behind the far towers.
        {
          type: 'ellipse',
          cx: round(w * 0.5),
          cy: ground,
          rx: round(w * 0.9),
          ry: round(h * 0.32),
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.3,
          z: 6,
          at: 0,
          enter: 'fade',
          dur: 0.8,
        },
        ...rects(far, 0.1),
        // Street level is in shadow: the far skyline stops at the ground line.
        {
          type: 'rect',
          x: round(-0.3 * w),
          y: ground,
          w: round(1.6 * w),
          h: round(h * 0.4),
          fill: 'bg',
          z: 1.4,
          at: 0,
          dur: 0,
        },
        ...rects(mid, 0.2),
        ...windows,
        ...masts,
        // Foreground towers at the frame edges, rim-lit by the city, soft with nearness.
        {
          type: 'rect',
          x: round(-0.06 * w),
          y: round(h * 0.05),
          w: round(w * 0.1),
          h: round(h * 1.1),
          fill: 'bg',
          blur: 4,
          z: -0.35,
          at: 0,
          dur: 0,
        },
        {
          type: 'rect',
          x: round(0.93 * w),
          y: round(h * 0.18),
          w: round(w * 0.14),
          h: round(h * 1.1),
          fill: 'bg',
          blur: 4,
          z: -0.35,
          at: 0,
          dur: 0,
        },
      ],
    };
  },
};
