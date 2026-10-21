import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobBeat } from './types.mjs';

export function castAdjacent(
  i: number,
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  warnings: string[],
): void {
  const [srcA, srcB] = [
    sb.beats[timing.beats[i - 1].index],
    sb.beats[timing.beats[i].index],
  ];
  if (
    srcA.props?.cast == null ||
    srcB.props?.cast == null ||
    beats[i].block !== 'canvas' ||
    beats[i - 1].block !== 'canvas'
  )
    return;
  if (srcB.transition && srcB.transition !== 'cut') {
    warnings.push(
      `${beats[i].id}: the cast carries across from ${beats[i - 1].id}; a ${srcB.transition} transition hides that, use cut.`,
    );
    return;
  }
  beats[i].transition = 'cut';
  beats[i - 1].exit = 'none';
  for (const [beat, src] of [
    [beats[i - 1], srcA],
    [beats[i], srcB],
  ] as const)
    if (!src.camera) beat.camera = { move: 'none' };
}
