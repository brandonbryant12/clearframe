import type { ScoreContext } from './critique-score-context.mjs';

import { has } from './critique-score-context.mjs';
export function scoreLight(ctx: ScoreContext): void {
  const { sb, beats, steady, tell } = ctx;
  // 7. Screen-flat image.
  const glow = beats.some((b) => has(b.props, /"(glow|shine|spotlight)"/));
  if (!steady && !glow && !sb.texture)
    tell(
      'Screen-flat image',
      'no light or texture. Add a little grain, and light the subject (shine, spotlight) where it matters.',
    );
}
