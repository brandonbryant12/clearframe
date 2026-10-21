// Fitting a code editor: inside the stage area, its type no smaller than a viewer reads, and
// long lines wrapped at token boundaries so each piece keeps its line's identity through steps.
import { fail, numberOr } from './fields.mjs';
import type { Fields } from './fields.mjs';
import type { CodeElement, CodeLine, CodeSpan, StageArea } from './types.mjs';

// IBM Plex Mono advances exactly 0.6 em per character, so code widths are measured, not guessed.
const MONO_ADVANCE = 0.6;
// The renderer's editor: 0.9 em padding each side and a gutter of three 0.8 em digits plus 1 em.
const chrome = (gutter: unknown) =>
  1.8 + (gutter ? 3 * MONO_ADVANCE * 0.8 + 1 : 0);
export const CODE_MIN_SIZE = 24;
const lineText = (l: CodeLine) =>
  l.text ?? (l.spans ?? []).map((sp) => sp.text).join('');
const lineCols = (l: CodeLine) => (l.indent ?? 0) + lineText(l).length;
const STEP_LISTS = ['show', 'add', 'remove', 'focus'];

/** Rows a step shows; the editor is as tall as its fullest step. */
export const codeRows = (el: CodeElement): number =>
  Math.max(
    ...el.steps.map((st) => (Array.isArray(st.show) ? st.show.length : 0)),
    1,
  );

/** The whole editor moves inside the area: never wider than it, never starting past its edges. */
function keepInside(el: CodeElement, area: StageArea): void {
  // An editor drawn for a wider frame takes this frame's height too, not its old height.
  if (el.x + el.w > area.right + 1 && el.h != null) delete el.h;
  el.w = Math.min(el.w, area.right - area.left);
  el.x = Math.min(Math.max(el.x, area.left), area.right - el.w);
  el.y = Math.min(Math.max(el.y, area.top), area.bottom - CODE_MIN_SIZE * 4);
  if (el.h == null) el.maxH = area.bottom - el.y;
  else el.h = Math.min(el.h, area.bottom - el.y);
}

/**
 * Keep an editor inside `area` (title-safe, below the heading) and its lines inside the editor:
 * the type shrinks to the longest line but never below CODE_MIN_SIZE; a line still too long wraps
 * at a token boundary with a hanging indent, and its pieces keep the line's identity through steps.
 */
export function fitCode(el: CodeElement, area?: StageArea | null): CodeElement {
  if (area) keepInside(el, area);
  const room = (size: number) =>
    Math.floor((el.w / size - chrome(el.gutter)) / MONO_ADVANCE);
  const longest = Math.max(1, ...el.lines.map(lineCols));
  const fit = el.w / (chrome(el.gutter) + MONO_ADVANCE * longest);
  if (fit >= el.size) return el;
  // On a tall frame (a phone) width is short and height plentiful: a long line wraps at the
  // authored size instead of shrinking toward the floor (the height fit below still shrinks
  // type when the rows would not fit). Elsewhere it shrinks to the floor first, then wraps.
  const tall = !!area && area.bottom - area.top > area.right - area.left;
  el.size = Math.max(
    Math.floor(fit),
    Math.min(el.size, tall ? el.size : CODE_MIN_SIZE),
  );
  const cols = room(el.size);
  if (longest <= cols) return el;
  const pieces = new Map<string, string[]>();
  el.lines = el.lines.flatMap((l) => {
    if (lineCols(l) <= cols) return [l];
    const out = wrapLine(l, cols);
    pieces.set(
      l.id,
      out.map((x) => x.id),
    );
    return out;
  });
  const expand = (list: unknown): unknown => {
    if (!Array.isArray(list)) return list;
    const ids: readonly unknown[] = list;
    return ids.flatMap((id) =>
      typeof id === 'string' ? (pieces.get(id) ?? [id]) : [id],
    );
  };
  el.steps = el.steps.map((st) => ({
    ...st,
    ...Object.fromEntries(
      STEP_LISTS.filter((k) => st[k]).map((k): [string, unknown] => [
        k,
        expand(st[k]),
      ]),
    ),
  }));
  return el;
}

interface Word {
  space: boolean;
  parts: CodeSpan[];
}

