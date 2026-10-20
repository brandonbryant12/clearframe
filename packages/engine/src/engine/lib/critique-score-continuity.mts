import type { ScoreContext } from './critique-score-context.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';
import { sameStage, sameCast, diagramIds } from './critique-common.mjs';
import { isRecord } from './errors.mjs';

export function scoreContinuity(ctx: ScoreContext): void {
  const { beats, transitions, tell } = ctx;
  const n = beats.length;
  // 1. Continuity: worlds, morphs by shared id, graphic wipes, or a cut between two moving
  // cameras (cutting on action, the grammar of a montage).
  const travelling = (b: CritiqueBeat) =>
    b.block === 'canvas' &&
    (b.props?.world ||
      b.props?.viewFrom ||
      b.props?.dolly ||
      (isRecord(b.props?.focus) && b.props.focus.keys));
  // A graphic wipe hides a cut rather than carrying anything across it: half credit.
  let carried = 0;
  // A system diagram's components keep their ids, so a shared node carries across the cut.
  const ids = (b: CritiqueBeat) =>
    new Set(
      [
        ...(b.props?.elements ?? []).map((el) => el.id),
        ...diagramIds(b),
        ...(b.props?.chart ? ['chart'] : []),
      ].filter(Boolean),
    );
  const chartIds = (b: CritiqueBeat) =>
    Array.isArray(b.props?.chart?.values)
      ? b.props.chart.values
          .filter(isRecord)
          .map((v) => `${b.props?.chart?.id ?? 'chart'}-${v.id ?? v.label}`)
      : [];
  for (let i = 1; i < n; i++) {
    const [a, b] = [beats[i - 1], beats[i]];
    const before = new Set([...ids(a), ...chartIds(a)]);
    if (
      (b.props?.world && b.props.world === a.props?.world) ||
      sameStage(a, b) ||
      sameCast(a, b) ||
      [...ids(b), ...chartIds(b)].some(
        (id) => id !== 'chart' && before.has(id),
      ) ||
      (travelling(a) && travelling(b))
    )
      carried++;
    // Going into an element of the last scene carries the eye through it; a push or a panel
    // carries a movement across.
    else if (transitions[i] === 'into') carried++;
    else if (['panel', 'push'].includes(transitions[i])) carried += 0.5;
  }
  if (carried < (n - 1) / 4)
    tell(
      'Card per line',
      `only ${carried} of ${n - 1} cuts carry anything across. Make runs of drawings one world, keep a cast of the film's objects, or morph a shape into the next scene (same id).`,
    );
}
