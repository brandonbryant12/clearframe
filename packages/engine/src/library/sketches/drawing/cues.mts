import type { ElementKey } from '../../../film/contracts/canvas-effects.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { required, type CueTiming } from './contracts.mjs';

export function cueWriter(
  timeline: Readonly<Record<string, number | undefined>>,
  keepZero = false,
) {
  function cued(cue: string, delay?: number): CueTiming;
  function cued<Extra extends ElementKey>(
    cue: string,
    delay: number | undefined,
    extra: Extra,
  ): CueTiming & Extra;
  function cued(
    cue: string,
    delay = 0,
    extra: ElementKey = {},
  ): CueTiming & ElementKey {
    return {
      cue,
      at: round(required(timeline[cue], `${cue} moment`) + delay),
      ...(keepZero || delay ? { after: round(delay) } : {}),
      ...extra,
    };
  }
  return cued;
}