/** Tokens at spaces; a word can span roles (`Some(` is a function then punctuation) and stays whole. */
function wordsOf(spans: readonly CodeSpan[]): Word[] {
  const tokens = spans.flatMap((sp) =>
    (sp.text.match(/\s+|\S+/g) ?? []).map((t) => ({ text: t, role: sp.role })),
  );
  const words: Word[] = [];
  for (const t of tokens) {
    const last = words.at(-1),
      space = /^\s+$/.test(t.text);
    if (last && !space && !last.space) last.parts.push(t);
    else words.push({ space, parts: [t] });
  }
  return words;
}

const mergeRow = (row: readonly CodeSpan[]) =>
  row.reduce<CodeSpan[]>((a, sp) => {
    const last = a.at(-1);
    if (last && last.role === sp.role) last.text += sp.text;
    else a.push({ ...sp });
    return a;
  }, []);

/** Rows being filled: `used` columns of the last one; a new row starts at the hanging indent. */
interface Rows {
  rows: CodeSpan[][];
  used: number;
  readonly hang: number;
  readonly cols: number;
}
const lastRow = (s: Rows) => s.rows[s.rows.length - 1];
function newRow(s: Rows): void {
  s.rows.push([]);
  s.used = s.hang;
}

/** A chunk longer than a whole row is cut where the row ends; a row never starts with a space. */
function placePart(s: Rows, t: CodeSpan): void {
  let text = t.text;
  if (
    s.used === s.hang &&
    s.rows.length > 1 &&
    !lastRow(s).length &&
    /^\s+$/.test(text)
  )
    return;
  while (s.used + text.length > s.cols && s.used < s.cols) {
    lastRow(s).push({ text: text.slice(0, s.cols - s.used), role: t.role });
    text = text.slice(s.cols - s.used);
    newRow(s);
  }
  if (text) {
    lastRow(s).push({ text, role: t.role });
    s.used += text.length;
  }
}

/** Break at spaces: a word that would cross the edge starts the next row if it fits there whole. */
function placeWord(s: Rows, w: Word): void {
  const len = w.parts.reduce((n, t) => n + t.text.length, 0);
  if (
    !w.space &&
    s.used + len > s.cols &&
    lastRow(s).length &&
    s.hang + len <= s.cols
  )
    newRow(s);
  if (w.space && s.used + len > s.cols) return newRow(s);
  for (const t of w.parts) placePart(s, t);
}

/** Piece `k` of a wrapped line: the first keeps the line's id and number; the rest hang. */
function piece(
  l: CodeLine,
  row: readonly CodeSpan[],
  k: number,
  indent: number,
  hang: number,
): CodeLine {
  const first = k === 0;
  return {
    ...l,
    id: first ? l.id : `${l.id}~${k}`,
    number: first ? l.number : 0,
    indent: first ? indent : hang,
    spans: mergeRow(row),
    ...(l.text != null ? { text: undefined } : {}),
  };
}

/** Split one line's spans into pieces of at most `cols` columns; continuations hang 4 columns deeper. */
function wrapLine(l: CodeLine, cols: number): CodeLine[] {
  const spans = l.spans ?? [{ text: l.text ?? '', role: 'plain' }];
  const indent = l.indent ?? 0,
    hang = Math.min(indent + 4, Math.max(0, cols - 24));
  const s: Rows = { rows: [[]], used: indent, hang, cols };
  for (const w of wordsOf(spans)) placeWord(s, w);
  return s.rows
    .filter((r) => r.length)
    .map((r, k) => piece(l, r, k, indent, hang));
}

/**
 * Fit the editor into `h` (or the area's height): the size drops to show every row, but never below
 * what a viewer can read; too many rows is an error, not small type.
 */
export function fitHeight(
  el: CodeElement,
  spec: Fields,
  where: string,
): CodeElement {
  const rows = codeRows(el),
    leading = numberOr(spec.leading, 1.5, where, 'leading');
  const height = el.h ?? el.maxH;
  delete el.maxH;
  if (height == null) return el;
  const fit = Math.floor(
    height / (rows * leading + (el.title ? 1.9 : 0) + 1.8),
  );
  if (fit < 20)
    return fail(
      where,
      `${rows} rows do not fit ${Math.round(height)} px at a readable size (they would be ${fit} px); narrow the window or give the editor more height`,
    );
  el.size = Math.min(el.size, fit);
  return el;
}
