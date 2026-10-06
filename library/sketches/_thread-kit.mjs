import { round, tall } from '../../film/sketch-kit.mjs';

// A pair of camera stations, redrawn for the frame instead of cropped. The
// thread continues at the same anchor in both shots and never depicts data.
export function threadLayout(w, h) {
  const vertical = tall(w, h), unit = Math.min(w, h);
  return {
    vertical, unit,
    shift: vertical ? [0, h * 0.88] : [w * 0.88, 0],
    point(x, y) { return [round(w * x), round(h * y)]; },
  };
}

export function movePath(d, dx, dy) {
  // These authored paths contain only absolute M, C and L pairs.
  let index = 0;
  return d.replace(/-?\d+(?:\.\d+)?/g, number => round(Number(number) + (index++ % 2 ? dy : dx)));
}
