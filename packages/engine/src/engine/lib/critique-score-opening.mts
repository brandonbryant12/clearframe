import type { ScoreContext } from './critique-score-context.mjs';

import { isRecord } from './errors.mjs';

export function scoreOpening(ctx: ScoreContext): void {
  const { beats, tell } = ctx;
  // 9. The first frame: something to look at before anyone speaks.
  const first = beats[0];
  const pictured =
    first?.plate ||
    (first?.tone && first.tone !== 'none') ||
    (first?.block === 'canvas' &&
      (present(first.props?.elements) || first.props?.plates)) ||
    (first?.block === 'stage' &&
      (present(first.props?.elements) || present(first.props?.under))) ||
    present(first?.stage?.under) ||
    present(first?._stageFirst?.under) ||
    present(first?.art?.under) ||
    present(first?.art?.over);
  if (first && !pictured)
    tell(
      'Opens on an empty frame',
      `the first frames of ${first.id} show only the background while its picture builds. Put the establishing picture on frame one (elements at 0 with enter "none") and animate only the details in.`,
    );
}

function shown(value: Record<string, unknown>): boolean {
  return (
    value.type !== 'particles' &&
    Number(value.at ?? 1) <= 0.05 &&
    (value.enter === 'none' ||
      value.dur === 0 ||
      (value.at === 0 && value.dur === 0))
  );
}
function present(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value
    .filter(isRecord)
    .some(
      (el) =>
        shown(el) ||
        (el.type === 'group' &&
          Number(el.at ?? 1) <= 0.05 &&
          present(el.children)),
    );
}
