import path from 'node:path';
import { isRecord } from '../../engine/lib/errors.mjs';
import { fail, integer, numberOr, optNumber, optString } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { fitCode, fitHeight } from '../code-fit.mjs';
import type {
  CodeElement,
  CodeLine,
  CodeSpan,
  CodeStep,
  Cue,
  Staged,
} from '../types.mjs';
import { gitSides } from './git.mjs';
import type { DiffOp, CodeOptions } from './contracts.mjs';
import { diffEditor } from './diff.mjs';

export const lines = (s: string) =>
  s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');

/** The editor's frame and timing; `leading` and `h` only when authored. */
export function codeBase(spec: Fields, where: string) {
  const leading = optNumber(spec.leading, where, 'leading'),
    h = optNumber(spec.h, where, 'h');
  return {
    type: 'code' as const,
    id: spec.id ?? 'code',
    x: numberOr(spec.x, 120, where, 'x'),
    y: numberOr(spec.y, 300, where, 'y'),
    w: numberOr(spec.w, 1100, where, 'w'),
    size: numberOr(spec.size, 26, where, 'size'),
    gutter: spec.gutter ?? true,
    enter: spec.enter ?? 'fade',
    at: spec.appear ?? 0,
    dur: spec.dur ?? 0.7,
    ...(leading != null ? { leading } : {}),
    ...(h != null ? { h } : {}),
  };
}

export const isSpan = (v: unknown): v is CodeSpan =>
  isRecord(v) && typeof v.text === 'string' && typeof v.role === 'string';

export const optionalOf = (v: unknown, kind: 'string' | 'number') =>
  v === undefined || typeof v === kind;

export function isCodeLine(v: unknown): v is CodeLine {
  if (!isRecord(v) || typeof v.id !== 'string') return false;
  const spans: unknown = v.spans;
  const spansOk =
    spans === undefined || (Array.isArray(spans) && spans.every(isSpan));
  return (
    spansOk &&
    optionalOf(v.text, 'string') &&
    optionalOf(v.indent, 'number') &&
    optionalOf(v.number, 'number')
  );
}

export function codeLine(raw: unknown, where: string): CodeLine {
  if (typeof raw === 'string') return { id: raw, text: raw };
  if (isCodeLine(raw)) return raw;
  return fail(
    where,
    'is a line id string or {id, text or spans, indent, number}',
  );
}

export function authoredStep(raw: unknown, cue: Cue, where: string): CodeStep {
  if (!isRecord(raw)) return fail(where, 'steps are objects');
  return {
    ...raw,
    at: raw.say != null || raw.at != null ? cue(raw.say ?? raw.at) : 0,
    say: undefined,
  };
}

export function inlineSource(
  spec: Fields,
): { lines: readonly unknown[]; steps: readonly unknown[] } | null {
  const { lines: authored, steps } = spec;
  return Array.isArray(authored) && Array.isArray(steps)
    ? { lines: authored, steps }
    : null;
}

export interface DiffSource {
  before: string;
  after: string;
  lang: string;
  title: unknown;
}

/** The two sides of the change: from git at an exact commit, or authored before/after text. */
export function diffSource(
  spec: Fields,
  { where, staged, root }: { where: string; staged?: Staged; root: string },
): DiffSource {
  let lang = optString(spec.lang, where, 'lang') ?? '',
    title = spec.title;
  if (spec.commit) {
    if (!spec.file) return fail(where, 'commit needs file');
    const file = optString(spec.file, where, 'file') ?? '';
    const repoRel = optString(spec.repo, where, 'repo') ?? '.';
    const repo = path.resolve(root, repoRel);
    const sides = gitSides({
      repo,
      commit: String(spec.commit),
      base: spec.base == null ? undefined : String(spec.base),
      file,
    });
    lang ||= path.extname(file).slice(1);
    title ??= `${file} @ ${sides.commit.slice(0, 7)}`;
    staged?.({
      kind: 'code',
      repo: repoRel,
      file,
      commit: sides.commit,
      base: sides.base,
      blobs: { before: sides.oldBlob, after: sides.newBlob },
    });
    return { before: sides.before, after: sides.after, lang, title };
  }
  if (spec.before != null || spec.after != null)
    return {
      before: optString(spec.before, where, 'before') ?? '',
      after: optString(spec.after, where, 'after') ?? '',
      lang,
      title,
    };
  return fail(
    where,
    'code needs lines + steps, before/after, or commit + file',
  );
}

/** An explicit `window`: [first, last] line numbers of the new file (removed lines between them come along). */
export function windowRange(
  ops: readonly DiffOp[],
  window: unknown,
  where: string,
): [number, number] {
  const range: readonly unknown[] = Array.isArray(window) ? window : [];
  const lo = range[0],
    hi = range[1];
  if (!(integer(lo) && integer(hi) && lo >= 1 && hi >= lo))
    return fail(where, 'window is [first, last] line numbers of the new file');
  const inside = ops
    .map((o, i) => (o.op !== 'del' && o.b + 1 >= lo && o.b + 1 <= hi ? i : -1))
    .filter((i) => i >= 0);
  if (!inside.length)
    return fail(where, `window ${lo}–${hi} holds no lines of the new file`);
  const [first, last] = [inside[0], inside[inside.length - 1]];
  if (!ops.slice(first, last + 1).some((o) => o.op !== 'keep'))
    return fail(where, `window ${lo}–${hi} shows no change`);
  return [first, last];
}

/** Show the change with `context` unchanged lines around it, or an explicit `window`. */
export function changeRange(
  ops: readonly DiffOp[],
  spec: Fields,
  where: string,
): [number, number] {
  const changed = ops
    .map((o, i) => (o.op === 'keep' ? -1 : i))
    .filter((i) => i >= 0);
  if (!changed.length)
    return fail(where, 'before and after are identical; nothing to show');
  if (spec.window) return windowRange(ops, spec.window, where);
  const context = numberOr(spec.context, 3, where, 'context');
  return [
    Math.max(0, changed[0] - context),
    Math.min(ops.length - 1, changed[changed.length - 1] + context),
  ];
}

/**
 * One `code` element. `spec`: {x, y, w, size, title, lang, context, say|at, focus, gutter} with
 * either inline `lines`/`steps`, `before`/`after` text, or `commit` + `file` (+ `base`, `repo`).
 */
export function codeElement(
  spec: Fields,
  { cue, where, staged, root = process.cwd(), area = null }: CodeOptions,
): CodeElement {
  const base = codeBase(spec, where);
  const inline = inlineSource(spec);
  const el: CodeElement = inline
    ? {
        ...base,
        lines: inline.lines.map((l, i) => codeLine(l, `${where}.lines[${i}]`)),
        steps: inline.steps.map((st) => authoredStep(st, cue, where)),
        title: spec.title ?? '',
      }
    : { ...base, ...diffEditor(spec, { cue, where, staged, root }) };
  return fitHeight(fitCode(el, area), spec, where);
}
