import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobBeat } from './types.mjs';

import { type JobCast } from './job-types.mjs';

export function castColor(
  i: number,
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  warnings: string[],
  cast: JobCast,
): void {
  const edges = cast.edges?.[beats[i].id];
  for (const [tone, j] of [
    [edges?.fill, i + 1],
    [edges?.emerge, i - 1],
  ] as const) {
    if (!tone || !beats[j]) continue;
    const src = sb.beats[timing.beats[j].index];
    if (src.props?.cast != null) continue;
    if (src.tone && src.tone !== tone) {
      warnings.push(
        `${beats[j].id}: its tone ${src.tone} differs from the ${tone} the cast hands it in ${beats[i].id}; the cut will flash.`,
      );
      continue;
    }
    const [a, b] = j > i ? [beats[i], beats[j]] : [beats[j], beats[i]],
      authored = sb.beats[timing.beats[beats.indexOf(b)].index].transition;
    beats[j].tone = tone;
    if (authored && authored !== 'cut') {
      warnings.push(
        `${b.id}: a ${authored} transition hides the colour handoff from the cast; use cut.`,
      );
      continue;
    }
    a.exit = 'none';
    b.transition = 'cut';
  }
}
