import type { ClockStep } from './sound-contracts.mjs';
/**
 * The beat time at which an element's own moment `at` is first on screen, inverting the canvas
 * clock (scene/native/src/blocks/canvas.rs): each element steps `fps` times a second (it shows the
 * moment on its next drawing), and a group runs its children `shift` seconds ahead (a world beat
 * carrying earlier drawings forward). `clock` lists those steps from the beat inward.
 */
export function beatTime(at: number, clock: ClockStep[]): number {
  let t = at,
    moved = false;
  for (const step of [...clock].reverse()) {
    if (step.shift) {
      t -= step.shift;
      moved = true;
    }
    if (step.fps != null && step.fps > 0) {
      t = Math.ceil(t * step.fps - 1e-6) / step.fps;
      moved = true;
    }
  }
  // An element on the beat's own continuous clock keeps its authored time to the bit.
  return moved ? Math.round(t * 1e6) / 1e6 : at;
}
