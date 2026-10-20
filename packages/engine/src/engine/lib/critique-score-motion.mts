import type { ScoreContext } from './critique-score-context.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';

import { has, LIFE } from './critique-score-context.mjs';
export function scoreMotion(ctx: ScoreContext): void {
  const { beats, steady, tell } = ctx;
  const n = beats.length;
  // 2. Build, then freeze: what still moves once the scene has landed.
  const alive = (b: CritiqueBeat) =>
    b.plate?.drift ||
    (b.block === 'canvas' &&
      (b.props?.world || b.props?.viewFrom || has(b.props, LIFE))) ||
    has(b.art, LIFE) ||
    (b.camera &&
      b.camera !== 'none' &&
      (typeof b.camera === 'string' || b.camera.move !== 'none') &&
      (typeof b.camera === 'string' ? 0.5 : (b.camera.amount ?? 0.5)) >= 0.6) ||
    b.block === 'kinetic';
  const frozen = beats.filter((b) => !alive(b)).length;
  if (!steady && frozen / n > 0.5)
    tell(
      'Build, then freeze',
      `${frozen} of ${n} scenes stop moving once they land. Inspect these holds against the brief. For business films, keep reading frames steady; reveal a meaningful change or shorten an accidental hold. Camera shake is not a remedy.`,
    );
}
