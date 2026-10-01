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

/** Canvas props (or an `art` layer for ambient sketches) for a frame preset. */
/** A sketch's props for a frame preset; `seed` varies its layout (buildings, ridges, swell). */
export function sketch(name, preset = 'landscape', { seed } = {}) {
  const s = sketchByName(name);
  if (!s) throw new Error(`Unknown sketch ${name}. Run clearframe sketch to list them.`);
  const [w, h] = frames[preset] ?? frames.landscape;
  return s.build(w, h, { seed });
}
export const SKETCH_FRAMES = frames;
