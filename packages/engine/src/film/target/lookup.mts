import type { CanvasElement } from '../types.mjs';
import { unprovable, MOVES } from './movement.mjs';

/** An element found by id, the offset its groups add, and the group that keeps its box from being exact. */
export interface Hit {
  el: CanvasElement;
  dx: number;
  dy: number;
  inside?: string;
  moving?: string;
}

/** Find an element by id anywhere in a list, with the offset its groups add. */
export function find(
  list: CanvasElement[] | undefined,
  id: string,
  dx = 0,
  dy = 0,
): Hit | null {
  for (const el of list ?? []) {
    if (el.id === id) return { el, dx, dy };
    if (el.type !== 'group') continue;
    const hit = findInGroup(el, id, dx, dy);
    if (hit) return hit;
  }
  return null;
}

export function findInGroup(
  group: CanvasElement,
  id: string,
  dx: number,
  dy: number,
): Hit | null {
  const hit = find(
    group.children,
    id,
    dx + (group.x ?? 0),
    dy + (group.y ?? 0),
  );
  if (!hit) return null;
  const scaled = group.scale != null && group.scale !== 1;
  if (scaled || unprovable(group)) hit.inside = group.id ?? 'a group';
  if (
    group.keys?.some((key) => MOVES.some((move) => key[move] != null)) ||
    group.along
  )
    hit.moving = group.id ?? 'a group';
  return hit;
}
