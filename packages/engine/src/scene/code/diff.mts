import { fail } from '../fields.mjs';
import type { Fields } from '../fields.mjs';

import type { CodeLine, CodeStep, Cue, Staged } from '../types.mjs';
import type { DiffOp } from './contracts.mjs';
import { highlight } from './tokens.mjs';
import { diffSource, lines, changeRange } from './source.mjs';

/** Longest-common-subsequence line diff: [{op: keep|del|add, a, b}] with 0-based line indices. */
export function diffLines(
  a: readonly string[],
  b: readonly string[],
): DiffOp[] {
  const n = a.length,
    m = b.length;
  if (n * m > 4_000_000)
    throw new Error(
      'code diff is too large; narrow it with lines: [first, last]',
    );
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] =
        a[i] === b[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops: DiffOp[] = [];
  let i = 0,
    j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j])
      ops.push({ op: 'keep', a: i++, b: j++ });
    // Removals before insertions, as a reader expects a replaced line to read.
    else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1]))
      ops.push({ op: 'del', a: i++ });
    else ops.push({ op: 'add', b: j++ });
  }
  return ops;
}

/** A diff line's id: its kind, its index on its side, and its row (unique across both sides). */
export const opId = (o: DiffOp, i: number) =>
  `${o.op[0]}${o.op === 'add' ? o.b : o.a}-${i}`;

/** The rows of a diff with their numbers on their own side, indented as written and highlighted. */
export function diffRows(
  ops: readonly DiffOp[],
  a: readonly string[],
  b: readonly string[],
  lang: string,
): CodeLine[] {
  return ops.map((o, i) => {
    const raw = o.op === 'add' ? b[o.b] : a[o.a];
    const expanded = raw.replace(/\t/g, '    ');
    const indent = expanded.length - expanded.trimStart().length;
    return {
      id: opId(o, i),
      number: (o.op === 'del' ? o.a : o.b) + 1,
      indent,
      spans: highlight(expanded.trimStart(), lang),
    };
  });
}

/** An edit from authored text or git: the old side, then (at `say|at`) the new one with its additions in focus. */
export function diffEditor(
  spec: Fields,
  {
    cue,
    where,
    staged,
    root,
  }: { cue: Cue; where: string; staged?: Staged; root: string },
) {
  const source = diffSource(spec, { where, staged, root });
  const a = source.before ? lines(source.before) : [],
    b = source.after ? lines(source.after) : [];
  const all = diffLines(a, b);
  const [first, last] = changeRange(all, spec, where);
  const ops = all.slice(first, last + 1);
  if (ops.length > 60)
    return fail(
      where,
      `the change spans ${ops.length} lines; narrow it with window: [first, last]`,
    );
  const show = (kinds: readonly DiffOp['op'][]) =>
    ops.flatMap((o, i) => (kinds.includes(o.op) ? [opId(o, i)] : []));
  const when =
    spec.say != null || spec.at != null ? cue(spec.say ?? spec.at) : 1.2;
  const steps: CodeStep[] = [
    { at: 0, show: show(['keep', 'del']) },
    {
      at: when,
      show: show(['keep', 'add']),
      add: show(['add']),
      remove: show(['del']),
      focus: spec.focus === false ? [] : show(['add']),
    },
  ];
  return {
    lines: diffRows(ops, a, b, source.lang),
    title: source.title ?? '',
    steps,
  };
}
