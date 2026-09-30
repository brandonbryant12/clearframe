// Shared timing constants (fframes/constants.json), also compiled into the Rust renderer.
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
export const TRANSITION_COLORS = ['accent', 'accent2', 'ink', 'bg', 'surface'];
