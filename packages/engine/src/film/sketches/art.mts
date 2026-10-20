import type { CanvasElement } from '../types.mjs';
import type { Art as AuthoredArt } from '../../engine/domain.mjs';
import { item } from '../library.mjs';
import { fillSketch } from './fill.mjs';
const sketchByName = (name: string) => item('sketches', name);
interface ArtFrame {
  width?: number;
  height?: number;
  duration?: number;
}
/** Expand the existing playbook art.sketch shorthand for any authored storyboard.
 * Art is frame-space scenery: scene cameras and text belong in a canvas block instead.
 * `drift` (0–1) pushes the art in over the beat, a parallax move under steady copy; the
 * seed picks the direction of its sideways travel.
 */
export function expandArt(
  art: AuthoredArt,
  { width = 1920, height = 1080, duration = 8 }: ArtFrame = {},
) {
  if (art?.sketch == null) return art;
  validateArt(art);
  const source = sketchByName(art.sketch);
  if (!source)
    throw new Error(
      `Unknown sketch ${art.sketch}. Run clearframe sketch to list them.`,
    );
  const drawn = source.build(width, height, { seed: art.seed });
  fillSketch(drawn.elements);
  if (
    drawn.layer !== 'under' ||
    (['view', 'viewFrom', 'dolly', 'focus', 'world'] as const).some(
      (k) => drawn[k] != null,
    )
  )
    throw new Error(
      `art.sketch "${art.sketch}" is not a background layer; use props.sketch on a canvas beat`,
    );
  if (art.under != null && !Array.isArray(art.under))
    throw new Error('art.under must be an element array');
  const { sketch: _name, seed, opacity = 1, drift = 0, ...rest } = art;
  const sketched: CanvasElement = {
    type: 'group',
    at: 0,
    enter: 'none',
    opacity,
    children: drawn.elements,
  };
  if (drift > 0) {
    if (!(Number.isFinite(duration) && duration > 0))
      throw new Error('art.drift needs a positive beat duration');
    // About the frame centre, linear from the cut, never holding the beat (hold: false).
    const side = Math.abs(seed ?? 0) % 2 ? -1 : 1;
    sketched.origin = [Math.round(width / 2), Math.round(height / 2)];
    sketched.keys = [
      {
        at: 0,
        dur: duration,
        ease: 'linear',
        scale: Math.round((1 + 0.08 * drift) * 1000) / 1000,
        x: Math.round(side * drift * Math.min(width, height) * 0.03),
        hold: false,
      },
    ];
  }
  return { ...rest, under: [sketched, ...(art.under ?? [])] };
}

function validateArt(art: AuthoredArt): void {
  if (typeof art.sketch !== 'string' || !art.sketch.trim())
    throw new Error('art.sketch must name a library sketch');
  if (art.seed != null && !Number.isInteger(art.seed))
    throw new Error('art.seed must be an integer');
  for (const k of ['opacity', 'drift'] as const)
    if (
      art[k] != null &&
      !(Number.isFinite(art[k]) && art[k] >= 0 && art[k] <= 1)
    )
      throw new Error(`art.${k} must be 0–1`);
}
