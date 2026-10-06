// Original vector artwork helpers. No imported imagery, fonts, random state or runtime APIs.
import { round, rng } from '../../film/sketch-kit.mjs';
export { round, smoothPath, rng } from '../../film/sketch-kit.mjs';
export const still = (type, props) => ({ type, at: 0, enter: 'none', ...props });
export const group = (children, props = {}) => still('group', { children, ...props });
export const line = (a, b, props = {}) => still('line', {
  x1: round(a[0]), y1: round(a[1]), x2: round(b[0]), y2: round(b[1]),
  fill: 'none', stroke: 'accent', width: 2, ...props,
});
export const poly = (points, fill, props = {}) => still('poly', {
  points: points.map(p => p.map(round)), closed: true, fill, stroke: 'none', ...props,
});
export const circle = (cx, cy, r, fill, props = {}) => still('circle', {
  cx: round(cx), cy: round(cy), r: round(r), fill, stroke: 'none', ...props,
});
export const wash = (cx, cy, rx, ry, color, opacity = 0.2) => still('ellipse', {
  cx: round(cx), cy: round(cy), rx: round(rx), ry: round(ry),
  fill: { gradient: [color, color], radial: true, fade: true }, stroke: 'none', opacity,
});
export const gradient = (colors, angle = 90) => ({ gradient: colors, angle });
// Seeded, bounded variation: j(a) lies in [-a, a]. Without a seed every value is 0, the
// reference layout shown in the atlas. Variations stay small enough to keep the copy region.
export const jitter = seed => {
  const r = seed == null ? null : rng(seed);
  return a => (r ? (r() * 2 - 1) * a : 0);
};
export const frame = (w, h) => ({
  tall: h > w * 1.1, m: Math.min(w, h),
  // The top third in portrait and the left half in landscape stay available for copy.
  cx: w * (h > w * 1.1 ? 0.55 : 0.76), cy: h * (h > w * 1.1 ? 0.67 : 0.56),
});
