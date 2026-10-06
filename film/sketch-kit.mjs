// Helpers for authoring sketches: frame presets and layout conveniences shared by the
// parametric sketches in library/sketches. A sketch module exports
// { name, summary, use, build(w, h) } and may import anything here.
export const frames = { landscape: [1920, 1080], vertical: [1080, 1920], square: [1080, 1080], portrait: [1080, 1350] };
export const tall = (w, h) => h > w * 1.1;
export const round = v => Math.round(v * 10) / 10;

/** Body region below a title (y from ~330) and above the footer, in frame pixels. */
export function body(w, h) {
  const top = tall(w, h) ? h * 0.11 + 330 : 330;
  return { x: tall(w, h) ? 86 : 120, y: top, w: w - (tall(w, h) ? 172 : 240), h: h - top - (tall(w, h) ? 240 : 150) };
}

/** A smooth curve through points (Catmull-Rom converted to cubic Béziers). */
export function smoothPath(points) {
  const p = points.map(([x, y]) => [round(x), round(y)]);
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [a, b, c, e] = [p[Math.max(0, i - 1)], p[i], p[i + 1], p[Math.min(p.length - 1, i + 2)]];
    const c1 = [round(b[0] + (c[0] - a[0]) / 6), round(b[1] + (c[1] - a[1]) / 6)],
      c2 = [round(c[0] - (e[0] - b[0]) / 6), round(c[1] - (e[1] - b[1]) / 6)];
    d += ` C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${c[0]} ${c[1]}`;
  }
  return d;
}

/** A seeded random stream (mulberry32), so a sketch is the same every time it is built. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Size on screen of something `size` across at depth `z` (the renderer draws `z` as
 * authored until the camera moves, so a far ring must be drawn at its apparent size).
 */
export const seen = (size, z) => size / (1 + z);
