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
    // Removals before insertions, as a reader expects a replaced line to read.
    else if (i < n && (j >= m || lcs[i + 1][j] >= lcs[i][j + 1])) ops.push({ op: 'del', a: i++ });
    else ops.push({ op: 'add', b: j++ });
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

// IBM Plex Mono advances exactly 0.6 em per character, so code widths are measured, not guessed.
const MONO_ADVANCE = 0.6;
// The renderer's editor: 0.9 em padding each side and a gutter of three 0.8 em digits plus 1 em.
const chrome = gutter => 1.8 + (gutter ? 3 * MONO_ADVANCE * 0.8 + 1 : 0);
export const CODE_MIN_SIZE = 24;
const lineText = l => l.text ?? (l.spans ?? []).map(sp => sp.text).join('');
const lineCols = l => (l.indent ?? 0) + lineText(l).length;

/**
 * Keep an editor inside `area` (title-safe, below the heading) and its lines inside the editor:
 * the type shrinks to the longest line but never below CODE_MIN_SIZE; a line still too long wraps
 * at a token boundary with a hanging indent, and its pieces keep the line's identity through steps.
 */
export function fitCode(el, area) {
  if (area) {
    // An editor drawn for a wider frame takes this frame's height too, not its old height.
    if (el.x + el.w > area.right + 1 && el.h != null) delete el.h;
    // The whole editor moves inside the area: never wider than it, never starting past its edges.
    el.w = Math.min(el.w, area.right - area.left);
    el.x = Math.min(Math.max(el.x, area.left), area.right - el.w);
    el.y = Math.min(Math.max(el.y, area.top), area.bottom - CODE_MIN_SIZE * 4);
    if (el.h == null) el.maxH = area.bottom - el.y;
    else el.h = Math.min(el.h, area.bottom - el.y);
  }
  const room = size => Math.floor((el.w / size - chrome(el.gutter)) / MONO_ADVANCE);
  const longest = Math.max(1, ...el.lines.map(lineCols));
  const fit = el.w / (chrome(el.gutter) + MONO_ADVANCE * longest);
  if (fit >= el.size) return el;
  // On a tall frame (a phone) width is short and height plentiful: a long line wraps at the
  // authored size instead of shrinking toward the floor (the height fit below still shrinks
  // type when the rows would not fit). Elsewhere it shrinks to the floor first, then wraps.
  const tall = area && area.bottom - area.top > area.right - area.left;
  el.size = Math.max(Math.floor(fit), Math.min(el.size, tall ? el.size : CODE_MIN_SIZE));
  const cols = room(el.size);
  if (longest <= cols) return el;
  const pieces = new Map();
  el.lines = el.lines.flatMap(l => {
    if (lineCols(l) <= cols) return [l];
    const out = wrapLine(l, cols);
    pieces.set(l.id, out.map(x => x.id));
    return out;
  });
  const expand = list => list?.flatMap(id => pieces.get(id) ?? [id]);
  el.steps = el.steps.map(st => ({ ...st, ...Object.fromEntries(['show', 'add', 'remove', 'focus'].filter(k => st[k]).map(k => [k, expand(st[k])])) }));
  return el;
}

/** Split one line's spans into pieces of at most `cols` columns; continuations hang 4 columns deeper. */
function wrapLine(l, cols) {
  const spans = l.spans ?? [{ text: l.text ?? '', role: 'plain' }];
  const indent = l.indent ?? 0, hang = Math.min(indent + 4, Math.max(0, cols - 24));
  // Break at spaces; a chunk longer than a whole row is cut where the row ends.
  const tokens = spans.flatMap(sp => (sp.text.match(/\s+|\S+/g) ?? []).map(t => ({ text: t, role: sp.role })));
  // A word can span roles (`Some(` is a function then punctuation): keep it whole when breaking.
  const words = [];
  for (const t of tokens) {
    const last = words.at(-1), space = /^\s+$/.test(t.text);
    if (last && !space && !last.space) last.parts.push(t); else words.push({ space, parts: [t] });
  }
  const rows = [[]];
  let used = indent;
  for (const w of words) {
    const len = w.parts.reduce((n, t) => n + t.text.length, 0);
    if (!w.space && used + len > cols && rows.at(-1).length && hang + len <= cols) { rows.push([]); used = hang; }
    if (w.space && used + len > cols) { rows.push([]); used = hang; continue; }
    for (const t of w.parts) placePart(t);
  }
  function placePart(t) {
    let text = t.text;
    if (used === hang && rows.length > 1 && !rows.at(-1).length && /^\s+$/.test(text)) return;
    while (used + text.length > cols && used < cols) {
      rows.at(-1).push({ text: text.slice(0, cols - used), role: t.role });
      text = text.slice(cols - used); rows.push([]); used = hang;
    }
    if (text) { rows.at(-1).push({ text, role: t.role }); used += text.length; }
  }
  const merge = row => row.reduce((a, sp) => { const last = a.at(-1); if (last && last.role === sp.role) last.text += sp.text; else a.push({ ...sp }); return a; }, []);
  return rows.filter(r => r.length).map((row, k) => ({ ...l, id: k ? `${l.id}~${k}` : l.id, number: k ? 0 : l.number, indent: k ? hang : indent, spans: merge(row), ...(l.text != null ? { text: undefined } : {}) }));
}

/**
 * One `code` element. `spec`: {x, y, w, size, title, lang, context, say|at, focus, gutter} with
 * either inline `lines`/`steps`, `before`/`after` text, or `commit` + `file` (+ `base`, `repo`).
 */
export function codeElement(spec, { cue, where, staged, root = process.cwd(), area = null }) {
  const el = { type: 'code', id: spec.id ?? 'code', x: spec.x ?? 120, y: spec.y ?? 300, w: spec.w ?? 1100, size: spec.size ?? 26, gutter: spec.gutter ?? true, enter: spec.enter ?? 'fade', at: spec.appear ?? 0, dur: spec.dur ?? 0.7 };
  if (spec.leading != null) el.leading = spec.leading;
  if (spec.h != null) el.h = spec.h;
  if (Array.isArray(spec.lines) && Array.isArray(spec.steps)) {
    el.lines = spec.lines.map(l => (typeof l === 'string' ? { id: l, text: l } : l));
    el.steps = spec.steps.map(st => ({ ...st, at: st.say != null || st.at != null ? cue(st.say ?? st.at) : 0, say: undefined }));
    el.title = spec.title ?? '';
    return fitHeight(fitCode(el, area), spec, where);
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
  el.steps = [
    { at: 0, show: show(['keep', 'del']) },
    { at: when, show: show(['keep', 'add']), add: show(['add']), remove: show(['del']), focus: spec.focus === false ? [] : show(['add']) },
  ];
  return fitHeight(fitCode(el, area), spec, where);
}

/**
 * Fit the editor into `h` (or the area's height): the size drops to show every row, but never below
 * what a viewer can read; too many rows is an error, not small type.
 */
function fitHeight(el, spec, where) {
  const rows = Math.max(...el.steps.map(st => st.show?.length ?? 0), 1), leading = spec.leading ?? 1.5;
  const height = el.h ?? el.maxH;
  delete el.maxH;
  if (height == null) return el;
  const fit = Math.floor(height / (rows * leading + (el.title ? 1.9 : 0) + 1.8));
  if (fit < 20) throw new Error(`${where}: ${rows} rows do not fit ${Math.round(height)} px at a readable size (they would be ${fit} px); narrow the window or give the editor more height`);
  el.size = Math.min(el.size, fit);
  return el;
}
