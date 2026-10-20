import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type { JobReport, JobBeat } from './types.mjs';

import { frameWorld } from './job-worlds-view.mjs';
import { carryWorld } from './job-worlds-elements.mjs';
import { moveWorldCamera } from './job-worlds-camera.mjs';
export { groundOf } from './job-worlds-elements.mjs';
/**
 * Canvas beats that name the same `world` are one drawing: each inherits everything drawn
 * before (on its original clock, so loops and exits carry on) and the camera travels from
 * the last view to the new one. Consecutive world beats cut invisibly; a world beat after
 * an interruption (a kinetic card, a chart) returns to where the camera left off.
 */
export function linkWorlds(
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
  { warnings }: JobReport,
) {
  const fps = timing.fps,
    last = new Map<string, JobBeat>();
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    frameWorld(b, timing, last, warnings);
    const name = b.block === 'canvas' && b.props.world;
    if (!name) continue;
    b.props.viewDrift ??= 0.03;
    const a = last.get(name);
    last.set(name, b);
    if (!a) continue;
    const adjacent = beats[i - 1] === a;
    carryWorld(a, b, fps);
    linkWorldPair(a, b, i, adjacent, beats, sb, timing);
  }
}

function linkWorldPair(
  a: JobBeat,
  b: JobBeat,
  i: number,
  adjacent: boolean,
  beats: JobBeat[],
  sb: Storyboard,
  timing: Timing,
): void {
  const fps = timing.fps;
  const src = sb.beats[timing.beats[i].index];
  // A graphic transition between two world beats cuts to the new view under its cover.
  const covered = adjacent && src.transition && src.transition !== 'cut';
  if (adjacent && !covered) {
    b.transition = 'cut';
    a.exit = 'none';
  }
  if (
    !covered &&
    !b.props.viewFrom &&
    JSON.stringify(a.props.view) !== JSON.stringify(b.props.view)
  )
    moveWorldCamera(a, b, fps, adjacent);
  for (const [beat, s] of [
    [a, sb.beats[timing.beats[beats.indexOf(a)].index]],
    [b, src],
  ] as const)
    if (!s.camera) beat.camera = { move: 'none' };
}
