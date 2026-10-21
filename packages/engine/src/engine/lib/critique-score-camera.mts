import type { ScoreContext } from './critique-score-context.mjs';

import { has, DEPTH } from './critique-score-context.mjs';
export function scoreCamera(ctx: ScoreContext): void {
  const { beats, steady, tell } = ctx;
  // 4. Locked, flat camera.
  const deep = beats.some(
    (b) => (b.block === 'canvas' && has(b.props, DEPTH)) || has(b.art, DEPTH),
  );
  const moved = beats.some(
    (b) =>
      b.props?.viewFrom ||
      b.props?.world ||
      (b.camera && b.camera !== 'none' && b.camera !== 'auto'),
  );
  if (!steady && !deep && !moved)
    tell(
      'Locked, flat camera',
      'no depth and no camera move anywhere. Use z layers with a dolly or focus pull, a world whose camera travels, or a camera move on a revelation.',
    );
}
