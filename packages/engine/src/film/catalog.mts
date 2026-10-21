import { validatePlace } from './validation/canvas-expansion.mjs';
import {
  validateSharedText,
  validateEmphasis,
} from './validation/shared-text.mjs';
// The production native vocabulary. Metadata, validation, CLI help and examples share this file.
import { palettes, paletteNotes, isPaletteKey, items } from './library.mjs';
import { helpers, VALIDATORS } from './validators.mjs';
import type {
  BlockProps,
  PropHelpers,
  Theme,
  ValidationFrame,
} from './types.mjs';
import { isRecord } from './guards.mjs';
import * as Schema from 'effect/Schema';
import { BlockPropsSchema } from './props-schema/block-props.mjs';
// Palettes live in library/palettes (one JSON file each, plus any in a project's library/).
export const THEMES = new Proxy<Record<string, Record<string, string>>>(
  {},
  {
    get: (_, id) => (typeof id === 'string' ? palettes()[id] : undefined),
    has: (_, id) => id in palettes(),
    ownKeys: () => Object.keys(palettes()),
    getOwnPropertyDescriptor: (_, id) =>
      typeof id === 'string' && id in palettes()
        ? { value: palettes()[id], enumerable: true, configurable: true }
        : undefined,
  },
);
export const THEME_NOTES = new Proxy<Record<string, string>>(
  {},
  { get: (_, id) => (typeof id === 'string' ? paletteNotes()[id] : undefined) },
);
import { titleBlock } from './blocks/title.mjs';
import { statementBlock } from './blocks/statement.mjs';
import { statBlock } from './blocks/stat.mjs';
import { kpisBlock } from './blocks/kpis.mjs';
import { barsBlock } from './blocks/bars.mjs';
import { lineBlock } from './blocks/line.mjs';
import { waffleBlock } from './blocks/waffle.mjs';
import { ringBlock } from './blocks/ring.mjs';
import { deltaBlock } from './blocks/delta.mjs';
import { compareBlock } from './blocks/compare.mjs';
import { stepsBlock } from './blocks/steps.mjs';
import { timelineBlock } from './blocks/timeline.mjs';
import { funnelBlock } from './blocks/funnel.mjs';
import { quoteBlock } from './blocks/quote.mjs';
import { matrixBlock } from './blocks/matrix.mjs';
import { equationBlock } from './blocks/equation.mjs';
import { calloutBlock } from './blocks/callout.mjs';
import { endcardBlock } from './blocks/endcard.mjs';
import { imageBlock } from './blocks/image.mjs';
import { videoBlock } from './blocks/video.mjs';
import { kineticBlock } from './blocks/kinetic.mjs';
import { flowBlock } from './blocks/flow.mjs';
import { cycleBlock } from './blocks/cycle.mjs';
import { breathingBlock } from './blocks/breathing.mjs';
import { chapterBlock } from './blocks/chapter.mjs';
import { highlightBlock } from './blocks/highlight.mjs';
import { donutBlock } from './blocks/donut.mjs';
import { magnitudeBlock } from './blocks/magnitude.mjs';
import { checklistBlock } from './blocks/checklist.mjs';
import { stageBlock } from './blocks/stage.mjs';
import { canvasBlock } from './blocks/canvas.mjs';
import { annotateBlock } from './blocks/annotate.mjs';
export const BLOCKS = [
  titleBlock,
  statementBlock,
  statBlock,
  kpisBlock,
  barsBlock,
  lineBlock,
  waffleBlock,
  ringBlock,
  deltaBlock,
  compareBlock,
  stepsBlock,
  timelineBlock,
  funnelBlock,
  quoteBlock,
  matrixBlock,
  equationBlock,
  calloutBlock,
  endcardBlock,
  imageBlock,
  videoBlock,
  kineticBlock,
  flowBlock,
  cycleBlock,
  breathingBlock,
  chapterBlock,
  highlightBlock,
  donutBlock,
  magnitudeBlock,
  checklistBlock,
  stageBlock,
  canvasBlock,
  annotateBlock,
];

