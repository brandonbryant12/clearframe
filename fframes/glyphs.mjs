// Which characters the bundled fonts can draw, checked before rendering so text never
// becomes empty boxes.
import fs from 'node:fs';

const coverage = JSON.parse(fs.readFileSync(new URL('./assets/fonts/coverage.json', import.meta.url), 'utf8')).ranges;
// Accent faces cover fewer scripts than Inter; text set in them is checked against its own face.
const familyCoverage = JSON.parse(
  fs.readFileSync(new URL('./assets/fonts/coverage-families.json', import.meta.url), 'utf8'),
).ranges;
export const FACE = {
  serif: 'InstrumentSerif-Regular.ttf',
  'serif-italic': 'InstrumentSerif-Italic.ttf',
  italic: 'InstrumentSerif-Italic.ttf',
  mono: 'IBMPlexMono-Medium.ttf',
  hand: 'ArchitectsDaughter-Regular.ttf',
};
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
export function missingGlyph(text, face) {
  const ranges = face ? familyCoverage[FACE[face]] : coverage;
  for (const ch of String(text)) {
    const cp = ch.codePointAt(0);
    // Whitespace and default-ignorable characters (soft hyphen, joiners, variation selectors) shape invisibly.
    if (cp < 32 || /[\s\p{Default_Ignorable_Code_Point}]/u.test(ch)) continue;
    let lo = 0,
      hi = ranges.length - 1,
      ok = false;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1,
        [a, b] = ranges[mid];
      if (cp < a) hi = mid - 1;
      else if (cp > b) lo = mid + 1;
      else {
        ok = true;
        break;
      }
    }
    if (!ok) return ch;
  }
  return null;
}

/** Walk displayed props and report the first undrawable character with its location. */
export function glyphCheck(value, where, fail, face = null) {
  if (typeof value === 'string') {
    const ch = missingGlyph(value, face);
    if (ch)
      fail(
        `"${ch}" (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}) in ${where} is not in the bundled ${face ? FACE[face].replace(/-.*$/, '') : 'Inter'} font and would render as an empty box. Rephrase or add a font with that script.`,
      );
  } else if (Array.isArray(value)) value.forEach((v, i) => glyphCheck(v, `${where}[${i}]`, fail, face));
  else if (value && typeof value === 'object') {
    const own = FACE[value.font] ? value.font : face;
    for (const [k, v] of Object.entries(value))
      if (!HIDDEN.has(k))
        glyphCheck(
          v,
          `${where}.${k}`,
          fail,
          k === 'emphasis' && value.emphasisStyle === 'serif' ? 'serif-italic' : own,
        );
  }
}
