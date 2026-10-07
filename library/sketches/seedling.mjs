import { tall, round } from '../../film/sketch-kit.mjs';

// Growth in three stages: a seed in the soil puts down roots and a first shoot, the stem draws
// up through two more stages with a pair of leaves unfolding at each, and a flower opens at the
// top. Each stage is marked at its height with a short label, so the plant becomes a timeline you
// can read. Its moments are named cues (SEED, SPROUT, GROW, BLOOM) for a beat's sketchSay; the
// grown plant sways in the light.
const AT = { SEED: 0.3, SPROUT: 1.4, GROW: 2.8, BLOOM: 4.4 };

const leaf = (ax, ay, d, L) =>
  `M ${ax} ${ay} Q ${round(ax + d * L * 0.45)} ${round(ay - L * 0.5)} ${round(ax + d * L)} ${round(ay - L * 0.2)} Q ${round(ax + d * L * 0.55)} ${round(ay + L * 0.18)} ${ax} ${ay} Z`;

export default {
  name: 'seedling',
  order: 72,
  summary:
    'Growth in three stages: a seed puts down roots and a shoot, the stem draws up with leaves unfolding at each stage, and a flower opens at the top; each stage is labelled at its height.',
  use: 'Growth and compounding: a small start that becomes something big, a community or customer base growing, a habit, a product maturing, "it grows on its own". Calm and hopeful; works on light and dark palettes. Replace ONE, TWO and THREE (the stage labels) with sketchText; land SEED, SPROUT, GROW and BLOOM on words with sketchSay.',
  build(w, h) {
    const T = tall(w, h);
    const x = T ? 330 : 760,
      soil = T ? 1500 : 840,
      top = T ? 560 : 250,
      L = T ? 200 : 200,
      size = T ? 52 : 46;
    // Three stage heights up the stem, and the stem drawn as one gentle S in three pieces.
    const ys = [soil - (soil - top) * 0.3, soil - (soil - top) * 0.65, top];
    const stem = [
      `M ${x} ${soil - 6} Q ${x + 26} ${round((soil + ys[0]) / 2)} ${x + 6} ${round(ys[0])}`,
      `M ${x + 6} ${round(ys[0])} Q ${x - 22} ${round((ys[0] + ys[1]) / 2)} ${x - 4} ${round(ys[1])}`,
      `M ${x - 4} ${round(ys[1])} Q ${x + 18} ${round((ys[1] + ys[2]) / 2)} ${x} ${round(ys[2] + 40)}`,
    ];
    const cues = ['SPROUT', 'GROW', 'BLOOM'];
    const leaves = [0, 1].flatMap(i => {
      const ay = round(ys[i] + 16), ax = i ? x - 4 : x + 6;
      return [-1, 1].map((d, j) => ({ type: 'path', d: leaf(ax, ay, d, L * (1 - i * 0.15)), fill: 'positive', stroke: 'ink', width: 4, origin: [ax, ay], enter: 'grow', cue: cues[i], at: AT[cues[i]] + 0.3 + j * 0.15, dur: 0.7 }));
    });
    const petals = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return { type: 'circle', cx: round(x + Math.cos(a) * 50), cy: round(top + 10 + Math.sin(a) * 50), r: 42, fill: 'accent', stroke: 'ink', width: 3, enter: 'pop', dur: 0.4 };
    });
    const roots = [[-1, 0.9], [1, 0.7], [-0.3, 1.2], [0.5, 1.1]].map(([d, k]) =>
      `M ${x} ${soil + 4} Q ${round(x + d * 90)} ${round(soil + 70 * k)} ${round(x + d * 180 * k)} ${round(soil + 150 * k)}`);
    // Stage labels to the right of the stem, each with a short tick to its height.
    // Labels clear the leaf tips; each tick runs from beside the stage to its label.
    const lx = x + L + 60;
    const labels = ['ONE', 'TWO', 'THREE'].flatMap((text, i) => [
      { type: 'line', x1: i < 2 ? round(x + L * (1 - i * 0.15) + 12) : x + 70, y1: round(ys[i] + (i === 2 ? 10 : 0)), x2: lx - 20, y2: round(ys[i] + (i === 2 ? 10 : 0)), stroke: 'muted', width: 3, dash: [8, 8], enter: 'draw', cue: cues[i], at: AT[cues[i]] + 0.5, dur: 0.5 },
      { type: 'text', text, x: lx, y: round(ys[i] + (i === 2 ? 10 : 0) + size * 0.35), size, font: 'semibold', fill: 'ink', fit: w - lx - (T ? 90 : 200), enter: 'fade', cue: cues[i], at: AT[cues[i]] + 0.5, dur: 0.6 },
    ]);
    return {
      elements: [
        { type: 'circle', cx: T ? 860 : 1600, cy: T ? 420 : 200, r: T ? 90 : 80, fill: 'accent2', glow: { blur: 40, opacity: 0.5 }, enter: 'none', at: 0 },
        { type: 'rect', x: 0, y: soil, w, h: h - soil, fill: 'surface', enter: 'none', at: 0 },
        { type: 'line', x1: 0, y1: soil, x2: w, y2: soil, stroke: 'ink', width: 4, enter: 'none', at: 0 },
        { type: 'ellipse', cx: x, cy: soil + 22, rx: 34, ry: 21, fill: 'accent2', stroke: 'ink', width: 3, enter: 'pop', cue: 'SEED', at: AT.SEED, dur: 0.4 },
        { type: 'path', d: roots.join(' '), fill: 'none', stroke: 'muted', width: 6, cap: 'round', enter: 'draw', cue: 'SPROUT', at: AT.SPROUT, dur: 1.2 },
        // The plant sways once it is up; each piece of it draws or unfolds on its stage.
        {
          type: 'group', enter: 'none', at: 0, origin: [x, soil], loop: { type: 'sway', period: 4, amount: 1.5 },
          children: [
            ...stem.map((d, i) => ({ type: 'path', d, fill: 'none', stroke: 'positive', width: 20, cap: 'round', enter: 'draw', cue: cues[i], at: AT[cues[i]], dur: 0.9 })),
            ...leaves,
            { type: 'group', enter: 'none', cue: 'BLOOM', at: AT.BLOOM + 0.6, stagger: 0.08, children: petals },
            { type: 'circle', cx: x, cy: top + 10, r: 34, fill: 'accent2', stroke: 'ink', width: 4, enter: 'pop', cue: 'BLOOM', at: AT.BLOOM + 1.1, dur: 0.3 },
          ],
        },
        ...labels,
      ],
    };
  },
};
