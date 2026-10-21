import { decodeDepthKey } from './canvas-schema.mjs';
import { finite, isList, isObject, oneOf } from './guards.mjs';
import type { DepthKey, Fail } from './types.mjs';
import { EASES } from './canvas-catalog.mjs';

/** Camera depth keys for a canvas: `dolly` moves the camera through `z` (a fly-through). */
export function depthKeys(
  list: unknown,
  where: string,
  fail: Fail,
): DepthKey[] {
  if (!isList(list) || !list.length || list.length > 12)
    fail(`${where} must be 1–12 keys {at|say, z, dur, ease}`);
  return list.map((k, i) => {
    if (!isObject(k)) fail(`${where}[${i}] must be an object`);
    for (const key of Object.keys(k))
      if (!['at', 'say', 'z', 'dur', 'ease'].includes(key))
        fail(`${where}[${i}]: unsupported field ${key}`);
    if (k.at == null && k.say == null)
      fail(`${where}[${i}] needs at (seconds) or say (spoken cue)`);
    if (!finite(k.z) || k.z <= -0.9 || k.z > 50)
      fail(`${where}[${i}].z must be above -0.9 and at most 50`);
    if (k.dur != null && (!finite(k.dur) || k.dur < 0 || k.dur > 30))
      fail(`${where}[${i}].dur must be 0–30 seconds`);
    if (k.ease != null && !oneOf(EASES, k.ease))
      fail(`${where}[${i}].ease must be one of ${EASES.join(', ')}`);
    // Checked above (say resolves when the job schedules the beat).
    return decodeDepthKey(k);
  });
}
