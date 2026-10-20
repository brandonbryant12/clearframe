import type { PointerContext } from './pointer-contracts.mjs';
import { when, travel } from './pointer-common.mjs';
export function pointerMotion(ctx: PointerContext): void {
  const { p, steps, size, from, xs, ys, press, ripple } = ctx;
  let here: number[] = from;
  for (const s of steps) {
    const dur = travel(here, s.spot);
    xs.push({
      ...when(s, -(dur + 0.12)),
      x: s.spot[0] - from[0],
      dur,
      ease: 'inOut',
    });
    ys.push({
      ...when(s, -(dur + 0.12)),
      y: s.spot[1] - from[1],
      dur,
      ease: 'out',
    });
    if (s.press) {
      press.push({
        ...when(s),
        scale: 0.84,
        dur: 0.18,
        ease: 'thereAndBack',
        ...(p.sound === false ? {} : { sound: p.sound ?? 'click' }),
      });
      // A ring spreads from the point pressed and is gone in half a second: the press reads
      // even where the cursor covers what it pressed.
      ripple.push(
        { ...when(s), scale: 0.5, opacity: 0.6, dur: 0 },
        { ...when(s), scale: 1.9, opacity: 0, dur: 0.5, ease: 'out' },
      );
      // The thing pressed answers: it dips, then settles where it was.
      if (s.target)
        s.target.el.keys = [
          ...(s.target.el.keys ?? []),
          { ...when(s, 0.02), scale: 0.965, dur: 0.22, ease: 'thereAndBack' },
        ];
    }
    here = s.spot;
  }
  const last = steps[steps.length - 1];
  // After the last press the hand moves off what it pressed, so the change it made is seen.
  if (last.press && !p.leave) {
    xs.push({
      ...when(last, 0.45),
      x: last.spot[0] - from[0] + size * 1.2,
      dur: 0.7,
      ease: 'inOut',
    });
    ys.push({
      ...when(last, 0.45),
      y: last.spot[1] - from[1] + size * 0.9,
      dur: 0.7,
      ease: 'inOut',
    });
  }
}
