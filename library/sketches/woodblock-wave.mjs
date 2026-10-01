import { tall, round } from '../../fframes/sketch-kit.mjs';

// A woodblock view of a rising sea: a bokashi sky (Prussian blue printed into the paper), a
// combed swell cut in swelling lines, one great wave curling over with foam claws along its
// lip, and a small mountain far off so scale tells the story. Flat colour inside ink key
// lines; the wave rises on the first beat and sways while the line is read.
export default {
  name: 'woodblock-wave',
  order: 41,
  summary:
    'A woodblock sea: a bokashi sky, a swell cut in engraved lines, a great wave curling over with foam claws, a distant peak and a cartouche.',
  use: 'A force building, a rising risk, weather, the sea, a long journey. Replace TITLE (the cartouche, a few words) with sketchText. Pairs with the woodblock treatment and palette.',
  build(w, h) {
    const tallFrame = tall(w, h);
    // The view is drawn in a unit box; a tall frame keeps the wave's right-hand side.
    const box = tallFrame
      ? { x: -0.55 * w, y: 0.36 * h, w: 1.9 * w, h: 0.64 * h }
      : { x: 0, y: 0.14 * h, w, h: 0.86 * h };
    const P = (u, v) => [round(box.x + u * box.w), round(box.y + v * box.h)];
    const d = cmds =>
      cmds
        .map(([c, ...pts]) => c + ' ' + pts.map(([u, v]) => P(u, v).join(' ')).join(' '))
        .join(' ') + ' Z';
    // The curl: up from the bottom left, over the crest, the lip hanging forward, back down.
    const curl = [
      ['M', [-0.05, 1.05]],
      ['C', [0.06, 0.85], [0.15, 0.5], [0.32, 0.3]],
      ['C', [0.4, 0.2], [0.52, 0.17], [0.58, 0.27]],
      ['C', [0.61, 0.33], [0.58, 0.39], [0.54, 0.37]],
      ['C', [0.5, 0.35], [0.49, 0.31], [0.45, 0.33]],
      ['C', [0.39, 0.36], [0.36, 0.5], [0.38, 0.66]],
      ['C', [0.4, 0.84], [0.48, 0.96], [0.6, 1.05]],
    ];
    const swell = [
      ['M', [0.52, 1.05]],
      ['C', [0.6, 0.86], [0.69, 0.74], [0.78, 0.72]],
      ['C', [0.84, 0.71], [0.88, 0.76], [0.86, 0.8]],
      ['C', [0.83, 0.84], [0.8, 0.8], [0.77, 0.83]],
      ['C', [0.74, 0.88], [0.76, 0.98], [0.83, 1.05]],
    ];
    // Foam claws along the crest and lip: small hooked triangles pointing out of the wave.
    const bez = (a, b, c, e, t) =>
      [0, 1].map(i => (1 - t) ** 3 * a[i] + 3 * (1 - t) ** 2 * t * b[i] + 3 * (1 - t) * t ** 2 * c[i] + t ** 3 * e[i]);
    const crest = [
      [[0.32, 0.3], [0.4, 0.2], [0.52, 0.17], [0.58, 0.27]],
      [[0.58, 0.27], [0.61, 0.33], [0.58, 0.39], [0.54, 0.37]],
    ];
    const claws = [];
    crest.forEach((seg, s) => {
      const n = s ? 8 : 18;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1),
          [u, v] = bez(...seg, t),
          [u2, v2] = bez(...seg, Math.min(1, t + 0.02)),
          len = Math.hypot(u2 - u, v2 - v) || 1,
          [tu, tv] = [(u2 - u) / len, (v2 - v) / len],
          [nu, nv] = [tv, -tu],
          k = 0.011 + 0.006 * ((i * 7) % 3);
        claws.push({
          type: 'poly',
          points: [P(u - tu * k * 0.6, v - tv * k * 0.6), P(u + nu * k + tu * k * 0.7, v + nv * k + tv * k * 0.7), P(u + tu * k * 0.6, v + tv * k * 0.6)],
          closed: true,
          fill: 'bg',
          stroke: 'ink',
          width: 1.5,
        });
      }
    });
    const cart = tallFrame ? { x: 70, y: round(h * 0.08), w: w - 140, h: 104 } : { x: w - 600, y: 70, w: 480, h: 104 };
    return {
      elements: [
        { type: 'rect', x: 0, y: 0, w, h, fill: 'bg', enter: 'none', at: 0 },
        // Bokashi: blue printed into the top of the sheet and wiped away down the block.
        { type: 'rect', x: 0, y: 0, w, h: round(h * 0.34), fill: { gradient: ['accent', 'bg'], angle: 90 }, enter: 'none', at: 0 },
        // A small peak far off: the scale of the wave depends on it.
        {
          type: 'group',
          enter: 'fade',
          at: 0.3,
          dur: 0.8,
          children: [
            { type: 'poly', points: [P(0.6, 0.67), P(0.68, 0.53), P(0.76, 0.67)], closed: true, fill: 'accent', stroke: 'ink', width: 2 },
            {
              type: 'poly',
              points: [P(0.66, 0.565), P(0.68, 0.53), P(0.7, 0.565), P(0.689, 0.575), P(0.68, 0.562), P(0.671, 0.575)],
              closed: true,
              fill: 'surface',
              stroke: 'ink',
              width: 2,
            },
          ],
        },
        // The sea, combed in lines that thicken toward the viewer.
        {
          type: 'rect',
          x: 0,
          y: P(0, 0.64)[1],
          w,
          h: h - P(0, 0.64)[1],
          fill: 'positive',
          print: { screen: 'lines', ink: 'accent', tone: [0.15, 0.7], angle: -6, cell: 9 },
          enter: 'none',
          at: 0,
        },
        {
          type: 'group',
          enter: 'none',
          at: 0,
          keys: [
            { at: 0, y: round(h * 0.18), dur: 0 },
            { at: 0.05, y: 0, dur: 1.5, ease: 'out' },
          ],
          loop: { type: 'sway', period: 7, amount: 1.2 },
          origin: P(0.4, 1),
          children: [
            { type: 'path', d: d(swell), fill: 'accent', stroke: 'ink', width: 3, print: { screen: 'lines', ink: 'positive', tone: 0.3, angle: -40, cell: 8 } },
            { type: 'path', d: d(curl), fill: 'accent', stroke: 'ink', width: 4, print: { screen: 'lines', ink: 'positive', tone: [0.42, 0.18], angle: -55, cell: 9 } },
            { type: 'group', enter: 'pop', at: 0.9, stagger: 0.05, children: claws },
          ],
        },
        // The cartouche names the view.
        { type: 'rect', ...cart, fill: 'accent2', stroke: 'ink', width: 3, enter: 'wipe', at: 1.1, dur: 0.5 },
        {
          type: 'text',
          text: 'TITLE',
          x: round(cart.x + cart.w / 2),
          y: cart.y + 68,
          size: 46,
          font: 'serif',
          anchor: 'middle',
          fill: 'bg',
          fit: cart.w - 48,
          enter: 'fade',
          at: 1.4,
        },
      ],
    };
  },
};
