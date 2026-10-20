import { finite } from '../guards.mjs';
import type { Fail, TargetInput, TargetSpec } from '../types.mjs';
import { thrown } from './movement.mjs';

/** Whether a view-like value asks for a target instead of coordinates. */
export const isTarget = (v: unknown): v is TargetInput =>
  v != null && typeof v === 'object' && !Array.isArray(v) && 'on' in v;

/** Check `{on, pad, state}`; `fail(message)` throws with the caller's context. */
export function targetSpec(
  v: unknown,
  where: string,
  fail: Fail = thrown,
): TargetSpec {
  if (!isTarget(v))
    fail(`${where} must be {on: an element id or [ids], pad?, state?}`);
  for (const k of Object.keys(v))
    if (!['on', 'pad', 'state'].includes(k))
      fail(`${where}: unsupported field ${k} (a target takes on, pad, state)`);
  const ids = Array.isArray(v.on) ? v.on : [v.on];
  if (
    !ids.length ||
    ids.length > 8 ||
    ids.some((id) => typeof id !== 'string' || !id.trim())
  )
    fail(`${where}.on names 1–8 element ids`);
  if (v.pad != null && !(finite(v.pad) && v.pad >= 0 && v.pad <= 2))
    fail(
      `${where}.pad is 0–2 (a fraction of the target's size added on every side; 0.15 by default)`,
    );
  if (v.state != null && !['start', 'end'].includes(v.state))
    fail(
      `${where}.state is "start" (as authored) or "end" (where its keys leave it)`,
    );
  return { ids, pad: v.pad ?? 0.15, state: v.state ?? null };
}
