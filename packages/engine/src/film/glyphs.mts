// Which characters the bundled fonts can draw, checked before rendering so text never
// becomes empty boxes.
import fs from 'node:fs';
import { isRecord } from './guards.mjs';

/** Inclusive code point ranges a face covers, sorted. */
type Ranges = [number, number][];
const ranges = (value: unknown, where: string): Ranges => {
  if (!Array.isArray(value))
    throw new Error(`${where} must be a list of [first, last] code points`);
  return value.map((r) => {
    if (
      !(
        Array.isArray(r) &&
        typeof r[0] === 'number' &&
        typeof r[1] === 'number'
      )
    )
      throw new Error(`${where} must be a list of [first, last] code points`);
    return [r[0], r[1]];
  });
};
const readRanges = (file: string): unknown => {
  const data: unknown = JSON.parse(
    fs.readFileSync(new URL(file, import.meta.url), 'utf8'),
  );
  return isRecord(data) ? data.ranges : null;
};
const coverage = ranges(
  readRanges('./assets/fonts/coverage.json'),
  'coverage.json ranges',
);
// Accent faces cover fewer scripts than Inter; text set in them is checked against its own face.
const familyRanges = readRanges('./assets/fonts/coverage-families.json');
if (!isRecord(familyRanges))
  throw new Error('coverage-families.json ranges must be an object');
const familyCoverage: Record<string, Ranges> = Object.fromEntries(
  Object.entries(familyRanges).map(([file, r]) => [
    file,
    ranges(r, `coverage-families.json ${file}`),
  ]),
);
export const FACE = {
  serif: 'InstrumentSerif-Regular.ttf',
  'serif-italic': 'InstrumentSerif-Italic.ttf',
  italic: 'InstrumentSerif-Italic.ttf',
  mono: 'IBMPlexMono-Medium.ttf',
  hand: 'ArchitectsDaughter-Regular.ttf',
  poster: 'BebasNeue-Regular.ttf',
  'serif-display': 'DMSerifDisplay-Regular.ttf',
  'serif-display-italic': 'DMSerifDisplay-Italic.ttf',
  didone: 'PlayfairDisplay-Bold.ttf',
  'didone-italic': 'PlayfairDisplay-BoldItalic.ttf',
  wide: 'ArchivoExpanded-ExtraBold.ttf',
  geometric: 'SpaceGrotesk-Bold.ttf',
  'geometric-light': 'SpaceGrotesk-Light.ttf',
  condensed: 'BigShouldersDisplay-ExtraBold.ttf',
};
/** A face key (above) or a bundled file name, as the type voices name them. */
const faceFile = (face: string): string =>
  Object.entries(FACE).find(([name]) => name === face)?.[1] ?? face;
// Props that are never displayed (cues, files, enums), so they are not glyph-checked.
const HIDDEN = new Set([
  'file',
  'asset',
  'say',
  'land',
  'growSay',
  'drawSay',
  'orientation',
  'sort',
  'mode',
  'align',
  'fit',
  'icon',
  'better',
  'type',
  'd',
  'fill',
  'stroke',
  'enter',
  'exit',
  'exitSay',
  'ease',
  'anchor',
  'font',
  'blend',
  'cap',
  'join',
  'arrow',
  'treatment',
  'name',
  'emphasisStyle',
  'to',
]);

/** First character the bundled fonts (or one accent face) cannot draw, if any. */
export function missingGlyph(
  text: unknown,
  face?: string | null,
): string | null {
  const covered = face ? familyCoverage[faceFile(face)] : coverage;
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    // Whitespace and default-ignorable characters (soft hyphen, joiners, variation selectors) shape invisibly.
    if (cp < 32 || /[\s\p{Default_Ignorable_Code_Point}]/u.test(ch)) continue;
    if (!hasCodePoint(covered, cp)) return ch;
  }
  return null;
}

/** Walk displayed props and report the first undrawable character with its location. */
export function glyphCheck(
  value: unknown,
  where: string,
  fail: (message: string) => unknown,
  face: string | null = null,
): void {
  if (typeof value === 'string') {
    const ch = missingGlyph(value, face);
    if (ch)
      fail(
        `"${ch}" (U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}) in ${where} is not in the bundled ${face ? faceFile(face).replace(/-.*$/, '') : 'Inter'} font and would render as an empty box. Rephrase or add a font with that script.`,
      );
  } else if (Array.isArray(value))
    value.forEach((v, i) => glyphCheck(v, `${where}[${i}]`, fail, face));
  else if (isRecord(value)) {
    glyphProperties(value, where, fail, face);
  }
}

function hasCodePoint(covered: Ranges, cp: number): boolean {
  let lo = 0,
    hi = covered.length - 1,
    ok = false;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1,
      [a, b] = covered[mid];
    if (cp < a) hi = mid - 1;
    else if (cp > b) lo = mid + 1;
    else {
      ok = true;
      break;
    }
  }

  return ok;
}

function glyphProperties(
  value: Record<string, unknown>,
  where: string,
  fail: (message: string) => unknown,
  face: string | null,
): void {
  const font = value.font;
  const own =
    typeof font === 'string' && Object.hasOwn(FACE, font) ? font : face;
  for (const [k, v] of Object.entries(value))
    if (!HIDDEN.has(k))
      glyphCheck(
        v,
        `${where}.${k}`,
        fail,
        k === 'emphasis' && value.emphasisStyle === 'serif'
          ? 'serif-italic'
          : own,
      );
}