export const blockByName = (name: string) =>
  BLOCKS.find((b) => b.name === name);
// A bulleted list is the slide a film should not be; an icon grid is a list with pictures.
const RETIRED_BLOCKS = {
  list: 'a list of takeaways is a slide; use checklist (items that change on their words), a canvas cast of the things themselves, or kinetic for the one line to remember',
  'icon-grid':
    'a grid of icons is a decorated list; draw the things as a canvas cast that re-forms on the voice, or use checklist',
};
export const MOTIONS = ['gentle', 'snappy', 'spring'];
// Retired names (iris, whip, flash, dissolve; glow, dots, mosaic) are refused with a replacement:
// RETIRED in constants.mjs.
export const TRANSITIONS = ['cut', 'fade', 'wipe', 'push', 'panel', 'into'];
export const BACKDROPS = ['none', 'grid', 'paper'];
export const CANVASES = [
  [1920, 1080],
  [1080, 1920],
  [1080, 1080],
  [1080, 1350],
  [640, 360],
];
export const FRAME_RATES = [24, 25, 30, 50, 60];
const words = (value: unknown) =>
  String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
const wordChar = (c: string | undefined) =>
  c != null && /[\p{L}\p{N}]/u.test(c);
/** Index of a whole-word phrase in whitespace-normalised text, or -1 (mirrors the renderer). */
export function findPhrase(text: unknown, phrase: unknown) {
  const t = words(text),
    q = words(phrase);
  if (!q) return -1;
  for (let i = t.indexOf(q); i >= 0; i = t.indexOf(q, i + 1))
    if (!wordChar(t[i - 1]) && !wordChar(t[i + q.length])) return i;
  return -1;
}
export const precision = (value: unknown) => {
  const [n, e = '0'] = String(value).split(/e/i);
  return Math.min(8, Math.max(0, (n.split('.')[1]?.length ?? 0) - Number(e)));
};

export function palette(theme: unknown = 'paper'): Theme {
  if (typeof theme === 'string') {
    if (!THEMES[theme]) throw new Error(`Unknown native theme ${theme}`);
    const colors = palettes()[theme];
    if (!colors) throw new Error(`Unknown native theme ${theme}`);
    return { base: theme, ...colors };
  }
  if (!isRecord(theme))
    throw new Error('theme must be a preset name or a palette object');
  const base = theme.base ?? 'paper';
  const result = palette(base);
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'base') continue;
    if (
      !isPaletteKey(key) ||
      typeof value !== 'string' ||
      !/^#[\da-f]{6}$/i.test(value)
    )
      throw new Error(`theme.${key}: expected a palette color in #RRGGBB form`);
    Object.assign(result, { [key]: value });
  }
  return result;
}

