import type { CanvasElement, PointerStep } from './types.mjs';
import type { pointerContext } from './pointer-context.mjs';
/** An element found by id, with the offset of the groups it sits in. */
export interface Indexed {
  el: CanvasElement;
  dx: number;
  dy: number;
}

/** A step with the element it presses and the spot its tip rests on. */
export interface PlacedStep extends PointerStep {
  target: Indexed | null | undefined;
  spot: number[];
  press: boolean;
}

export type PointerContext = ReturnType<typeof pointerContext>;
