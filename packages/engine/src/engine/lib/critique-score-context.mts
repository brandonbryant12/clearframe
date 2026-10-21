import type { ResolvedStoryboard, TimedBeat } from '../domain.mjs';
import type { CritiqueBeat } from './critique-contracts.mjs';
export interface ScoreShot {
  b: CritiqueBeat;
  i: number;
  dur: number;
}
export interface ScoreContext {
  sb: ResolvedStoryboard;
  beats: CritiqueBeat[];
  timed: TimedBeat[];
  transitions: string[];
  shots: ScoreShot[];
  steady: boolean;
  tell: (name: string, fix: string) => void;
}
export const has = (value: unknown, expression: RegExp): boolean =>
  expression.test(JSON.stringify(value ?? {}));
export const DEPTH = /"(z|dolly|focus|depth|tilt)"\s*:/;
export const LIFE =
  /"(loop|keys|along|dolly|steps)"\s*:|"type"\s*:\s*"particles"/;
export const joined = (beats: CritiqueBeat[], i: number): boolean =>
  Boolean(
    i > 0 &&
    beats[i].props?.world &&
    beats[i].props?.world === beats[i - 1].props?.world,
  );
export function scoreShots(
  beats: CritiqueBeat[],
  timed: TimedBeat[],
): ScoreShot[] {
  const shots: ScoreShot[] = [];
  beats.forEach((b, i) => {
    const previous = shots.at(-1);
    if (joined(beats, i) && previous) previous.dur += timed[i]?.dur ?? 0;
    else shots.push({ b, i, dur: timed[i]?.dur ?? 0 });
  });
  return shots;
}
