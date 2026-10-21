import crypto from 'node:crypto';
import { touched } from './agent.mjs';
import { canonical } from '../store.mjs';
import type { Storyboard } from '../../domain.mjs';
import { isRecord } from '../harness/contracts.mjs';
import { getAt, type MessageScope } from './contracts.mjs';
const without = (object: unknown, path: string) => {
  const copy = structuredClone(object),
    parts = path.split('.'),
    last = parts.pop();
  const parent = getAt(copy, parts.join('.'));
  if (parent && typeof parent === 'object' && last)
    Reflect.deleteProperty(parent, last);
  return copy;
};

/**
 * Why a candidate change falls outside the scope the person pinned, or null. Scene, range, moment and
 * a note on a scene limit edits to their scenes (no film settings, no reordering, no new scenes); a
 * layer limits them to that one element of its scene, found by its own id or by its index while its
 * list keeps the length it had when pinned. Whole-film, whole-cut notes and files do not limit edits.
 */
export function scopeViolation(
  scope: MessageScope | null | undefined,
  before: Storyboard,
  after: Storyboard,
  { runEdited = false }: { runEdited?: boolean } = {},
) {
  if (
    !scope ||
    !['scene', 'layer', 'range', 'moment', 'note'].includes(scope.kind) ||
    !scope.beats?.length
  )
    return null;
  const t = touched(before, after),
    allowed = new Set(scope.beats);
  const outside = t.beats.filter((b) => !allowed.has(b));
  const problems = [
    outside.length && `scenes ${outside.join(', ')}`,
    t.film && 'film-wide settings',
    t.order && 'the scene order',
  ].filter(Boolean);
  if (problems.length) return `also changes ${problems.join(' and ')}`;
  if (scope.kind !== 'layer') return null;
  return layerViolation(scope, before, after, runEdited);
}

function layerViolation(
  scope: MessageScope,
  before: Storyboard,
  after: Storyboard,
  runEdited: boolean,
): string | null {
  const id = scope.beats?.[0],
    b0 = before.beats.find((b) => b.id === id),
    b1 = after.beats.find((b) => b.id === id);
  if (!b1) return 'removes the scene that holds the pinned layer';
  const L = scope.layer;
  if (!L) return 'the pinned layer has no recorded identity; pin it again';
  const l0 = getAt(b0, L.list),
    l1 = getAt(b1, L.list);
  if (!Array.isArray(l0)) return "the pinned layer's list is gone";
  const atIndex = l0.length === L.length ? L.index : -1;
  const i =
    L.id != null
      ? l0.findIndex((e: unknown) => isRecord(e) && e.id === L.id)
      : atIndex;
  // Until this request's own first edit, the element must still be exactly what the person pinned.
  const same =
    i >= 0 &&
    (runEdited ||
      !L.sig ||
      crypto
        .createHash('sha256')
        .update(canonical(l0[i]))
        .digest('hex')
        .slice(0, 16) === L.sig);
  if (i < 0 || !same || (L.type && l0[i]?.type !== L.type))
    return 'the pinned layer moved or changed since it was pinned (the person may have edited the scene); ask them to pin it again';
  if (canonical(without(b0, L.list)) !== canonical(without(b1, L.list)))
    return 'also changes other properties of the scene';
  const others0 = l0.filter((_, k) => k !== i);
  const ok =
    Array.isArray(l1) &&
    ((l1.length === l0.length &&
      canonical(l1.filter((_, k) => k !== i)) === canonical(others0)) ||
      (l1.length === l0.length - 1 && canonical(l1) === canonical(others0)));
  return ok ? null : 'also changes other layers in the scene';
}
