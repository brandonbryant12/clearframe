import { round } from '../../film/sketch-kit.mjs';

// A product window in space: a browser window swings in from edge-on over a sky, settles at
// an angle and keeps turning gently, with small UI chips floating around it. The window holds a
// drawn stand-in for the product; for a real product, put its screenshot in the window (an
// `image` element over the content area) rather than inventing screens.
export default {
  name: 'device',
  order: 25,
  summary:
    'A browser window swinging in from edge-on over a sky, settling at an angle and turning gently, with UI chips floating around it.',
  use: 'Launches and product beats: "here is the app", a feature, a before/after of a screen. Replace PRODUCT (a headline) and LINE (one line under it). Put a real screenshot in the window for a real product.',
  build(w, h) {
    const tallFrame = h > w,
      ww = round(tallFrame ? w * 0.82 : w * 0.5),
      wh = round(ww * 0.64),
      wx = round(w / 2 - ww / 2),
      wy = round(h / 2 - wh / 2),
      bar = round(wh * 0.09),
      cx = round(w / 2),
      head = round(ww * 0.05);
    const chip = (x, y, icon, at, period) => ({
      type: 'group',
      enter: 'pop',
      at,
      origin: [x, y],
      loop: { type: 'float', period, amount: 14 },
      shadow: { blur: 18, dy: 12, opacity: 0.22 },
      children: [
        { type: 'rect', x: round(x - 44), y: round(y - 44), w: 88, h: 88, r: 22, fill: '#ffffff' },
        { type: 'icon', name: icon, x, y, size: 44, stroke: 'accent' },
      ],
    });
    return {
      elements: [
        { type: 'rect', x: 0, y: 0, w, h, fill: { gradient: ['wash2', 'accent2'], angle: 90 }, enter: 'none', at: 0 },
        {
          type: 'ellipse',
          cx,
          cy: round(h * 0.42),
          rx: round(w * 0.45),
          ry: round(h * 0.4),
          fill: { gradient: ['#ffffff', '#ffffff'], radial: true, fade: true },
          opacity: 0.35,
          enter: 'none',
          at: 0,
        },
        {
          type: 'group',
          enter: 'fade',
          at: 0,
          dur: 0.3,
          origin: [cx, round(h / 2)],
          tilt: [10, -18],
          // Swings in from edge-on, then keeps turning gently.
          keys: [
            { at: 0, tiltY: 80, dur: 0 },
            { at: 0, tiltY: -18, dur: 1.1, ease: 'out' },
          ],
          loop: { type: 'rock', period: 8, amount: 5 },
          shadow: { blur: 44, dy: 40, opacity: 0.3 },
          children: [
            { type: 'rect', x: wx, y: wy, w: ww, h: wh, r: round(bar * 0.45), fill: '#ffffff', enter: 'none' },
            { type: 'rect', x: wx, y: wy, w: ww, h: bar, r: round(bar * 0.45), fill: '#eef1f6', enter: 'none' },
            ...['#ff5f57', '#febc2e', '#28c840'].map((c, i) => ({
              type: 'circle',
              cx: round(wx + bar * (0.6 + i * 0.5)),
              cy: round(wy + bar / 2),
              r: round(bar * 0.16),
              fill: c,
              enter: 'none',
            })),
            {
              type: 'text',
              text: 'PRODUCT',
              x: cx,
              y: round(wy + bar + head * 2),
              size: head,
              font: 'bold',
              anchor: 'middle',
              fill: '#14161c',
              fit: round(ww * 0.8),
              at: 0.9,
            },
            {
              type: 'text',
              text: 'LINE',
              x: cx,
              y: round(wy + bar + head * 3.1),
              size: round(head * 0.5),
              font: 'regular',
              anchor: 'middle',
              fill: '#5b6270',
              fit: round(ww * 0.7),
              at: 1.05,
            },
            // A stand-in for the product: rings around a hub, people arriving on them.
            {
              type: 'circle',
              cx,
              cy: round(wy + wh * 0.7),
              r: round(wh * 0.2),
              fill: 'none',
              stroke: 'accent',
              width: 3,
              opacity: 0.5,
              at: 1.1,
            },
            {
              type: 'circle',
              cx,
              cy: round(wy + wh * 0.7),
              r: round(wh * 0.07),
              fill: 'accent',
              at: 1.3,
              loop: { type: 'pulse', period: 1.6, amount: 0.08 },
            },
            ...[0, 1, 2, 3, 4].map(i => {
              const a = -Math.PI / 2 + (i - 2) * 0.62;
              return {
                type: 'circle',
                cx: round(cx + wh * 0.2 * Math.cos(a)),
                cy: round(wy + wh * 0.7 + wh * 0.2 * Math.sin(a)),
                r: round(wh * 0.03),
                fill: '#14161c',
                at: 1.5 + i * 0.12,
              };
            }),
          ],
        },
        chip(round(wx - ww * 0.06), round(wy + wh * 0.18), 'sparkles', 1.4, 3.6),
        chip(round(wx + ww * 1.04), round(wy + wh * 0.32), 'chart-line', 1.6, 4.2),
        chip(round(wx + ww * 0.9), round(wy + wh * 1.04), 'users', 1.8, 3.9),
      ],
    };
  },
};
