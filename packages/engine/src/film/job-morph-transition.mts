import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobBeat } from './types.mjs';

export function morphTransition(
  a: JobBeat,
  b: JobBeat,
  i: number,
  sb: Storyboard,
  timing: Timing,
  warnings: string[],
): void {
  const src = sb.beats[timing.beats[i].index];
  if (src.transition && src.transition !== 'cut')
    warnings.push(
      `${b.id}: elements morph from ${a.id}; a ${src.transition} transition hides the morph, use cut.`,
    );
  else {
    b.transition = 'cut';
    a.exit = 'none';
  }
  // A camera move would shift one side of the cut; morphing pairs hold still unless authored.
  for (const [beat, s] of [
    [a, sb.beats[timing.beats[i - 1].index]],
    [b, src],
  ] as const)
    if (!s.camera) beat.camera = { move: 'none' };
  if (
    a.block === 'canvas' &&
    b.block === 'canvas' &&
    JSON.stringify(a.props.view ?? null) !==
      JSON.stringify(b.props.view ?? null)
  )
    warnings.push(
      `${b.id}: morphing canvases use different views; positions will jump.`,
    );
}
