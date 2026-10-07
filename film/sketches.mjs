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

/**
 * Fill a drawn sketch's placeholders: type ("TITLE") from `text`, and named moments (`cue: "FIND"`
 * on an element or a key, `exitCue` on an exit) from `say`, so they land on spoken words instead of
 * their default seconds. Unfilled cues keep their seconds; cue names never reach the plan.
 */
export function fillSketch(list, { text = {}, say = {} } = {}) {
  for (const el of list ?? []) {
    if (el.type === 'text' && text[el.text] != null) el.text = text[el.text];
    for (const t of [el, ...(el.keys ?? [])]) {
      if (t.cue != null && say[t.cue] != null) {
        t.say = say[t.cue];
        delete t.at;
      }
      delete t.cue;
    }
    if (el.exitCue != null && say[el.exitCue] != null) {
      el.exitSay = say[el.exitCue];
      delete el.exitAt;
    }
    delete el.exitCue;
    if (el.children) fillSketch(el.children, { text, say });
  }
  return list;
}

/** A sketch's props for a frame preset; `seed` varies its layout (buildings, ridges, swell); `text` and `say` fill its placeholders. */
export function sketch(name, preset = 'landscape', { seed, text, say } = {}) {
  const s = sketchByName(name);
  if (!s) throw new Error(`Unknown sketch ${name}. Run clearframe sketch to list them.`);
  const [w, h] = frames[preset] ?? frames.landscape;
  const drawn = s.build(w, h, { seed });
  fillSketch(drawn.elements, { text, say });
  return drawn;
}
export const SKETCH_FRAMES = frames;

/** The same orientation choice used by canvas sketches and reusable art layers. */
export function sketchPreset(width = 1920, height = 1080) {
  return height > width * 1.1 ? (height > width * 1.5 ? 'vertical' : 'portrait') : width > height * 1.1 ? 'landscape' : 'square';
}

/** Expand the existing playbook art.sketch shorthand for any authored storyboard.
 * Art is frame-space scenery: scene cameras and text belong in a canvas block instead.
 * `drift` (0–1) pushes the art in over the beat, a parallax move under steady copy; the
 * seed picks the direction of its sideways travel.
 */
export function expandArt(art, { width = 1920, height = 1080, duration = 8 } = {}) {
  if (art?.sketch == null) return art;
  if (typeof art.sketch !== 'string' || !art.sketch.trim()) throw new Error('art.sketch must name a library sketch');
  if (art.seed != null && !Number.isInteger(art.seed)) throw new Error('art.seed must be an integer');
  for (const k of ['opacity', 'drift'])
    if (art[k] != null && !(Number.isFinite(art[k]) && art[k] >= 0 && art[k] <= 1)) throw new Error(`art.${k} must be 0–1`);
  const source = sketchByName(art.sketch);
  if (!source) throw new Error(`Unknown sketch ${art.sketch}. Run clearframe sketch to list them.`);
  const drawn = source.build(width, height, { seed: art.seed });
  fillSketch(drawn.elements);
  if (drawn.layer !== 'under' || ['view', 'viewFrom', 'dolly', 'focus', 'world'].some(k => drawn[k] != null))
    throw new Error(`art.sketch "${art.sketch}" is not a background layer; use props.sketch on a canvas beat`);
  if (art.under != null && !Array.isArray(art.under)) throw new Error('art.under must be an element array');
  const { sketch: name, seed, opacity = 1, drift = 0, ...rest } = art;
  const sketched = { type: 'group', at: 0, enter: 'none', opacity, children: drawn.elements };
  if (drift > 0) {
    if (!(Number.isFinite(duration) && duration > 0)) throw new Error('art.drift needs a positive beat duration');
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
