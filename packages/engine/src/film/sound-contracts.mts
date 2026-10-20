import type { NativeJob, JobBeat } from './types.mjs';
import type { AddSound } from './registry.mjs';
/** One step of the canvas clock from the beat inward: a stepped element or a shifted group. */
export interface ClockStep {
  fps?: number;
  shift?: number;
}
/** A sound cue on the film's clock. */
export interface SoundCue {
  name: string;
  t: number;
  volume: number;
}

export interface SoundContext {
  job: NativeJob;
  b: JobBeat;
  level: string;
  start: number;
  add: AddSound;
}
export type WeightedCue = SoundCue & { weight: number };
