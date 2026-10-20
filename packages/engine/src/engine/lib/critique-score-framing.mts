import type { ScoreContext } from './critique-score-context.mjs';

import { FULL_FRAME } from './critique-common.mjs';

export function scoreFraming(ctx: ScoreContext): void {
  const { beats, tell } = ctx;
  const n = beats.length;
  // 5. Small subject, big room: how much of the film is full-frame picture.
  const full = beats.filter(FULL_FRAME).length;
  if (full / n < 0.35)
    tell(
      'Small subject, big room',
      `only ${full} of ${n} scenes use the whole frame. Vary the shot scale: full-bleed type, a plate, a tone, a close camera rect, a canvas without a heading.`,
    );
}
