import type { JsonRecord } from './types.mjs';
import type { FramePreset } from './sketch-kit.mjs';
import type { SketchFills } from './sketches/fill.mjs';
import { fillSketch } from './sketches/fill.mjs';
import { sketchParams } from './sketches/parameters.mjs';
export { fillSketch, sketchParams };
export { sketchMoments, sketchWords } from './sketches/moments.mjs';
export { expandArt } from './sketches/art.mjs';
interface SketchOptions extends SketchFills {
  seed?: number;
  params?: JsonRecord;
}
// Sketches: starting compositions for the canvas block, one file each in library/sketches
// (plus any in a project's library/). A built-in sketch is a module whose build(w, h) lays
// the idea out for landscape, vertical, square and portrait; a JSON sketch gives elements
// (or per-format variants). `clearframe sketch NAME` prints one; `gallery --sketches`
// renders them all. Helpers for writing new ones are in sketch-kit.mjs.
import { items, item } from './library.mjs';
import { frames } from './sketch-kit.mjs';

export { smoothPath } from './sketch-kit.mjs';
export const sketches = () => items('sketches');
export const sketchByName = (name: string) => item('sketches', name);

/**
 * Fill a drawn sketch's placeholders: type ("TITLE") from `text` (an empty string removes that line), and named moments (`cue: "FIND"`
 * on an element, a key or an `along` route, `exitCue` on an exit) from `say`, so they land on spoken words instead of
 * their default seconds. A cued element may also carry `after` (seconds after its moment) with `at` already
 * including that offset: a filled moment keeps the offset, an unfilled one keeps its seconds. Cue names never
 * reach the plan.
 */
/**
 * A sketch's numbers (`sketchParams`): what it draws from real values, such as how many tokens each
 * side puts in or which days a window covers. A sketch declares them as
 * `params: {name: {default, min?, max?, integer?, oneOf?, list?, length?, about, hint?, figure?}}` (`hint` follows a refusal: how to express a real figure in this sketch's units; `figure: false` marks structure, such as the days in a month, that `critique` need not find in the source); unknown names,
 * values out of range, choices outside `oneOf` and values of the wrong type (number, text, true/false,
 * following the default) are refused by name, and missing ones take their defaults.
 */
/** A sketch's props for a frame preset; `seed` varies its layout (buildings, ridges, swell); `text` and `say` fill its placeholders. */
export function sketch(
  name: string,
  preset: string = 'landscape',
  { seed, text, say, params }: SketchOptions = {},
) {
  const s = sketchByName(name);
  if (!s)
    throw new Error(
      `Unknown sketch ${name}. Run clearframe sketch to list them.`,
    );
  const [w, h] =
    Object.entries(frames).find(([name]) => name === preset)?.[1] ??
    frames.landscape;
  // The words come too, for a sketch that sizes a chip to its word; they are filled in below.
  const drawn = s.build(w, h, {
    seed,
    params: sketchParams(s, params),
    text: text ?? {},
  });
  const cues = fillSketch(drawn.elements, { text, say });
  // A misspelt moment would otherwise keep its default seconds without a word of warning.
  const unknown = Object.keys(say ?? {}).filter((k) => !cues.has(k));
  if (unknown.length)
    throw new Error(
      `sketchSay: ${name} has no moment ${unknown.join(', ')}${cues.size ? ` (its moments are ${[...cues].join(', ')})` : ' (it has no named moments)'}`,
    );
  return drawn;
}
export const SKETCH_FRAMES = frames;

/** The same orientation choice used by canvas sketches and reusable art layers. */
export function sketchPreset(width = 1920, height = 1080): FramePreset {
  if (height > width * 1.1)
    return height > width * 1.5 ? 'vertical' : 'portrait';
  return width > height * 1.1 ? 'landscape' : 'square';
}
