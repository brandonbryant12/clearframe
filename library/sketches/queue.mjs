import { round, seen, tall } from '../../film/sketch-kit.mjs';

// A queue in depth: cards standing in line on a gridded floor, receding to a lit counter at
// the vanishing point. One card, partway back, is ours (accent). The picture is there on the
// first frame; the camera pushes along the line toward our card while the cards in front of
// it pass the lens, and focus racks from the near cards to ours.
export default {
  name: 'queue',
  order: 16,
  summary:
    'A queue in depth: cards in line on a gridded floor receding to a lit counter; the camera pushes along the line to one accent card.',
  use: 'Waiting, backlogs, a place in line, "how long does one request take": the opening world of a film about delay. Retime the dolly to the line.',
  // `count` cards in line, `ours` the index of the accent card (a shorter line at the end of
  // a film shows the wait shrinking).
  build(w, h, { count = 16, ours: mine = 3 } = {}) {
    const t = tall(w, h),
      horizon = h * (t ? 0.42 : 0.4),
      cx = w / 2,
      W0 = w * (t ? 0.3 : 0.2),
      H0 = W0 * 0.62,
      lane = -w * (t ? 0.22 : 0.34),
      ground = h * 0.97;
    const floorY = z => horizon + (ground - horizon) / (1 + z),
      laneX = z => cx + lane / (1 + z),
      ours = mine;
    const card = (i, z) => {
      const cw = seen(W0, z),
        ch = seen(H0, z),
        x = laneX(z) - cw / 2,
        y = floorY(z) - ch,
        mine = i === ours,
        ink = mine ? 'bg' : 'muted';
      const bar = (fx, fy, fw, fh, opacity) => ({
        type: 'rect',
        x: round(x + cw * fx),
        y: round(y + ch * fy),
        w: round(cw * fw),
        h: round(Math.max(ch * fh, 1)),
        r: round(ch * fh * 0.5),
        fill: ink,
        opacity,
      });
      return {
        type: 'group',
        z,
        // Haze: the far end of the line dissolves into the counter's light.
        opacity: round(Math.max(0.18, 1 - z / 14)),
        children: [
          {
            type: 'ellipse',
            cx: round(laneX(z)),
            cy: round(floorY(z) + 2),
            rx: round(cw * 0.58),
            ry: round(Math.max(cw * 0.07, 1)),
            fill: 'bg',
            opacity: 0.7,
            blur: round(Math.max(cw * 0.05, 0.5)),
          },
          {
            type: 'rect',
            x: round(x),
            y: round(y),
            w: round(cw),
            h: round(ch),
            r: round(cw * 0.05),
            fill: mine ? { gradient: ['accent', 'accent2'], angle: 120 } : { gradient: ['line', 'surface'], angle: 90 },
            stroke: mine ? 'none' : 'line',
            width: round(Math.max(seen(2, z), 0.5)),
            ...(mine ? { glow: { blur: 26, opacity: 0.85 } } : {}),
          },
          bar(0.1, 0.18, 0.46, 0.09, mine ? 0.9 : 0.55),
          bar(0.1, 0.4, 0.72, 0.06, mine ? 0.6 : 0.3),
          bar(0.1, 0.54, 0.6, 0.06, mine ? 0.6 : 0.3),
          bar(0.1, 0.68, 0.38, 0.06, mine ? 0.6 : 0.3),
          {
            type: 'circle',
            cx: round(x + cw * 0.86),
            cy: round(y + ch * 0.22),
            r: round(Math.max(cw * 0.035, 0.5)),
            fill: mine ? 'bg' : 'accent2',
            opacity: mine ? 1 : 0.8,
          },
        ],
      };
    };
    const depths = Array.from({ length: count }, (_, i) => round(0.2 + i * 0.62));
    const edge = x0 => {
      // A lane edge from the vanishing point through (x0, ground) to the frame's bottom.
      const k = (h * 1.02 - horizon) / (ground - horizon);
      return {
        type: 'line',
        x1: round(cx),
        y1: round(horizon),
        x2: round(cx + (x0 - cx) * k),
        y2: round(h * 1.02),
        stroke: 'line',
        width: 2,
        opacity: 0.4,
      };
    };
    // Present from the first frame, with no entrance (children too: they would fade in).
    const still = el => ({
      ...el,
      at: 0,
      enter: 'none',
      ...(el.children ? { children: el.children.map(still) } : {}),
    });
    return {
      dolly: [{ at: 0.2, z: 2.1, dur: 3.6, ease: 'inOut' }],
      // Our card is sharp from the start; the cards in front of it are soft foreground.
      focus: { z: depths[ours], aperture: 0.8 },
      elements: [
        // The picture is complete on frame one: room, floor and line need no entrance.
        { type: 'rect', x: 0, y: 0, w, h: round(horizon + 2), fill: { gradient: ['bg', 'surface'], angle: 90 } },
        {
          type: 'rect',
          x: 0,
          y: round(horizon),
          w,
          h: round(h - horizon),
          fill: { gradient: ['surface', 'bg'], angle: 90 },
        },
        {
          type: 'ellipse',
          cx: round(cx),
          cy: round(horizon),
          rx: round(w * 0.42),
          ry: round(h * 0.16),
          fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
          opacity: 0.4,
          z: 14,
        },
        ...[1, 2, 3.5, 5.5, 8.5, 13].map(z => ({
          type: 'line',
          x1: 0,
          y1: round(floorY(z)),
          x2: w,
          y2: round(floorY(z)),
          stroke: 'line',
          width: round(Math.max(seen(2.5, z), 0.6)),
          opacity: round(0.35 * (1 - z / 16)),
        })),
        edge(cx + lane - W0 * 0.95),
        edge(cx + lane + W0 * 0.95),
        {
          type: 'rect',
          x: round(cx - w * 0.035),
          y: round(horizon - h * 0.07),
          w: round(w * 0.07),
          h: round(h * 0.07),
          r: 4,
          fill: { gradient: ['ink', 'accent2'], angle: 90 },
          opacity: 0.9,
          z: 14,
          glow: { blur: 30, color: 'accent2', opacity: 0.9 },
        },
        ...depths.map((z, i) => card(i, z)).reverse(),
      ]
        .map(still)
        .concat([
          {
            type: 'particles',
            x: 0,
            y: 0,
            w,
            h,
            kind: 'dust',
            count: 36,
            fill: 'ink',
            opacity: 0.35,
            size: 3,
            z: -0.3,
            at: 0,
            enter: 'none',
          },
        ]),
    };
  },
};
