import { type AddSound } from './registry.mjs';
import type { NativeJob } from './types.mjs';
import type { SoundCue, SoundContext } from './sound-contracts.mjs';

export type { ClockStep, SoundCue } from './sound-contracts.mjs';
export { beatTime } from './sound-clock.mjs';
const LEVELS = { subtle: 0.6, normal: 1, punchy: 1.35 };
import { automaticSounds } from './sound-automatic.mjs';
import { authoredSounds } from './sound-authored.mjs';
import { visualSounds } from './sound-visual.mjs';
import { kineticSounds } from './sound-kinetic.mjs';
import { selectSounds } from './sound-select.mjs';
/** `sfx`: true/'normal', 'subtle', 'punchy', or false/'off'. */
export function soundDesign(job: NativeJob, sfx: unknown): SoundCue[] {
  const level = sfx === true ? 'normal' : sfx;
  const gain = Object.entries(LEVELS).find(([name]) => name === level)?.[1];
  if (typeof level !== 'string' || gain === undefined) return [];
  const cues: (SoundCue & { weight: number })[] = [];
  // Nothing fires on the first frames: a film opens on its picture, not on a click.
  const add: AddSound = (name, t, volume, weight = 1) => {
    if (t >= 0.2 && t < job.frames / job.fps)
      cues.push({ name, t, volume: volume * gain, weight });
  };
  for (const b of job.beats) {
    const ctx: SoundContext = {
      job,
      b,
      level,
      start: b.start_frame / job.fps,
      add,
    };
    automaticSounds(ctx);
    if (b.block === 'canvas') authoredSounds(ctx, b.props.elements);
    visualSounds(ctx);
    kineticSounds(ctx);
  }
  return selectSounds(cues);
}
