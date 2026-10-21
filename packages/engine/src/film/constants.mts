// Shared timing constants (film/constants.json), also compiled into the Rust renderer.
import fs from 'node:fs';
import { finite, isRecord } from './guards.mjs';
import type { NativeJob } from './types.mjs';

/** Seconds the canvas scheduler gives each kind of motion when an element sets none. */
export interface CanvasTiming {
  draw: number;
  grow: number;
  key: number;
  along: number;
  count: number;
  typePerChar: number;
  typeMin: number;
  typeMax: number;
}
export interface Constants {
  entrance: Record<string, number>;
  stagger: Record<string, number>;
  cover: Record<string, [number, number]>;
  canvas: CanvasTiming;
}

function numbers(value: unknown, where: string): Constants['entrance'] {
  if (!isRecord(value))
    throw new Error(`constants.json: ${where} must be an object`);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (!finite(v))
      throw new Error(`constants.json: ${where}.${k} must be a number`);
    out[k] = v;
  }
  return out;
}
function readConstants(): Constants {
  const raw: unknown = JSON.parse(
    fs.readFileSync(new URL('./constants.json', import.meta.url), 'utf8'),
  );
  if (!isRecord(raw)) throw new Error('constants.json must be an object');
  const cover: Record<string, [number, number]> = {};
  if (!isRecord(raw.cover))
    throw new Error('constants.json: cover must be an object');
  for (const [k, v] of Object.entries(raw.cover)) {
    if (!(Array.isArray(v) && v.length === 2 && finite(v[0]) && finite(v[1])))
      throw new Error(
        `constants.json: cover.${k} must be [outgoing, incoming] seconds`,
      );
    cover[k] = [v[0], v[1]];
  }
  const canvas = numbers(raw.canvas, 'canvas');
  const timing = (k: keyof CanvasTiming): number => {
    const v = canvas[k];
    if (v === undefined)
      throw new Error(`constants.json: canvas.${k} is required`);
    return v;
  };
  return {
    entrance: numbers(raw.entrance, 'entrance'),
    stagger: numbers(raw.stagger, 'stagger'),
    cover,
    canvas: {
      draw: timing('draw'),
      grow: timing('grow'),
      key: timing('key'),
      along: timing('along'),
      count: timing('count'),
      typePerChar: timing('typePerChar'),
      typeMin: timing('typeMin'),
      typeMax: timing('typeMax'),
    },
  };
}

export const CONSTANTS: Constants = readConstants();
/** Seconds each motion preset's element entrance takes. */
export const ENTRANCE = CONSTANTS.entrance;
/** Graphic transitions: [outgoing cover, incoming reveal] seconds. */
export const COVER = CONSTANTS.cover;
export const CANVAS_TIMING = CONSTANTS.canvas;
/** Seconds a wipe's edge takes to cross the frame (`motion::wipe_seconds` in the renderer). */
export const wipeSeconds = (
  preset: string | undefined,
  sceneSeconds: number,
): number => Math.min(ENTRANCE[preset ?? 'gentle'] + 0.25, sceneSeconds / 2);
/** Seconds an `into` transition takes to go through its element (`motion::INTO_SECONDS`). */
export const INTO_SECONDS = 0.9;
/** Seconds prepared beat `index` stays on screen past its end: held ahead of the next beat's
 * wipe edge, beside its push or zoomed through by its into, so its footage must run that much longer. */
export function heldTail(job: NativeJob, index: number): number {
  const next = job.beats[index + 1];
  if (next?.transition === 'wipe')
    return wipeSeconds(next.motion?.preset, next.frames / job.fps);
  if (next?.transition === 'push')
    return ENTRANCE[next.motion?.preset ?? 'gentle'] + 0.15;
  if (next?.transition === 'into') return INTO_SECONDS;
  return 0;
}

export const EXITS = ['auto', 'none', 'fade', 'push', 'wipe', 'panel'];
export type RetiredKind =
  | 'transition'
  | 'backdrop'
  | 'enter'
  | 'exit'
  | 'sceneExit';
const RETIRED_TRANSITIONS = {
  iris: 'it read as a cartoon wipe; use fade, push, or a camera move within one world',
  whip: 'a motion-blurred whip pan is trailer grammar; use push, or a camera move within one world',
  flash:
    'a white-out flash cut reads as a fault in a calm film; use cut, or fade',
  dissolve:
    'a double exposure duplicates fade and scenes are never cross-dissolved (docs/style.md); use fade',
  rise: 'it built each scene up out of an empty frame, a slide coming in; use cut, or fade at a change of chapter',
  zoom: 'a scene scaling in from an empty frame reads as a slide transition; use cut, into (through an element of the last scene), or a camera move',
};
/**
 * Vocabulary retired because it fell below the bar of an enterprise or financial film. A
 * storyboard that still names one is refused with the reason and what to use instead, so an old
 * film fails loudly rather than drawing something else.
 */
export const RETIRED: Record<RetiredKind, Record<string, string>> = {
  transition: RETIRED_TRANSITIONS,
  backdrop: {
    glow: 'it laid muddy blobs behind the type; use none, or paper',
    dots: 'it was invisible at phone width; use grid, or none',
    mosaic:
      'a full-frame tile pattern competed with the content; use none, or paper',
  },
  enter: {
    scramble: 'it showed glyph garbage for most of a second; use type, or rise',
    blur: 'it was a fade with a smudge; use fade',
    assemble:
      'a tile swarm distracts from what the shape says; use fade, or grow',
  },
  exit: {
    scatter:
      'a tile swarm distracts from what the shape says; use fade, or shrink',
  },
  // A scene exit mirrors a transition, so a retired transition is a retired exit.
  sceneExit: {
    iris: RETIRED_TRANSITIONS.iris,
    whip: RETIRED_TRANSITIONS.whip,
    zoom: RETIRED_TRANSITIONS.zoom,
  },
};
const LABEL: Record<RetiredKind, string> = {
  transition: 'transition',
  backdrop: 'backdrop',
  enter: 'entrance',
  exit: 'exit',
  sceneExit: 'exit',
};
/** The refusal for retired vocabulary (`kind` is a key of RETIRED), or null if `name` is current. */
export function retired(kind: RetiredKind, name: unknown): string | null {
  const why =
    typeof name === 'string' && Object.hasOwn(RETIRED[kind], name)
      ? RETIRED[kind][name]
      : null;
  return why && `${LABEL[kind]} "${String(name)}" was retired: ${why}`;
}
export const TONES = ['none', 'accent', 'accent2', 'invert', 'surface'];
export const PLATE_SIDES = ['full', 'left', 'right', 'top', 'bottom'];
export const DRIFTS = ['none', 'in', 'out', 'left', 'right', 'up', 'down'];
export const CAMERA_MOVES = [
  'auto',
  'none',
  'in',
  'out',
  'left',
  'right',
  'up',
  'down',
];
/** The lens keeps one setting: `blur`, the shutter for motion blur on fast moves (0–1). */
export const LENS_KEYS = ['blur'];
/** Film-look lens settings, retired: a storyboard that sets one is refused by name. */
export const RETIRED_LENS = [
  'letterbox',
  'grade',
  'gradeAmount',
  'bloom',
  'aberration',
  'leak',
  'handheld',
];
export const TEXT_MOTIONS = ['lines', 'words', 'letters', 'cascade'];
export const TRANSITION_COLORS = ['accent', 'accent2', 'ink', 'bg', 'surface'];
