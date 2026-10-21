import type { ElementFields } from '../types.mjs';

export function edgeAnchor(
  index: number,
  last: number,
): ElementFields['anchor'] {
  if (index === 0) return 'start';
  return index === last ? 'end' : 'middle';
}

export function labelStart(
  index: number,
  last: number,
  x: number,
  width: number,
): number {
  if (index === 0) return x;
  return index === last ? x - width : x - width / 2;
}
