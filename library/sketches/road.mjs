import { round } from '../../film/sketch-kit.mjs';

// A night highway in true perspective: lane dashes and streetlights stand at real depths,
// so as the camera drives forward they rush toward the lens and pass by. Taillights hold
// ahead, and a city glow sits on the horizon. The horizon is at the frame's centre, where
// perspective converges, so the ground moves as ground.
export default {
  name: 'road',
  order: 21,
  summary:
    'A night highway in perspective: lane dashes and streetlights rushing past as the camera drives, taillights ahead, a city glow on the horizon.',
  use: 'Journeys, deliveries, commutes, "the long haul", momentum. Retime the dolly to the line; slow it for a calm drive.',
  build(w, h) {
    const cx = w / 2,
      horizon = h / 2,
      floorY = z => horizon + (h * 0.55) / (1 + z),
      half = w * 0.42,
      elements = [
        {
          type: 'rect',
          x: 0,
          y: 0,
          w,
          h: round(horizon),
          fill: { gradient: ['bg', 'surface'], angle: 90 },
          at: 0,
          dur: 0,
        },
        {
          type: 'ellipse',
          cx: round(cx),
          cy: round(horizon),
          rx: round(w * 0.45),
          ry: round(h * 0.12),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.35,
          at: 0,
          enter: 'fade',
          dur: 0.8,
        },
        { type: 'rect', x: 0, y: round(horizon), w, h: round(h - horizon), fill: 'bg', at: 0, dur: 0 },
        // The road surface and its edges converge on the vanishing point.
        {
          type: 'poly',
          points: [
            [round(cx - 2), round(horizon)],
            [round(cx + 2), round(horizon)],
            [round(cx + half * 1.9), h],
            [round(cx - half * 1.9), h],
          ],
          fill: 'surface',
          opacity: 0.9,
          at: 0,
          dur: 0,
        },
        {
          type: 'line',
          x1: round(cx - 2),
          y1: round(horizon),
          x2: round(cx - half * 1.9),
          y2: h,
          stroke: 'muted',
          width: 3,
          opacity: 0.6,
          at: 0,
          dur: 0,
        },
        {
          type: 'line',
          x1: round(cx + 2),
          y1: round(horizon),
          x2: round(cx + half * 1.9),
          y2: h,
          stroke: 'muted',
          width: 3,
          opacity: 0.6,
          at: 0,
          dur: 0,
        },
      ];
    // Lane dashes on the floor, at increasing depth.
    for (let i = 0; i < 22; i++) {
      const z = i * 0.45;
      elements.push({
        type: 'line',
        x1: round(cx),
        y1: round(floorY(z + 0.2)),
        x2: round(cx),
        y2: round(floorY(z)),
        stroke: 'ink',
        width: round(10 / (1 + z) + 1),
        opacity: 0.85,
        z,
        at: 0,
        dur: 0,
      });
    }
    // Streetlights on both shoulders: a pole and a lit lamp, every so often in depth.
    for (let i = 0; i < 9; i++) {
      const z = 0.4 + i * 1.1,
        k = 1 / (1 + z);
      for (const side of [-1, 1]) {
        const x = cx + side * half * 1.25 * k,
          base = floorY(z),
          top = base - h * 0.62 * k;
        elements.push(
          {
            type: 'line',
            x1: round(x),
            y1: round(base),
            x2: round(x),
            y2: round(top),
            stroke: 'muted',
            width: round(6 * k + 1),
            opacity: 0.8,
            z,
            at: 0,
            dur: 0,
          },
          {
            type: 'circle',
            cx: round(x - side * 14 * k),
            cy: round(top),
            r: round(9 * k + 1.5),
            fill: 'accent',
            glow: { blur: round(16 * k + 4) },
            z,
            at: 0,
            dur: 0,
          },
        );
      }
    }
    // Taillights of a truck ahead keeping pace: no z, so they hold while the road rushes by.
    elements.push(
      {
        type: 'circle',
        cx: round(cx - 30),
        cy: round(floorY(3) - 14),
        r: 5,
        fill: 'negative',
        glow: { blur: 10 },
        at: 0.2,
        enter: 'fade',
        dur: 0.4,
        loop: { type: 'float', period: 2.6, amount: 2 },
      },
      {
        type: 'circle',
        cx: round(cx + 30),
        cy: round(floorY(3) - 14),
        r: 5,
        fill: 'negative',
        glow: { blur: 10 },
        at: 0.2,
        enter: 'fade',
        dur: 0.4,
        loop: { type: 'float', period: 2.6, amount: 2 },
      },
    );
    return {
      // The camera drives forward at a steady speed.
      dolly: [{ at: 0, z: 3.2, dur: 9, ease: 'linear' }],
      elements,
    };
  },
};
