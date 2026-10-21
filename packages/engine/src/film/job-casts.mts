import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, JobBeat } from './types.mjs';

import { type JobCast } from './job-types.mjs';

import { castColor } from './job-cast-color.mjs';
import { castAdjacent } from './job-cast-adjacent.mjs';
/**
 * A cast carries its objects across cuts by handing each beat's end state to the next, so the
 * picture must not move under them: consecutive cast beats cut (no exit, no transition) and hold
 * the camera still unless the author set one.
 */
export function linkCasts(
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  { warnings }: JobReport,
  cast: JobCast = {},
) {
  for (let i = 0; i < beats.length; i++)
    castColor(i, beats, sb, timing, warnings, cast);
  for (let i = 1; i < beats.length; i++)
    castAdjacent(i, beats, sb, timing, warnings);
}