// Names agents reach for as blocks that are beat fields or canvas props.
const NOT_BLOCKS = {
  tone: 'tone is a beat field that colour-blocks any scene: "tone": "accent" (accent, accent2, invert, surface; docs/style.md).',
  plate:
    'plate is a beat field: footage or a still behind any scene, "plate": {"file": "…"}.',
  camera: 'camera is a beat field: "camera": {"move": "in"}.',
  sketch:
    'a sketch is drawn by a canvas beat: {"block": "canvas", "props": {"sketch": "NAME"}} (clearframe sketch NAME).',
  cast: 'a cast is drawn by a canvas beat: {"block": "canvas", "props": {"cast": {…}}} (docs/cast.md).',
  chart:
    'a chart is drawn by a canvas beat: {"block": "canvas", "props": {"chart": {"kind": "bars", "values": […]}}}.',
  number: 'one figure is a stat block, or a canvas chart {"kind": "number"}.',
  text: 'type on its own is a statement or kinetic block.',
  caption:
    'captions are a film field, on by default for narrated films (broadcast-standard; false opts out, "pop" for social clips).',
};
export function notABlock(name: string) {
  const hint = new Map(Object.entries(NOT_BLOCKS)).get(name);
  if (hint) return hint;
  // A sketch's name used as a block ("portal"): it is drawn by a canvas beat.
  if (items('sketches').some((s) => s.id === name))
    return `${name} is a sketch, drawn by a canvas beat: {"block": "canvas", "props": {"sketch": "${name}", "sketchText": {…}, "sketchSay": {…}}} (clearframe sketch ${name} prints the beat to paste).`;
  // The nearest real names, by edit distance.
  const d = (a: string, b: string) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [
      i,
      ...Array(b.length).fill(0),
    ]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        m[i][j] = Math.min(
          m[i - 1][j] + 1,
          m[i][j - 1] + 1,
          m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
    return m[a.length][b.length];
  };
  const near = BLOCKS.map((b) => ({ name: b.name, distance: d(name, b.name) }))
    .sort((a, b) => a.distance - b.distance)
    .filter((item) => item.distance <= 3)
    .slice(0, 3)
    .map((item) => item.name);
  return `${near.length ? `Did you mean ${near.join(', ')}? ` : ''}Run clearframe blocks for the list.`;
}

export function normalizeProps(
  name: string,
  input: unknown = {},
  {
    vertical = false,
    width,
    height,
    assets = [],
    resolve,
    captions = false,
  }: Partial<ValidationFrame> = {},
): BlockProps {
  const meta = blockByName(name);
  const retirement = new Map(Object.entries(RETIRED_BLOCKS)).get(name);
  if (retirement) throw new Error(`block "${name}" was retired: ${retirement}`);
  if (!meta) throw new Error(`No native block "${name}". ${notABlock(name)}`);
  const fail = (message: string): never => {
    throw new Error(`${name}: ${message}`);
  };
  if (!isRecord(input)) return fail('props must be an object');
  for (const key of Object.keys(input))
    if (!(key in meta.props))
      fail(
        `unsupported prop ${key}${name === 'kinetic' && ['text', 'stack', 'lines', 'words', 'phrase', 'phrases'].includes(key) ? `: a kinetic beat's words are its narration (the beat's vo); choose how they show with mode ("highlight", "reveal", "word" or "stack")` : ''} (${name} takes ${Object.keys(meta.props).join(', ')})`,
      );
  validatePlace(input.place, fail);
  const p = Schema.decodeUnknownSync(BlockPropsSchema)(structuredClone(input));
  const h: PropHelpers = helpers(p, fail, { findPhrase, precision });
  // Checks every block shares: text lengths, one headline, alignment and emphasis phrases.
  validateSharedText(name, p, h);
  validateEmphasis(name, p, h);
  new Map(Object.entries(VALIDATORS)).get(name)?.(p, h, {
    vertical,
    width: width ?? (vertical ? 1080 : 1920),
    height: height ?? (vertical ? 1920 : 1080),
    assets,
    resolve,
    captions,
  });
  if (
    p.decimals != null &&
    (!Number.isInteger(p.decimals) || p.decimals < 0 || p.decimals > 8)
  )
    fail('decimals must be 0–8');
  return p;
}

export function markdownCatalog() {
  return (
    '# Native block reference\n\nGenerated by `clearframe blocks --md`. Every block is drawn natively by the renderer (scene/native).\n\n' +
    BLOCKS.map(
      (b) =>
        `## ${b.name}\n\n${b.summary}\n\n| Prop | Meaning |\n|---|---|\n${Object.entries(
          b.props,
        )
          .map(([k, v]) => `| ${k} | ${v.replaceAll('|', ' / ')} |`)
          .join(
            '\n',
          )}\n\n\`\`\`json\n${JSON.stringify({ id: b.name, block: b.name, vo: b.vo ?? 'Replace this narration.', props: b.example }, null, 2)}\n\`\`\`\n`,
    ).join('\n')
  );
}
