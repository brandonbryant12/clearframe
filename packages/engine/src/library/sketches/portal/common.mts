import { round, tall } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: { device?: string };
}

// A task done in an app, step by step: the cursor opens a section, picks a card, changes one
// value and saves; a confirmation lands and the view leans in on the new value. Every click is
// a named moment (CLICK1, CLICK2, CHANGE, SAVE), so each lands on the word that names it, and
// the cursor travels to its next target while the voice gets there. Drawn, not a screenshot:
// it shows where to go, so it carries a product's words but never its figures.
export const AT = { CLICK1: 1.4, CLICK2: 3.2, CHANGE: 5.0, SAVE: 6.8 };

export const cursorPath = (x: number, y: number) =>
  `M ${x} ${y} L ${x} ${y + 40} L ${x + 10} ${y + 31} L ${x + 17} ${y + 47} L ${x + 25} ${y + 44} L ${x + 18} ${y + 28} L ${x + 31} ${y + 28} Z`;

export function windowLayout(phone: boolean, w: number, h: number, T: boolean) {
  if (phone) {
    if (tall(w, h)) {
      return { x: 190, y: 300, w: 700, h: 1220 };
    }
    return { x: round(w / 2 - 280), y: 90, w: 560, h: 720 };
  }
  if (T) {
    return { x: 70, y: 360, w: 940, h: 1160 };
  }
  return { x: 300, y: 100, w: 1320, h: 710 };
}
