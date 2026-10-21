import { fieldArrows } from './field-arrows.mjs';
import { fieldParticles } from './field-particles.mjs';
import type { CanvasElement, FrameSize, Point } from '../types.mjs';
import { round, tall, cue, HALO } from './shared.mjs';
import { decodeField } from './specs.mjs';
/** The flow fields: name → (u, v) in [-1, 1]² → velocity. */
export const FIELDS = {
  drift: (_u: number, _v: number): Point => [1, 0],
  swirl: (u: number, v: number): Point => [-v, u],
  source: (u: number, v: number): Point => [u, v],
  sink: (u: number, v: number): Point => [-u, -v],
  saddle: (u: number, v: number): Point => [u, -v],
  // Downhill on the bowl u² + 3v²: steep across the valley, gentle along it (gradient descent).
  valley: (u: number, v: number): Point => [-2 * u, -6 * v],
};

/**
 * field: {kind, box?, arrows?: true, particles?: 6–40, seed?, show?: {say|at}, flow?: {say|at, dur},
 *   labels?: [{text, pos: [u, v], say|at}]}
 * Arrows on a grid show the push at every point (direction exact; length varies with relative strength); particles
 * follow streamlines numerically integrated with RK4 (sampled as polylines, so approximate), so
 * where things go is a consequence of the field. Each particle travels its streamline at a constant
 * pace over `dur`: the routes follow the field, the speeds do not (a sink's particles do not slow).
 * The kinds are textbook shapes chosen for a picture, not models fitted to a crowd or a market.
 */
export function fieldElements(
  input: unknown,
  frame: Partial<FrameSize> = {},
): CanvasElement[] {
  const spec = decodeField(input);
  const F = Object.entries(FIELDS).find(([name]) => name === spec.kind)?.[1];
  if (!F)
    throw new Error(
      `field.kind must be one of ${Object.keys(FIELDS).join(', ')}`,
    );
  const T = tall(frame),
    [bx, by, bw, bh] =
      spec.box ?? (T ? [90, 420, 900, 1240] : [180, 150, 1560, 780]);
  const P = (u: number, v: number): Point => [
    round(bx + ((u + 1) / 2) * bw),
    round(by + ((1 - v) / 2) * bh),
  ];
  const els: CanvasElement[] = [];
  const show = cue(spec.show, 0.3);
  if (spec.arrows !== false) els.push(fieldArrows(F, P, bw, bh, T, show));
  els.push(...fieldParticles(spec, F, P, T));
  for (const l of spec.labels ?? []) {
    const [x, y] = P(...(l.pos ?? [0, 0]));
    els.push({
      type: 'text',
      text: l.text,
      x,
      y,
      size: T ? 40 : 34,
      font: 'semibold',
      fill: 'ink',
      anchor: 'middle',
      shadow: HALO,
      enter: 'fade',
      ...cue(l, 1),
    });
  }
  return els;
}
