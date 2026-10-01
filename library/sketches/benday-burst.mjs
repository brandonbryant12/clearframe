import { tall, round } from '../../fframes/sketch-kit.mjs';

// A newsstand moment, after the 1938 covers: a burst in process red printed a little off
// register under its black key line, focus lines driving in from the edges, a Ben-Day sky
// darkening toward the ground and a caption box announcing the feature. Everything is printed
// (print presets); nothing glows.
export default {
  name: 'benday-burst',
  order: 40,
  summary:
    'A comic-cover impact: a jagged burst printed off register in Ben-Day dots, focus lines from the edges, the word in condensed caps and a caption box.',
  use: 'The hit of an action or origin story, a myth busted, a reveal with a bang. Replace TITLE (one short word) and DETAIL (a caption-box line) with sketchText. Pairs with the pulp treatment.',
  build(w, h) {
    const tallFrame = tall(w, h),
      cx = round(w / 2),
      cy = round(h * (tallFrame ? 0.47 : 0.54)),
      r = round(Math.min(w, h) * (tallFrame ? 0.44 : 0.4));
    // A burst: alternating long and short points, the long ones a little uneven, squashed so
    // it sits wide like a printed sound effect.
    const star = (points, outer, inner, turn) =>
      Array.from({ length: points * 2 }, (_, i) => {
        const a = turn + (i * Math.PI) / points - Math.PI / 2,
          k = i % 2 ? inner : outer * (0.88 + 0.12 * Math.cos(i * 2.3));
        return [round(cx + k * Math.cos(a)), round(cy + k * Math.sin(a) * 0.86)];
      });
    // Focus lines: thin ink wedges from beyond the frame edge to just short of the burst.
    const reach = Math.hypot(w, h) * 0.62;
    const lines = Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2 + 0.07 * Math.sin(i * 7.1),
        spread = 0.011 + (0.009 * ((i * 37) % 5)) / 5,
        near = r * (1.12 + (0.16 * ((i * 13) % 7)) / 7);
      const p = (d, s) => [round(cx + d * Math.cos(a + s)), round(cy + d * Math.sin(a + s))];
      return { type: 'poly', points: [p(reach, -spread), p(near, 0), p(reach, spread)], closed: true, fill: 'ink' };
    });
    const swell = [
      { at: 0, scale: 0.18, dur: 0 },
      { at: 0.08, scale: 1, dur: 0.5, ease: 'spring' },
    ];
    const title = round(r * 0.5);
    const box = tallFrame ? { x: 70, y: round(h * 0.07), w: w - 140, h: 150 } : { x: 90, y: 76, w: 600, h: 150 };
    return {
      elements: [
        // The sky: paper with a dot screen that darkens toward the ground.
        {
          type: 'rect',
          x: 0,
          y: 0,
          w,
          h,
          fill: 'bg',
          print: { screen: 'dots', ink: 'accent2', tone: [0.04, 0.42], cell: 13, angle: 15 },
          enter: 'none',
          at: 0,
        },
        { type: 'group', enter: 'fade', at: 0, dur: 0.2, children: lines },
        {
          type: 'poly',
          points: star(13, r, r * 0.66, 0),
          closed: true,
          fill: 'accent',
          stroke: 'ink',
          width: 7,
          print: 'newsprint',
          origin: [cx, cy],
          enter: 'none',
          at: 0,
          keys: swell,
          loop: { type: 'pulse', period: 1.6, amount: 0.025 },
        },
        {
          type: 'poly',
          points: star(11, r * 0.64, r * 0.5, 0.2),
          closed: true,
          fill: 'surface',
          stroke: 'ink',
          width: 5,
          print: { register: [5, 3.5], wear: 0.18 },
          origin: [cx, cy],
          enter: 'none',
          at: 0,
          keys: [
            { at: 0, scale: 0.1, dur: 0 },
            { at: 0.16, scale: 1, dur: 0.5, ease: 'spring' },
          ],
        },
        {
          type: 'text',
          text: 'TITLE',
          x: cx,
          y: round(cy + title * 0.36),
          size: title,
          font: 'poster',
          anchor: 'middle',
          fill: 'ink',
          fit: round(r * 1.02),
          print: { wear: 0.22 },
          enter: 'pop',
          at: 0.4,
          dur: 0.35,
        },
        // The caption box, the way covers announced a new feature.
        { type: 'rect', ...box, fill: 'bg', stroke: 'ink', width: 5, enter: 'drop', at: 0.75, dur: 0.4 },
        {
          type: 'text',
          text: 'DETAIL',
          x: round(box.x + box.w / 2),
          y: box.y + 96,
          size: 56,
          font: 'poster',
          anchor: 'middle',
          fill: 'ink',
          upper: true,
          fit: box.w - 48,
          enter: 'drop',
          at: 0.75,
          dur: 0.4,
        },
      ],
    };
  },
};
