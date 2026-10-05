// Code on a stage: an editor whose lines keep their identity across an edit. Source text comes
// from the author or from git at an exact commit (`commit` + `file`, compared with `base`, by
// default the commit's parent); the plan records the commit and blob ids so what a viewer reads
// is the reviewed code, not a paraphrase.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const KEYWORDS = new Set(
  `fn let mut pub use mod struct enum impl trait for while loop if else match return break continue async await move ref self Self
  const static where type as in crate super dyn unsafe extern true false None Some Ok Err function var class extends new this
  import export from default try catch finally throw typeof instanceof delete void yield of interface implements private public
  protected readonly enum namespace def lambda with pass raise except elif and or not is None True False func package go defer
  chan select range nil struct map switch case`.split(/\s+/),
);

/** Tokens of one line as spans with a colour role. */
export function highlight(text, lang = '') {
  const comment = /^(py|sh|rb|yaml|yml|toml)$/.test(lang) ? /#.*/y : /\/\/.*/y;
  const rules = [
    ['comment', comment],
    ['string', /"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?/y],
    ['number', /\b\d[\d_]*(?:\.\d+)?\b/y],
    ['word', /[A-Za-z_][A-Za-z0-9_]*/y],
    ['space', /\s+/y],
    ['punctuation', /[^\sA-Za-z0-9_"'`]+/y],
  ];
  const spans = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [role, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(text);
      if (!m || !m[0].length) continue;
      let r = role;
      if (role === 'word') r = KEYWORDS.has(m[0]) ? 'keyword' : /^[A-Z]/.test(m[0]) ? 'type' : text[i + m[0].length] === '(' ? 'function' : 'plain';
      if (role === 'space') r = 'plain';
      const last = spans.at(-1);
      if (last && last.role === r) last.text += m[0];
      else spans.push({ text: m[0], role: r });
      i += m[0].length;
      matched = true;
      break;
    }
    if (!matched) {
      spans.push({ text: text[i], role: 'plain' });
      i++;
    }
  }
  return spans;
}

/** Longest-common-subsequence line diff: [{op: keep|del|add, a, b}] with 0-based line indices. */
export function diffLines(a, b) {
  const n = a.length,
    m = b.length;
  if (n * m > 4_000_000) throw new Error('code diff is too large; narrow it with lines: [first, last]');
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const ops = [];
  let i = 0,
    j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) ops.push({ op: 'keep', a: i++, b: j++ });
    else if (j < m && (i >= n || lcs[i][j + 1] >= lcs[i + 1][j])) ops.push({ op: 'add', b: j++ });
    else ops.push({ op: 'del', a: i++ });
  }
  return ops;
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
}

/** Read `file` before and after `commit` (or `base`..`commit`) with the exact object ids. */
export function gitSides({ repo, commit, base, file }) {
  const full = git(repo, ['rev-parse', '--verify', `${commit}^{commit}`]).trim();
  const from = git(repo, ['rev-parse', '--verify', `${base ?? `${full}^`}^{commit}`]).trim();
  const blob = rev => {
    try {
      return git(repo, ['rev-parse', '--verify', `${rev}:${file}`]).trim();
    } catch {
      return null;
    }
  };
  const [oldBlob, newBlob] = [blob(from), blob(full)];
  if (!newBlob && !oldBlob) throw new Error(`${file} is in neither ${from.slice(0, 7)} nor ${full.slice(0, 7)}`);
  const text = b => (b ? git(repo, ['cat-file', 'blob', b]) : '');
  return { commit: full, base: from, file, oldBlob, newBlob, before: text(oldBlob), after: text(newBlob) };
}

const lines = s => s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');

/**
 * One `code` element. `spec`: {x, y, w, size, title, lang, context, say|at, focus, gutter} with
 * either inline `lines`/`steps`, `before`/`after` text, or `commit` + `file` (+ `base`, `repo`).
 */
