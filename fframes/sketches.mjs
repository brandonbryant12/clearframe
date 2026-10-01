// Sketches: starting compositions for the canvas block, one file each in library/sketches
// (plus any in a project's library/). A built-in sketch is a module whose build(w, h) lays
// the idea out for landscape, vertical, square and portrait; a JSON sketch gives elements
// (or per-format variants). `clearframe sketch NAME` prints one; `gallery --sketches`
// renders them all. Helpers for writing new ones are in sketch-kit.mjs.
import { items, item } from './library.mjs';
import { frames } from './sketch-kit.mjs';

export { smoothPath } from './sketch-kit.mjs';
export const sketches = () => items('sketches');
export const sketchByName = name => item('sketches', name);

/** A sketch's props for a frame preset; `seed` varies its layout (buildings, ridges, swell). */
export function sketch(name, preset = 'landscape', { seed } = {}) {
  const s = sketchByName(name);
  if (!s) throw new Error(`Unknown sketch ${name}. Run clearframe sketch to list them.`);
  const [w, h] = frames[preset] ?? frames.landscape;
  return s.build(w, h, { seed });
}
export const SKETCH_FRAMES = frames;

/** The same orientation choice used by canvas sketches and reusable art layers. */
export function sketchPreset(width = 1920, height = 1080) {
  return height > width * 1.1 ? (height > width * 1.5 ? 'vertical' : 'portrait') : width > height * 1.1 ? 'landscape' : 'square';
}

/** Expand the existing playbook art.sketch shorthand for any authored storyboard.
 * Art is frame-space scenery: scene cameras and text belong in a canvas block instead.
 */
export function expandArt(art, { width = 1920, height = 1080 } = {}) {
  if (art?.sketch == null) return art;
  if (typeof art.sketch !== 'string' || !art.sketch.trim()) throw new Error('art.sketch must name a library sketch');
  if (art.seed != null && !Number.isInteger(art.seed)) throw new Error('art.seed must be an integer');
  if (art.opacity != null && !(Number.isFinite(art.opacity) && art.opacity >= 0 && art.opacity <= 1))
    throw new Error('art.opacity must be 0–1');
  const source = sketchByName(art.sketch);
  if (!source) throw new Error(`Unknown sketch ${art.sketch}. Run clearframe sketch to list them.`);
  const drawn = source.build(width, height, { seed: art.seed });
  if (drawn.layer !== 'under' || ['view', 'viewFrom', 'dolly', 'focus', 'world'].some(k => drawn[k] != null))
    throw new Error(`art.sketch "${art.sketch}" is not a background layer; use props.sketch on a canvas beat`);
  if (art.under != null && !Array.isArray(art.under)) throw new Error('art.under must be an element array');
  const { sketch: name, seed, opacity = 1, ...rest } = art;
  return {
    ...rest,
    under: [
      { type: 'group', at: 0, enter: 'none', opacity, children: drawn.elements },
      ...(art.under ?? []),
    ],
  };
}
