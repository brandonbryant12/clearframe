import { RECEIPT_FIELDS } from './receipt.mjs';
import { APP_FIELDS } from './app.mjs';
import { CRUMB_FIELDS } from './crumbs.mjs';

import type { ElementType } from './types.mjs';

/** Geometry fields an element type takes, and those it needs. */
export interface ElementTypeSpec {
  geometry: readonly string[];
  required: readonly string[];
}

export const ELEMENT_TYPES: Record<ElementType, ElementTypeSpec> = {
  rect: { geometry: ['x', 'y', 'w', 'h', 'r'], required: ['w', 'h'] },
  circle: { geometry: ['cx', 'cy', 'r'], required: ['r'] },
  ellipse: { geometry: ['cx', 'cy', 'rx', 'ry'], required: ['rx', 'ry'] },
  line: {
    geometry: ['x1', 'y1', 'x2', 'y2', 'arrow', 'head'],
    required: ['x2', 'y2'],
  },
  path: { geometry: ['d', 'arrow', 'head'], required: ['d'] },
  poly: {
    geometry: ['points', 'closed', 'arrow', 'head'],
    required: ['points'],
  },
  text: {
    geometry: [
      'text',
      'x',
      'y',
      'size',
      'font',
      'anchor',
      'width',
      'height',
      'leading',
      'tracking',
      'upper',
      'count',
      'fit',
      'marks',
      'balance',
    ],
    required: [],
  },
  icon: { geometry: ['name', 'x', 'y', 'size'], required: ['name'] },
  // A page of real text that scrolls to the section the voice names (scene/native/src/blocks/canvas_document.rs).
  document: {
    geometry: [
      'x',
      'y',
      'w',
      'h',
      'title',
      'kicker',
      'sections',
      'size',
      'scroll',
      'marks',
    ],
    required: ['w', 'h', 'sections'],
  },
  // A receipt or card slip drawn from its lines; it becomes a group with ids on its parts (film/receipt.mjs).
  receipt: { geometry: RECEIPT_FIELDS, required: ['merchant'] },
  // An app screen (a window or a phone) with tabs, fields, an upload slot and a button; a group with ids on its parts (film/app.mjs).
  app: { geometry: APP_FIELDS, required: ['title'] },
  // Where to go in an app ("Leave › Family leave › New request"): chips on their words (film/crumbs.mjs).
  crumbs: { geometry: CRUMB_FIELDS, required: ['items'] },
  // A cursor that travels to elements by id and presses them; expanded before scheduling (film/pointer.mjs).
  pointer: {
    geometry: [
      'to',
      'steps',
      'from',
      'point',
      'press',
      'style',
      'size',
      'leave',
      'sound',
    ],
    required: [],
  },
  image: {
    geometry: ['asset', 'file', 'x', 'y', 'w', 'h', 'r', 'fit', 'treatment'],
    required: ['w', 'h'],
  },
  group: {
    geometry: ['children', 'x', 'y', 'stagger'],
    required: ['children'],
  },
  meter: {
    geometry: ['x', 'y', 'w', 'h', 'bars', 'style', 'step', 'gap', 'r'],
    required: ['w', 'h'],
  },
  spotlight: {
    geometry: ['cx', 'cy', 'r', 'x', 'y', 'w', 'h', 'radius', 'dim'],
    required: [],
  },
  particles: {
    geometry: ['x', 'y', 'w', 'h', 'count', 'kind', 'seed', 'size', 'speed'],
    required: ['w', 'h'],
  },
  solid: {
    geometry: [
      'shape',
      'cx',
      'cy',
      'size',
      'spin',
      'tilt',
      'perspective',
      'nodes',
      'marks',
      'arcs',
      'shade',
    ],
    required: ['size'],
  },
};

export const COMMON = [
  'type',
  'id',
  'note',
  'fill',
  'stroke',
  'width',
  'opacity',
  'dash',
  'cap',
  'join',
  'rotate',
  'scale',
  'origin',
  'blend',
  'enter',
  'drawEase',
  'at',
  'say',
  'after',
  'dur',
  'dist',
  'exit',
  'exitAt',
  'exitSay',
  'exitAfter',
  // A named moment of the beat (props.moments) instead of a word or seconds (film/moments.mjs).
  'cue',
  'exitCue',
  'exitDur',
  'sound',
  'keys',
  'loop',
  'along',
  'echo',
  'fps',
  'morphDur',
  // One-to-many morph: start as a slice of an element of the beat before (film/job.mjs linkMorphs).
  'morphFrom',
  'rough',
  'behind',
  'subject',
  'depth',
  'z',
  'blur',
  'shine',
  'shadow',
  'glow',
  'mosaic',
  'tilt',
  'material',
  'print',
];

export const ENTERS = [
  'fade',
  'pop',
  'rise',
  'drop',
  'left',
  'right',
  'grow',
  'grow-x',
  'grow-y',
  'draw',
  'wipe',
  'wipe-up',
  'type',
  'none',
];

export const EXITS = [
  'fade',
  'shrink',
  'fall',
  'lift',
  'undraw',
  'wipe',
  'blur',
  'none',
];

export const LOOPS = [
  'spin',
  'pulse',
  'float',
  'sway',
  'orbit',
  'dash',
  'blink',
  'level',
  'rock',
];

export const MATERIALS = ['thermal', 'chrome', 'gold', 'neon'];

/** Print finishes: the look of one printing process each (see `printSpec`). */
export const PRINTS = [
  'benday',
  'halftone',
  'engraving',
  'newsprint',
  'letterpress',
];

/** Mosaic tile styles: hand-cut tesserae, LCD pixels, or cross-stitches on cloth. */
export const MOSAIC_STYLES = ['tesserae', 'pixel', 'stitch'];

// The last twelve are rate functions adapted from 3b1b/manim (MIT; scene/native/THIRD_PARTY.md).
export const EASES = [
  'inOut',
  'in',
  'out',
  'linear',
  'spring',
  'smooth',
  'rushInto',
  'rushFrom',
  'slowInto',
  'doubleSmooth',
  'thereAndBack',
  'thereAndBackPause',
  'runningStart',
  'overshoot',
  'wiggle',
  'lingering',
  'decay',
];

export const COLOR_TOKENS = [
  'bg',
  'surface',
  'ink',
  'muted',
  'accent',
  'accent2',
  'positive',
  'negative',
  'line',
  'wash',
  'wash2',
  'paper',
  'none',
];

export const TREATMENTS = [
  'none',
  'mono',
  'duotone',
  'tint',
  'blur',
  'soft',
  'halftone',
  'engraving',
];

export const FONTS = [
  'display',
  'semibold',
  'bold',
  'light',
  'text',
  'regular',
  'strong',
  'figures',
  'serif',
  'serif-italic',
  'italic',
  'mono',
  'hand',
  'poster',
  'serif-display',
  'serif-display-italic',
  'didone',
  'didone-italic',
  'wide',
  'geometric',
  'geometric-light',
  'condensed',
];

export const MAX_ELEMENTS = 600;

/** Fields from CSS and other tools, and what this dialect calls them. */
export const MARK_STYLES = [
  'highlight',
  'underline',
  'circle',
  'box',
  'strike',
  'cross',
  'stamp',
];

export const MARK_FIELDS = [
  'words',
  'style',
  'color',
  'at',
  'say',
  'cue',
  'after',
  'dur',
  'width',
  'pad',
  'rough',
  'label',
  'size',
  'rotate',
  'fill',
  'sound',
];

export { FIELD_HINTS, fieldHint } from './canvas-field-hints.mjs';
