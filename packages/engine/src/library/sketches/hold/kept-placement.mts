import { round } from '../../../film/sketch-kit.mjs';
import type { holdTags } from './tags.mjs';
export function keptPlacement(
  context: ReturnType<typeof holdTags>,
  iu: number,
  id: number,
  end: number,
  kw: number,
  kh: number,
  pad: number,
) {
  const { pts, lockY, falls, x0, x1 } = context;
  const xa = pts[iu][0],
    xb = pts[end][0];
  let best: { cx: number; top: number; room: number } | null = null;
  for (let cx = xa + kw / 2 + pad; cx <= xb - kw / 2 - pad; cx += 8) {
    const span = pts.filter(
      ([x]) => x >= cx - kw / 2 - pad && x <= cx + kw / 2 + pad,
    );
    const lowest = Math.max(...span.map((p) => p[1]));
    const room = lockY - lowest;
    if (room >= kh + 2 * pad && (!best || room > best.room + 4))
      best = { cx, room, top: round(lowest + (room - kh) / 2) };
  }
  let place: { cx: number; top: number } | null = best;
  if (!place) {
    // Under the lock line, beneath the shaded gap, clear of the lock's own tag.
    let cx = round((xa + xb) / 2);
    if (falls) cx = Math.min(cx, round(pts[id][0] - kw / 2 - 20));
    cx = Math.min(Math.max(cx, x0 + kw / 2), x1 - kw / 2);
    place = { cx, top: lockY + 26 };
  }
  return place;
}
