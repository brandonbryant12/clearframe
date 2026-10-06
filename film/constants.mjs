// Shared timing constants (film/constants.json), also compiled into the Rust renderer.
import fs from 'node:fs';

export const CONSTANTS = JSON.parse(fs.readFileSync(new URL('./constants.json', import.meta.url), 'utf8'));
/** Seconds each motion preset's element entrance takes. */
export const ENTRANCE = CONSTANTS.entrance;
/** Graphic transitions: [outgoing cover, incoming reveal] seconds. */
export const COVER = CONSTANTS.cover;
export const CANVAS_TIMING = CONSTANTS.canvas;

export const EXITS = ['auto', 'none', 'fade', 'push', 'zoom', 'wipe', 'panel', 'iris', 'whip'];
export const TONES = ['none', 'accent', 'accent2', 'invert', 'surface'];
export const PLATE_SIDES = ['full', 'left', 'right', 'top', 'bottom'];
export const DRIFTS = ['none', 'in', 'out', 'left', 'right', 'up', 'down'];
export const CAMERA_MOVES = ['auto', 'none', 'in', 'out', 'left', 'right', 'up', 'down'];
/** Film grades for `lens.grade`: tone curves per channel, as a colourist would set them. */
export const LENS_GRADES = ['none', 'teal-orange', 'warm', 'cool', 'bleach', 'mono', 'noir', 'sepia'];
export const LENS_KEYS = ['letterbox', 'grade', 'gradeAmount', 'bloom', 'aberration', 'leak', 'handheld', 'blur'];
export const TEXT_MOTIONS = ['lines', 'words', 'letters', 'cascade'];
export const TRANSITION_COLORS = ['accent', 'accent2', 'ink', 'bg', 'surface'];
