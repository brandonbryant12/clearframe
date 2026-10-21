import { SFX } from '../engine/lib/sfx.mjs';
import { finite, isRecord } from './guards.mjs';
import type { Fail } from './types.mjs';

/**
 * A sound on an element (as it enters) or on a key (as it moves): a built-in effect by name, or
 * `{name, volume}` (0–1). The mix places it with the film's other effects (`sfx`).
 */
export function checkSound(v: unknown, where: string, fail: Fail): void {
  const name = soundName(v);
  if (typeof name !== 'string' || !Object.hasOwn(SFX, name))
    fail(
      `${where} must name a built-in sound (${Object.keys(SFX).join(', ')}), or be {name, volume}`,
    );
  if (
    isRecord(v) &&
    v.volume != null &&
    !(finite(v.volume) && v.volume >= 0 && v.volume <= 1)
  )
    fail(`${where}.volume must be 0–1`);
}

function soundName(value: unknown): unknown {
  if (typeof value === 'string') return value;
  return isRecord(value) ? value.name : undefined;
}
