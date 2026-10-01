import { round } from '../../fframes/sketch-kit.mjs';

// An event-poster opener: jagged rays radiate from a disc and turn slowly, the disc pops in on
// the beat, and the title wipes across it. The rays are a field, not decoration: they keep the
// frame moving while the words are read.
export default {
  name: 'sunburst',
  order: 23,
  summary:
    'An event-poster opener: jagged rays turning around a disc that pops in, a title wiped across it, a line of detail under it.',
  use: 'Openers, launches, event and series promos, a verdict that deserves a stage. Replace TITLE (one or two short words) and DETAIL (a date, a place, a line) with sketchText.',
  build(w, h) {
    const tallFrame = h > w,
      cx = round(w / 2),
      cy = round(h * (tallFrame ? 0.44 : 0.5)),
      r = round(Math.min(w, h) * (tallFrame ? 0.36 : 0.3)),
      reach = Math.hypot(w, h);
    // Thirty-two rays, each a zig-zag wedge from just inside the disc to past the corner.
    const rays = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        half = Math.PI / 64,
        steps = 7;
      const side = sign =>
        Array.from({ length: steps + 1 }, (_, k) => {
          const t = k / steps,
            d = r * 0.9 + (reach - r * 0.9) * t,
            jag = (k % 2 ? 1 : -1) * half * 0.55;
          const ang = a + sign * half + jag;
          return [round(cx + d * Math.cos(ang)), round(cy + d * Math.sin(ang))];
        });
      rays.push({
        type: 'poly',
        points: [...side(-1), ...side(1).reverse()],
        closed: true,
        fill: 'ink',
        opacity: 0.85,
      });
    }
    const title = round(r * 0.42);
    return {
      elements: [
        { type: 'rect', x: 0, y: 0, w, h, fill: 'accent', enter: 'none', at: 0 },
        // The field turns slowly from the first frame (ambient motion that runs past the cut).
        {
          type: 'group',
          origin: [cx, cy],
          enter: 'none',
          at: 0,
          children: rays,
          keys: [{ at: 0, rotate: 24, dur: 30, ease: 'linear', hold: false }],
        },
        { type: 'circle', cx, cy, r, fill: 'surface', enter: 'pop', at: 0.15, dur: 0.5 },
        {
          type: 'text',
          text: 'TITLE',
          x: cx,
          y: round(cy + title * 0.35),
          size: title,
          font: 'poster',
          anchor: 'middle',
          fill: 'ink',
          fit: round(r * 1.7),
          enter: 'wipe',
          at: 0.45,
          dur: 0.55,
        },
        {
          type: 'text',
          text: 'DETAIL',
          x: cx,
          y: round(cy + title * 0.35 + title * 0.62),
          size: round(title * 0.26),
          font: 'semibold',
          anchor: 'middle',
          fill: 'ink',
          tracking: 0.18,
          upper: true,
          fit: round(r * 1.5),
          enter: 'rise',
          at: 0.9,
        },
      ],
    };
  },
};