export function codeElement(spec, { cue, where, staged, root = process.cwd() }) {
  const el = { type: 'code', id: spec.id ?? 'code', x: spec.x ?? 120, y: spec.y ?? 300, w: spec.w ?? 1100, size: spec.size ?? 26, gutter: spec.gutter ?? true, enter: spec.enter ?? 'fade', at: spec.appear ?? 0, dur: spec.dur ?? 0.7 };
  if (spec.leading != null) el.leading = spec.leading;
  if (spec.h != null) el.h = spec.h;
  if (Array.isArray(spec.lines) && Array.isArray(spec.steps)) {
    el.lines = spec.lines.map(l => (typeof l === 'string' ? { id: l, text: l } : l));
    el.steps = spec.steps.map(st => ({ ...st, at: st.say != null || st.at != null ? cue(st.say ?? st.at) : 0, say: undefined }));
    el.title = spec.title ?? '';
    return el;
  }
  let before, after, lang = spec.lang ?? '', title = spec.title;
  if (spec.commit) {
    if (!spec.file) throw new Error(`${where}: commit needs file`);
    const repo = path.resolve(root, spec.repo ?? '.');
    const sides = gitSides({ repo, commit: spec.commit, base: spec.base, file: spec.file });
    ({ before, after } = sides);
    lang ||= path.extname(spec.file).slice(1);
    title ??= `${spec.file} @ ${sides.commit.slice(0, 7)}`;
    staged?.({ kind: 'code', repo: spec.repo ?? '.', file: spec.file, commit: sides.commit, base: sides.base, blobs: { before: sides.oldBlob, after: sides.newBlob } });
  } else if (spec.before != null || spec.after != null) {
    ({ before = '', after = '' } = spec);
  } else throw new Error(`${where}: code needs lines + steps, before/after, or commit + file`);
  const a = before ? lines(before) : [],
    b = after ? lines(after) : [];
  let ops = diffLines(a, b);
  // Show the change with `context` unchanged lines around it, or an explicit `window`:
  // [first, last] line numbers of the new file (removed lines between them come along).
  const changed = ops.map((o, i) => (o.op === 'keep' ? -1 : i)).filter(i => i >= 0);
  if (!changed.length) throw new Error(`${where}: before and after are identical; nothing to show`);
  let first, last;
  if (spec.window) {
    const [lo, hi] = spec.window;
    if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi >= lo)) throw new Error(`${where}: window is [first, last] line numbers of the new file`);
    const inside = ops.map((o, i) => (o.op !== 'del' && o.b + 1 >= lo && o.b + 1 <= hi ? i : -1)).filter(i => i >= 0);
    if (!inside.length) throw new Error(`${where}: window ${lo}–${hi} holds no lines of the new file`);
    [first, last] = [inside[0], inside.at(-1)];
    if (!ops.slice(first, last + 1).some(o => o.op !== 'keep')) throw new Error(`${where}: window ${lo}–${hi} shows no change`);
  } else {
    const context = spec.context ?? 3;
    [first, last] = [Math.max(0, changed[0] - context), Math.min(ops.length - 1, changed.at(-1) + context)];
  }
  ops = ops.slice(first, last + 1);
  if (ops.length > 60) throw new Error(`${where}: the change spans ${ops.length} lines; narrow it with window: [first, last]`);
  const id = (o, i) => `${o.op[0]}${o.op === 'add' ? o.b : o.a}-${i}`;
  const linesOut = ops.map((o, i) => {
    const raw = o.op === 'add' ? b[o.b] : a[o.a];
    const expanded = raw.replace(/\t/g, '    ');
    const indent = expanded.length - expanded.trimStart().length;
    return { id: id(o, i), number: (o.op === 'del' ? o.a : o.b) + 1, indent, spans: highlight(expanded.trimStart(), lang) };
  });
  const show = kinds => ops.map((o, i) => (kinds.includes(o.op) ? id(o, i) : null)).filter(Boolean);
  const when = spec.say != null || spec.at != null ? cue(spec.say ?? spec.at) : 1.2;
  el.lines = linesOut;
  el.title = title ?? '';
  // Fit the editor into `h`: the size drops to show every row, but never below what a viewer
  // can read; too many rows is an error, not small type.
  if (spec.h != null) {
    const rows = Math.max(ops.filter(o => o.op !== 'add').length, ops.filter(o => o.op !== 'del').length);
    const leading = spec.leading ?? 1.5;
    const fit = Math.floor(spec.h / (rows * leading + (el.title ? 1.9 : 0) + 1.8));
    if (fit < 20) throw new Error(`${where}: ${rows} rows do not fit ${spec.h} px at a readable size (they would be ${fit} px); narrow the window or give the editor more height`);
    el.size = Math.min(el.size, fit);
  }
  el.steps = [
    { at: 0, show: show(['keep', 'del']) },
    { at: when, show: show(['keep', 'add']), add: show(['add']), remove: show(['del']), focus: spec.focus === false ? [] : show(['add']) },
  ];
  return el;
}
