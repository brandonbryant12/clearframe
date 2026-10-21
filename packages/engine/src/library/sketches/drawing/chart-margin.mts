import { round } from '../../../film/sketch-kit.mjs';
export function chartMargin(w: number, h: number, wide: boolean) {
  if (wide) return 150;
  return h > w ? round(w * 0.1 + 24) : 84;
}
