import { round } from '../../../film/sketch-kit.mjs';
import type { CarryoverLayoutContext } from './contracts.mjs';

export function carryoverLayout({
  T,
  w,
  h,
  count,
  icons,
  words,
}: CarryoverLayoutContext) {
  const side = T ? round(w * 0.115) + 4 : 160;
  const mid = round(w / 2);
  const lane = T ? 28 : 110;
  const colW = round(mid - side - lane);
  const [left, right] = [side, round(mid + lane)];
  const across = right - left;
  const top = round(h * (T ? 0.2 : 0.15));
  const head = 44;
  const gap = T ? 26 : 22;
  const room = h * (T ? 0.78 : 0.74) - top - head - 50;
  const cardH = round(
    Math.min(T ? 140 : 118, (room - (count - 1) * gap) / count),
  );
  // One type size for every card, the largest the longest label fits at (about 0.58 em a letter
  // in the strong face), between the icon and the tick.
  // Beside the label on a wide frame; above it on a tall one, where the columns are narrow and
  // the label needs the card's whole width to be read on a phone.
  const above = T && icons.length > 0;
  const start = icons.length && !above ? 100 : 34;
  const longest = Math.max(
    8,
    ...Array.from(
      { length: count },
      (_, i) => String(words[`ITEM${i + 1}`] ?? '').length,
    ),
  );
  const size = round(
    Math.max(
      32,
      Math.min(
        T ? 44 : 50,
        cardH * 0.42,
        (colW - start - 84) / (longest * 0.58),
      ),
    ),
  );
  const stackH = count * cardH + (count - 1) * gap;
  const y0 = round(top + head + 50 + Math.max(0, room - stackH) * 0.3);
  // The reset chip, as wide as its word (about 0.6 em a letter in the bold face), within its slot.
  const chipW = Math.round(
    Math.min(
      colW - 40,
      Math.max(150, String(words.RESET ?? '').length * 40 * 0.6 + 64),
    ),
  );
  return {
    mid,
    colW,
    left,
    right,
    across,
    top,
    head,
    gap,
    cardH,
    above,
    start,
    size,
    stackH,
    y0,
    chipW,
  };
}
