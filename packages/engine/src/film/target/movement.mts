import type { CanvasElement, Fail } from '../types.mjs';

export const thrown: Fail = (m) => {
  throw new Error(m);
};

// Key fields that change where an element is drawn. The native pose (canvas.rs) multiplies a key's
// `scale` with its `scaleX`/`scaleY`; turns, tilts and depth are not boxes this module can prove.
export const MOVES = [
  'x',
  'y',
  'scale',
  'scaleX',
  'scaleY',
  'rotate',
  'tiltX',
  'tiltY',
] as const;

export type Move = (typeof MOVES)[number];

// Loops that move or resize what they loop (dash, blink and level leave the box alone).
export const MOVING_LOOPS = ['spin', 'pulse', 'float', 'sway', 'orbit', 'rock'];

/** Why an element's drawn box is not its authored box, or null when it is. */
export function unprovable(el: CanvasElement): string | null {
  if ((el.rotate ?? 0) !== 0) return 'is turned';
  if (el.scale != null && el.scale !== 1) return 'is scaled';
  if (el.z != null || el.depth != null) return 'is placed in depth';
  if (el.tilt != null) return 'is tilted';
  if (el.loop && MOVING_LOOPS.includes(el.loop.type))
    return `moves in a ${el.loop.type} loop`;
  if (
    (el.keys ?? []).some(
      (k) => k.rotate != null || k.tiltX != null || k.tiltY != null,
    )
  )
    return 'turns or tilts in its keys';
  return null;
}
