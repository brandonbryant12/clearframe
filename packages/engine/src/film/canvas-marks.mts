import { decodeTextMark } from './canvas-schema.mjs';
import { finite, isList, isRecord, oneOf } from './guards.mjs';
import type { Fail, TextMark, JsonRecord } from './types.mjs';
import { MARK_STYLES, MARK_FIELDS } from './canvas-catalog.mjs';

import { isColor } from './canvas-material.mjs';
import { checkSound } from './canvas-sound.mjs';

/** Whether `phrase` occurs in `text` on word boundaries, as the renderer's `find_words` matches it. */
export function hasWords(text: string, phrase: string): boolean {
  const flat = text.split(/\s+/).join(' ');
  const word = (c: string | undefined): boolean =>
    c != null && /[\p{L}\p{N}]/u.test(c);
  for (let i = flat.indexOf(phrase); i >= 0; i = flat.indexOf(phrase, i + 1))
    if (!word(flat[i - 1]) && !word(flat[i + phrase.length])) return true;
  return false;
}

/** The text a mark is drawn on. */
export interface MarkedText {
  text?: string;
  upper?: boolean;
  count?: unknown;
  marks?: unknown;
}

/** A text element's `marks`: hand-drawn emphasis attached to its own words, each on a cue. */
export function textMarks(el: MarkedText, at: string, fail: Fail): TextMark[] {
  const marks = el.marks;
  if (!isList(marks) || marks.length < 1 || marks.length > 4)
    fail(
      `${at}.marks must be 1–4 marks: {words, style: ${MARK_STYLES.join('|')}, say|at}`,
    );
  if (el.count != null)
    fail(`${at}.marks: a counted number has no fixed words to mark`);
  const own = el.text ?? '';
  const text = el.upper ? own.toUpperCase() : own;
  return marks.map((m, i) => {
    const where = `${at}.marks[${i}]`;
    if (!isRecord(m)) fail(`${where} must be an object`);
    for (const key of Object.keys(m))
      if (!MARK_FIELDS.includes(key))
        fail(
          `${where}: unsupported field ${key} (a mark takes ${MARK_FIELDS.join(', ')})`,
        );
    if (typeof m.words !== 'string' || !m.words.trim())
      fail(`${where}.words must name words of the text`);
    const words = m.words.trim().split(/\s+/).join(' ');
    const find = el.upper ? words.toUpperCase() : words;
    if (!hasWords(text, find))
      fail(
        `${where}.words "${words}" are not whole words of the text "${own}"`,
      );
    checkMarkStyle(m, where, fail);
    checkStamp(m, where, fail);
    // Every field of the mark is checked above.
    const mark = decodeTextMark(m);
    return {
      ...mark,
      words,
      style: mark.style ?? 'highlight',
      ...(mark.style === 'stamp' ? { color: mark.color ?? 'negative' } : {}),
    };
  });
}

function checkMarkStyle(m: JsonRecord, where: string, fail: Fail): void {
  if (m.style != null && !oneOf(MARK_STYLES, m.style))
    fail(`${where}.style must be ${MARK_STYLES.join(', ')}`);
  if (m.color != null && !isColor(m.color))
    fail(`${where}.color must be a palette token or #rrggbb`);
  for (const key of ['at', 'after', 'dur', 'width', 'pad']) {
    const v = m[key];
    if (v != null && (!finite(v) || v < 0))
      fail(`${where}.${key} must be a nonnegative number`);
  }
  if (m.rough != null && typeof m.rough !== 'boolean')
    fail(`${where}.rough must be true or false`);
  if (m.say != null && (typeof m.say !== 'string' || !m.say.trim()))
    fail(`${where}.say must be a spoken word`);
  // A sound as it lands; a stamp is pressed with a thud unless `sound: false`.
  if (m.sound != null && m.sound !== false)
    checkSound(m.sound, `${where}.sound`, fail);
}
function checkStamp(m: JsonRecord, where: string, fail: Fail): void {
  // A stamp prints its own short verdict over the words (PAID, RETURNED); other marks draw only.
  if (m.style !== 'stamp') {
    for (const key of ['label', 'size', 'rotate', 'fill'])
      if (m[key] != null)
        fail(`${where}.${key} belongs to a stamp (style: "stamp")`);
    return;
  }
  if (typeof m.label !== 'string' || !m.label.trim() || m.label.length > 24)
    fail(
      `${where}.label must be the stamp's words, up to 24 characters (e.g. "Not a receipt")`,
    );
  if (m.size != null && (!finite(m.size) || m.size < 20 || m.size > 160))
    fail(`${where}.size must be 20–160`);
  if (m.rotate != null && (!finite(m.rotate) || Math.abs(m.rotate) > 20))
    fail(`${where}.rotate must be within ±20 degrees`);
  if (m.fill != null && !isColor(m.fill))
    fail(
      `${where}.fill must be a palette token or #rrggbb (the stamp's face, paper by default)`,
    );
}
