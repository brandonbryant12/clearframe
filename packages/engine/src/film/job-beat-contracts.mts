import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { BlockProps, CanvasElement } from './types.mjs';
import type { BeatContext } from './job-types.mjs';
import type { beatBasics } from './job-beat-basics.mjs';
import type { beatTiming } from './job-beat-timing.mjs';
export type BeatBasics = ReturnType<typeof beatBasics>;
export type BeatTiming = ReturnType<typeof beatTiming>;
export type BeatState = BeatContext &
  BeatBasics &
  BeatTiming & { b: TimingBeat; props: BlockProps };
export type ArtScheduler = (
  list: CanvasElement[] | undefined,
  start: number,
  stagger?: number,
) => number;
