import type { Motion, Lens } from './types.mjs';

import { isRecord } from './guards.mjs';
import { MOTIONS } from './catalog.mjs';

import { LENS_KEYS, RETIRED_LENS } from './constants.mjs';

export const unit = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

export const validMotion = (m: Motion) =>
  MOTIONS.includes(m.preset) && unit(m.intensity);

/** Check a film or beat `lens`: `blur`, the motion-blur shutter (0–1), is its one setting. */
export function lensSpec(v: unknown, where = 'lens'): Lens | null {
  if (v == null) return null;
  if (!isRecord(v)) throw new Error(`${where} must be an object`);
  for (const [key, value] of Object.entries(v)) {
    if (RETIRED_LENS.includes(key))
      throw new Error(
        `${where}.${key} was retired: the library no longer uses film looks; remove it`,
      );
    if (!LENS_KEYS.includes(key))
      throw new Error(
        `${where}.${key} is not a lens setting (${LENS_KEYS.join(', ')})`,
      );
    if (!unit(value)) throw new Error(`${where}.${key} must be 0–1`);
  }
  return typeof v.blur === 'number' ? { blur: v.blur } : {};
}
