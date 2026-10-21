import type { SoundRef } from './types.mjs';
import type { ClockStep, SoundContext } from './sound-contracts.mjs';
import { beatTime } from './sound-clock.mjs';
export function soundHit(
  ctx: SoundContext,
  clock: ClockStep[],
): (v: SoundRef, at: number | null | undefined) => void {
  const { job, b, start, add } = ctx;
  return (v: SoundRef, at: number | null | undefined): void => {
    const t = at == null ? null : beatTime(at, clock);
    if (t != null && t >= 0 && Math.ceil(t * job.fps - 1e-6) < b.frames)
      add(
        typeof v === 'string' ? v : v.name,
        start + t,
        typeof v === 'object' && v.volume != null ? v.volume : 0.3,
        4,
      );
  };
}
