// The edit loop: a note becomes a candidate revision with a before/after preview of exactly
// the passage it touched; the person accepts it, refines it or rejects it. Rejecting undoes
// that candidate's changes only where nothing has been edited since; restoring a whole
// revision is explicit and first saves the current state as a revision of its own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderRange, cutPassage, frameRange } from '../../fframes/render.mjs';
import { prepareProject, prepareProjectSync } from '../../fframes/prepare.mjs';
import { useProject } from '../../fframes/library.mjs';
import { expandAssets } from './plates.mjs';
import {
  impact,
  lineageOf,
  listRevisions,
  loadRevision,
  materialize,
  revisionVideo,
  snapshot,
  updateRevision,
  workingTimeline,
  workingContent,
  reviewTimeline,
  trackedFiles,
} from './revisions.mjs';
import { readNotes, locate, setNoteStatus, checkKeeps, addDecision, readKeeps, readDecisions } from './notes.mjs';
import { readEdits, isRecorded, slicePieces } from './recording.mjs';
import { assetSrc } from './timing.mjs';
import { checkId, fingerprint, nextId, objectFile, putObject, readJSONFile, restoreObject, reviewPath, sha256File, writeJSONAtomic } from './store.mjs';
import { phase } from './runlog.mjs';
import { writeComparePage, writeReviewPage } from './review-page.mjs';

/** A timeline shaped like a prepared job, so frameRange can measure passages on it. */
const asJob = tl => ({ fps: tl.fps, frames: tl.frames, beats: tl.beats.map(b => ({ id: b.id, start_frame: b.startFrame, frames: b.frames, transition: b.transition })) });

/** Beats a note is about in the working copy, found by content (never by timestamp alone). */
function noteBeats(root, note, timeline) {
  if (note.scope === 'film') return { film: true, beats: timeline.beats.map(b => b.id) };
  const where = locate(root, note, { id: null, timeline });
  if (where.state === 'addressed' && !where.beat) return { film: false, beats: [...new Set(readEdits(root).filter(e => e.note === note.id).flatMap(e => (e.beats ?? []).map(p => p.beat)))], where };
  if (['stale', 'orphaned'].includes(where.state))
    throw new Error(`Note ${note.id} is ${where.state}: ${where.reason}. Show the person the old moment and ask before editing.`);
  const ids = new Set([where.beat]);
  // A range or chapter note covers its other beats too, followed through lineage.
  for (const id of note.anchor.beats ?? []) {
    const w = locate(root, { ...note, anchor: { ...note.anchor, beat: id, beats: [id], words: '' } }, { id: null, timeline });
    if (w.beat) ids.add(w.beat);
  }
  // A recording edit made for this note (cut --note) declares the beats it touched.
  for (const e of readEdits(root).filter(e => e.note === note.id)) for (const p of e.beats ?? []) ids.add(p.beat);
  return { film: false, beats: [...ids], where };
}

/** Out-of-scope edits: content changes (or additions, removals) beyond the declared beats. */
export function scopeViolations(report, { beats, film }) {
  const allowed = new Set(beats);
  const out = [];
  const moved = (report.order?.moved ?? []).filter(id => !allowed.has(id));
  if (!film && moved.length) out.push({ what: 'order', message: `the order of beats changed: ${moved.join(', ')} moved, outside the note's beats` });
  if (!film && report.film.look === 'changed') out.push({ what: 'film look', message: 'the film look changed, but the note is not film-wide' });
  if (!film && report.film.sound === 'changed') out.push({ what: 'sound', message: 'the music or mix settings changed, but the note is not film-wide' });
  if (!film && report.film.voice === 'changed') out.push({ what: 'voice', message: 'the voice settings changed, but the note is not film-wide' });
  for (const x of report.beats) {
    if (film) break;
    if (x.status === 'content' && !allowed.has(x.id)) out.push({ beat: x.id, message: `${x.id} changed (${x.reasons.join('; ')})` });
    if (x.status === 'added' && !allowed.has(x.id) && !x.from?.some(f => allowed.has(f)))
      out.push({ beat: x.id, message: `${x.id} was added` });
    if (x.status === 'removed' && !allowed.has(x.id) && !x.into?.some(f => allowed.has(f)))
      out.push({ beat: x.id, message: `${x.id} was removed` });
  }
  return out;
}

/** The "before" passage: from the stored video of `rev` when kept, else re-rendered from it. */
async function beforePassage(root, rev, timeline, range, name) {
  const dir = reviewPath(root, 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}.mp4`);
  const video = revisionVideo(root, rev);
  if (video?.file) {
    const r = await phase('passage', () => cutPassage(video.file, { fps: timeline.fps, a: range.a, b: range.b, out }));
    const receipt = {
      kind: 'passage',
      revision: rev.id,
      from: 'the stored video of this revision (what was watched)',
      video: video.object,
      range: { frames: [range.a, range.b], seconds: [range.a / timeline.fps, range.b / timeline.fps], fps: timeline.fps },
      beats: range.covered,
      ...r,
    };
    writeJSONAtomic(`${out}.json`, receipt);
    return receipt;
  }
  // The video was released: rebuild the revision's project from its stored inputs and render.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `cf-${rev.id}-`));
  try {
    materialize(root, rev.id, tmp);
    const ctx = await prepareProject(tmp, { draft: true, rough: true });
    const r = await renderRange(tmp, { beats: range.beatIds, handles: range.handles, ctx, out, name, verify: false });
    const receipt = {
      ...r,
      kind: 'passage',
      revision: rev.id,
      from: `re-rendered from the revision’s stored inputs (${(rev.videos ?? []).length ? 'its video was released to save space' : 'it was never rendered in full'})`,
      sameRenderer: ctx.manifest.rendererSourceHash === rev.renderer.sourceHash,
    };
    writeJSONAtomic(`${out}.json`, receipt);
    return receipt;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const keepObject = (root, file) => (file && fs.existsSync(file) ? putObject(root, file).object : null);

/** Before/after passages for an impact report between revision A (stored) and B (stored or working). */
async function passages(root, { A, B, report, handles, limit = 4, ctxB, tag }) {
  const out = [];
  for (const [k, p] of report.passages.slice(0, limit).entries()) {
    const fromA = [...new Set([...p.beats.filter(id => A.timeline.beats.some(b => b.id === id)), ...p.removed])];
    for (const id of p.beats) for (const w of B.timeline.beats.find(b => b.id === id)?.was ?? []) if (A.timeline.beats.some(b => b.id === w)) fromA.push(w);
    const entry = { beats: p.beats, removed: p.removed };
    if (fromA.length) {
      const range = { ...frameRange(asJob(A.timeline), { beats: fromA, handles }), handles, beatIds: fromA };
      entry.before = await beforePassage(root, A.meta, A.timeline, range, `${tag}-${A.meta.id}-p${k + 1}-before`);
    }
    if (p.beats.length) {
      const name = `${tag}-${B.meta?.id ?? 'working'}-p${k + 1}-after`;
      if (ctxB) entry.after = await renderRange(root, { beats: p.beats, handles, ctx: ctxB, name });
      else entry.after = await beforePassage(root, B.meta, B.timeline, { ...frameRange(asJob(B.timeline), { beats: p.beats, handles }), handles, beatIds: p.beats }, name);
    }
    for (const side of ['before', 'after'])
      if (entry[side]) entry[side].object = keepObject(root, entry[side].output);
    out.push(entry);
  }
  return out;
}

/**
 * Turn the working copy into a candidate revision for a note: check the edit stayed inside
 * the note's beats (or the scope given) and broke no keep, save the revision, render the
 * affected passages before and after, write the compare page and mark the note applied.
 */
export async function revise(root, { note: noteId, scope, reason, handles = 2, overrides = [], label, render = true }) {
  checkId('note', noteId);
  const note = readNotes(root).find(n => n.id === noteId);
  if (!note) throw new Error(`No note ${noteId}.`);
  const base = listRevisions(root).at(-1);
  if (!base) throw new Error('No revision to compare against: render or snapshot the film first.');
  const A = loadRevision(root, base.id);
  const { ctx, timeline } = await phase('prepare', () => workingTimeline(root));
  const declared = noteBeats(root, note, timeline);
  if (scope === 'film') declared.film = true;
  else if (scope) {
    if (!reason) throw new Error('Widening a note’s scope needs --reason (what made the extra beats part of this note).');
    for (const id of scope.split(',')) declared.beats.push(checkId('beat', id.trim()));
  }
  const edits = readEdits(root);
  const lineage = lineageOf(A.timeline, timeline, edits);
  const report = impact(A.timeline, timeline, { lineage, from: base.id, to: 'candidate' });
  const outside = scopeViolations(report, declared);
  if (outside.length)
    throw new Error(
      `Changes outside note ${note.id}'s scope (${declared.film ? 'film' : declared.beats.join(', ')}):\n  - ${outside.map(o => o.message).join('\n  - ')}\nRevert them, or widen with --scope ID,ID --reason "why".`,
    );
  // An override is the person's call, recorded before the edit is accepted as a candidate.
  const granted = new Set(readDecisions(root).filter(d => d.action === 'override' && d.role === 'human').map(d => d.scope?.keep));
  for (const k of overrides)
    if (!granted.has(k)) throw new Error(`No recorded override for ${k}: record the person's decision with override DIR --keep ${k} --by NAME --said "…".`);
  const broken = checkKeeps(root, timeline, { overrides });
  if (broken.length)
    throw new Error(
      `This edit breaks a keep:\n  - ${broken.map(b => `${b.keep} (${b.what}): ${b.message}`).join('\n  - ')}\nAsk the person; if they agree, record it with override --keep ${broken[0].keep} --by NAME --said "…" and pass --override.`,
    );
  if (report.counts.content == null && report.counts.added == null && report.counts.removed == null && !['look', 'sound', 'voice', 'data'].some(k => report.film[k] === 'changed'))
    throw new Error(`Nothing changed since ${base.id}; edit the film for note ${note.id} first.`);
  const { revision: rev, created } = await phase('revision', () =>
    snapshot(root, { ctx, kind: 'candidate', label, reason: `note ${note.id}: ${note.text.slice(0, 160)}`, notes: [note.id] }),
  );
  if (!created) throw new Error(`The working copy matches ${rev.id} already.`);
  const B = { meta: rev, timeline };
  const shown = render ? await passages(root, { A, B, report, handles, ctxB: ctx, tag: rev.id }) : [];
  updateRevision(root, rev.id, m => {
    m.previews = shown.map(p => ({
      beats: p.beats,
      removed: p.removed,
      before: p.before ? { object: p.before.object, revision: base.id, frames: p.before.range?.frames } : null,
      after: p.after ? { object: p.after.object, frames: p.after.range?.frames, verified: p.after.verified ?? null } : null,
    }));
    m.impact = { from: base.id, summary: report.summary, counts: report.counts };
  });
  setNoteStatus(root, note.id, 'applied', { revision: rev.id, reason: report.summary[0] });
  const page = writeComparePage(root, { A, B: loadRevision(root, rev.id), report, passages: shown, note });
  writeReviewPage(root);
  return { revision: rev.id, base: base.id, note: note.id, report, passages: shown, unrendered: Math.max(0, report.passages.length - shown.length), page, declared };
}

/** Before/after for two revisions (B may be 'working'). */
export async function compareRevisions(root, { from, to, handles = 2 }) {
  const A = loadRevision(root, checkId('revision', from));
  let B, ctxB;
  if (to === 'working' || to == null) {
    const w = await workingTimeline(root);
    B = { meta: null, timeline: w.timeline };
    ctxB = w.ctx;
  } else B = loadRevision(root, checkId('revision', to));
  // A revision's stored lineage is relative to its parent; otherwise derive it for this pair.
  const lineage = B.meta?.parent === A.meta.id ? B.meta.lineage : lineageOf(A.timeline, B.timeline, readEdits(root));
  const report = impact(A.timeline, B.timeline, { lineage, from, to: to ?? 'working' });
  const shown = await passages(root, { A, B, report, handles, ctxB, tag: `cmp-${from}-${to ?? 'working'}` });
  const page = writeComparePage(root, { A, B, report, passages: shown });
  return { report, passages: shown, page };
}

// ------------------------------------------------------------------ restoring

/** Asset ids a beat names (a layered plate set names its far, mid and near layers). */
function assetRefs(beat) {
  const ids = new Set(),
    files = new Set();
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'asset' && typeof x === 'string') ids.add(x);
        else if (k === 'plates' && typeof x === 'string') ['far', 'mid', 'near'].forEach(l => ids.add(`${x}-${l}`));
        else if (k === 'file' && typeof x === 'string') files.add(x);
        else walk(x);
      }
  };
  walk([beat.props, beat.art, beat.plate]);
  return { ids, files };
}

/** The files that made one beat in a revision: its narration and the media it named. */
function beatFiles(sbBeat, sbAssets, inputs) {
  const rels = new Set([`assets/vo/${sbBeat.id}.wav`, `assets/vo/${sbBeat.id}.json`]);
  const { ids, files } = assetRefs(sbBeat);
  for (const f of files) rels.add(f);
  for (const id of ids) {
    const a = sbAssets.find(a => a.id === id);
    if (a?.file) rels.add(a.file);
    const name = id.replace(/[^a-z0-9_-]/gi, '');
    for (const rel of Object.keys(inputs)) if (new RegExp(`^assets/(img|clips|sfx)/${name}\\.[a-z0-9]+$`, 'i').test(rel)) rels.add(rel);
  }
  return [...rels].filter(rel => inputs[rel]);
}

/** Media each beat uses now, as {relative path: [beat ids]} (narration excluded: it is per beat). */
function mediaUsers(root, sb) {
  const assets = expandAssets(sb.assets ?? []);
  const users = {};
  for (const b of sb.beats) {
    const { ids, files } = assetRefs(b);
    const rels = new Set(files);
    for (const id of ids) {
      const a = assets.find(x => x.id === id);
      const rel = a && assetSrc(root, a);
      if (rel) rels.add(rel);
    }
    for (const rel of rels) (users[rel] ??= []).push(b.id);
  }
  return users;
}
const objectSha = object => /([0-9a-f]{64})/.exec(String(object))?.[1] ?? null;
const currentSha = (root, rel) => {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? sha256File(f) : null;
};

/**
 * Shared media a restore would rewrite under other beats: [{file, beats}] for each file the
 * restored beats need that differs now and is also used by a beat that is not being restored.
 */
function sharedRewrites(root, files, restoring, sbNow) {
  const users = mediaUsers(root, sbNow);
  const out = [];
  for (const [rel, object] of files) {
    if (rel.startsWith('assets/vo/')) continue;
    if (currentSha(root, rel) === objectSha(object)) continue;
    const others = (users[rel] ?? []).filter(id => !restoring.has(id));
    if (others.length) out.push({ file: rel, beats: others });
  }
  return out;
}

/** Recorded beats whose recording would play twice: [[a, b]] pairs of beat ids. */
function overlappingSources(root, sb, metaFor) {
  const transcript = readJSONFile(path.join(root, 'source', 'words.json'), null);
  if (!transcript) return [];
  const fps = sb.format?.fps ?? 30;
  const spans = [];
  for (const b of sb.beats) {
    const m = metaFor(b.id);
    if (!isRecorded(m)) continue;
    for (const p of slicePieces(m, { rate: transcript.rate, fps })) if (p.pad == null) spans.push([p.from, p.to, b.id]);
  }
  spans.sort((x, y) => x[0] - y[0]);
  const out = [];
  for (let i = 1; i < spans.length; i++) if (spans[i][0] < spans[i - 1][1] && spans[i][2] !== spans[i - 1][2]) out.push([spans[i - 1][2], spans[i][2]]);
  return out;
}
const storedJSON = (root, object) => {
  const f = object && objectFile(root, object);
  return f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};

function restoreFiles(root, list) {
  for (const [rel, object] of list) {
    const dest = path.resolve(root, rel);
    if (!dest.startsWith(root + path.sep)) throw new Error(`Refusing to restore outside the project: ${rel}`);
    restoreObject(root, object, dest);
  }
}
const storyboardOf = (root, id) => readJSONFile(reviewPath(root, 'revisions', id, 'storyboard.json'));
const writeStoryboard = (root, sb) => writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/** Insert `beat` after the nearest earlier beat of `order` that the storyboard still has. */
function insertInOrder(sb, beat, order) {
  const i = order.indexOf(beat.id);
  for (let k = i - 1; k >= 0; k--) {
    const at = sb.beats.findIndex(b => b.id === order[k]);
    if (at >= 0) return sb.beats.splice(at + 1, 0, beat);
  }
  sb.beats.unshift(beat);
}

/** Move a file into review/aside/<restore point>/… (a rename on the same volume). */
function setAside(root, rel, point) {
  const to = reviewPath(root, 'aside', point, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(path.join(root, rel), to);
  return path.relative(root, to).split(path.sep).join('/');
}

/**
 * Undo a candidate's changes where nobody has edited since: beats it changed go back to its
 * parent, beats it added go, beats it removed return. Anything edited after the candidate is a
 * conflict and is left alone (named in the report), as is a shared media file another beat
 * still uses, and a beat whose recording another beat now plays. The state before is saved.
 */
export async function rejectRevision(root, { revision, note, by, said }) {
  checkId('revision', revision);
  const C = loadRevision(root, revision);
  if (!C.meta.parent) throw new Error(`${revision} has no parent to go back to.`);
  const P = loadRevision(root, C.meta.parent);
  const { revision: point } = await snapshot(root, { kind: 'restore-point', reason: `before rejecting ${revision}`, force: true });
  const { timeline: W } = await workingTimeline(root);
  const sb = readJSONFile(path.join(root, 'storyboard.json'));
  const sbNow = structuredClone(sb);
  const sbP = storyboardOf(root, P.meta.id),
    sbC = storyboardOf(root, C.meta.id);
  const changes = impact(P.timeline, C.timeline, { lineage: C.meta.lineage }).beats;
  const restored = [],
    conflicts = [];
  const inW = id => W.beats.find(b => b.id === id);
  // Which beats can go back, before any file is touched.
  const back = [];
  for (const x of changes) {
    const c = C.timeline.beats.find(b => b.id === x.id);
    if (x.status === 'content') {
      const w = inW(x.id);
      if (!w || w.prints.authored !== c.prints.authored) conflicts.push(`${x.id} was edited after ${revision}`);
      else back.push({ id: x.id, op: 'replace' });
    } else if (x.status === 'added') {
      const w = inW(x.id);
      if (w && w.prints.authored !== c.prints.authored) conflicts.push(`${x.id} (added by ${revision}) was edited since`);
      else back.push({ id: x.id, op: 'drop' });
    } else if (x.status === 'removed' && !sb.beats.some(b => b.id === x.id)) back.push({ id: x.id, op: 'insert' });
  }
  const restoring = new Set(back.map(b => b.id));
  const files = new Map();
  for (const b of back.filter(b => b.op !== 'drop'))
    for (const rel of beatFiles(sbP.beats.find(x => x.id === b.id), sbP.assets ?? [], P.meta.inputs)) files.set(rel, P.meta.inputs[rel]);
  const sharedFiles = new Set(sharedRewrites(root, [...files], restoring, sbNow).map(s => s.file));
  for (const s of sharedRewrites(root, [...files], restoring, sbNow)) conflicts.push(`${s.file} is also used by ${s.beats.join(', ')}, edited since; left as it is`);
  for (const b of back) {
    const old = sbP.beats.find(x => x.id === b.id);
    if (b.op === 'replace') sb.beats[sb.beats.findIndex(x => x.id === b.id)] = old;
    else if (b.op === 'drop') sb.beats = sb.beats.filter(x => x.id !== b.id);
    else insertInOrder(sb, old, sbP.beats.map(x => x.id));
  }
  // A recorded beat that comes back must not replay recording another beat plays now.
  const metaFor = id =>
    restoring.has(id) && back.find(b => b.id === id).op !== 'drop'
      ? storedJSON(root, P.meta.inputs[`assets/vo/${id}.json`])
      : readJSONFile(path.join(root, 'assets', 'vo', `${id}.json`), null);
  const twice = overlappingSources(root, sb, metaFor);
  if (twice.length)
    throw new Error(
      `Rejecting ${revision} would play the same recording twice (${twice.map(p => p.join(' and ')).join('; ')}): it was split, merged or cut since. Restore the whole revision instead (restore DIR ${P.meta.id}); nothing was changed.`,
    );
  restoreFiles(root, [...files].filter(([rel]) => !sharedFiles.has(rel)));
  restored.push(...back.map(b => b.id));
  // Beat order: if the candidate rearranged beats and nobody has rearranged them since, they go
  // back to the parent's order in the places they hold now (other beats stay where they are).
  const both = new Set(sbP.beats.map(b => b.id).filter(id => sbC.beats.some(b => b.id === id)));
  const orderP = sbP.beats.map(b => b.id).filter(id => both.has(id)),
    orderC = sbC.beats.map(b => b.id).filter(id => both.has(id));
  if (!same(orderP, orderC)) {
    const present = sb.beats.map(b => b.id).filter(id => both.has(id));
    if (same(present, orderC.filter(id => present.includes(id)))) {
      const slots = sb.beats.map((b, i) => (both.has(b.id) ? i : -1)).filter(i => i >= 0);
      const want = orderP.filter(id => present.includes(id));
      const byId = new Map(sb.beats.map(b => [b.id, b]));
      slots.forEach((slot, k) => (sb.beats[slot] = byId.get(want[k])));
      restored.push('beat order');
    } else conflicts.push(`the beat order was changed after ${revision}; left as it is`);
  }
  // Film settings, when the candidate changed them and nobody has since.
  const film = s => {
    const { beats, ...rest } = s;
    return rest;
  };
  if (!same(film(sbP), film(sbC))) {
    if (same(film(sb), film(sbC))) {
      Object.assign(sb, film(sbP));
      for (const k of Object.keys(film(sbC))) if (!(k in film(sbP))) delete sb[k];
      restored.push('film settings');
    } else conflicts.push(`film settings were edited after ${revision}`);
  }
  // Recording edits restore the transcript files of the parent when the candidate changed them.
  for (const rel of ['source/words.json'])
    if (P.meta.inputs[rel] && C.meta.inputs[rel] !== P.meta.inputs[rel]) restoreObject(root, P.meta.inputs[rel], path.join(root, rel));
  writeStoryboard(root, sb);
  const decision = addDecision(root, { action: 'reject', role: 'human', by, said, revision, scope: note ? { note } : {} });
  if (note) setNoteStatus(root, note, 'open', { revision, by, reason: `${revision} rejected: ${said}` });
  fs.appendFileSync(
    reviewPath(root, 'edits.jsonl'),
    JSON.stringify({ id: nextId('x', readEdits(root).map(e => e.id)), op: 'reject', of: revision, beats: restored, conflicts, at: new Date().toISOString() }) + '\n',
  );
  const { revision: after } = await snapshot(root, { kind: 'restored', reason: `rejected ${revision}: restored ${restored.join(', ') || 'nothing'} from ${P.meta.id}` });
  writeReviewPage(root);
  return { revision, parent: P.meta.id, restorePoint: point.id, now: after.id, restored, conflicts, decision: decision.id };
}

/** How the working copy now compares with revision R: exact, inputs-only, or what differs. */
function verifyAgainst(root, R) {
  let w;
  try {
    w = workingContent(root);
  } catch (e) {
    return { state: 'differs', error: `the restored project does not prepare: ${String(e.message).split('\n')[0]}` };
  }
  if (w.contentId === R.meta.contentId) return { state: 'exact', contentId: w.contentId };
  const want = Object.fromEntries(Object.entries(R.meta.inputs).map(([rel, o]) => [rel, objectSha(o)]));
  const missing = Object.keys(want).filter(rel => !w.inputs[rel]);
  const extra = Object.keys(w.inputs).filter(rel => !want[rel]);
  const changed = Object.keys(want).filter(rel => w.inputs[rel] && w.inputs[rel] !== want[rel]);
  const renderer = w.ctx.manifest.rendererSourceHash !== R.meta.renderer.sourceHash;
  const fonts = fingerprint(w.ctx.manifest.fontHashes) !== R.meta.renderer.fonts;
  const inputsMatch = !missing.length && !extra.length && !changed.length;
  const look = reviewTimeline(w.ctx).film.look === R.timeline.film.look;
  return {
    state: inputsMatch ? 'inputs' : 'differs',
    ...(missing.length ? { missing } : {}),
    ...(extra.length ? { extra } : {}),
    ...(changed.length ? { changed } : {}),
    renderer: renderer ? 'changed since' : 'same',
    fonts: fonts ? 'changed since' : 'same',
    look: look ? 'same' : 'differs (the shared or built-in library may have changed)',
  };
}

/**
 * Restore a whole revision (or some of its beats) into the working copy. Explicit and
 * recoverable: the current state is first saved as a revision, and every file comes from the
 * object store, checked against its hash.
 * - Whole: the revision's files are written, tracked inputs it did not have (library
 *   overrides, takes, sound files, the music bed's pointer) are moved aside into
 *   review/aside/<restore point>/, as is any media the loader would now pick over the
 *   revision's own; then the result is verified against the revision (exact, or inputs-only
 *   when the renderer or fonts changed since, or a list of differences).
 * - Some beats: refused when a media file they need differs and other beats use it (unless
 *   `shared`), or when a recorded beat would replay recording another beat plays now.
 */
export async function restoreRevision(root, { revision, beats, by, said, role = 'human', shared = false }) {
  checkId('revision', revision);
  const R = loadRevision(root, revision);
  const sbR = storyboardOf(root, revision);
  if (beats?.length) {
    const sb = readJSONFile(path.join(root, 'storyboard.json'));
    const sbNow = structuredClone(sb);
    const restoring = new Set(beats.map(id => checkId('beat', id)));
    const files = new Map();
    for (const id of restoring) {
      const old = sbR.beats.find(b => b.id === id);
      if (!old) throw new Error(`${revision} has no beat ${id}.`);
      if (!sb.beats.some(b => b.id === id)) {
        const heirs = sb.beats.filter(b => (b.was ?? []).includes(id)).map(b => b.id);
        if (heirs.length)
          throw new Error(`${id} became ${heirs.join(' + ')} since ${revision}; restore those, or the whole revision. Nothing was changed.`);
      }
      for (const rel of beatFiles(old, sbR.assets ?? [], R.meta.inputs)) files.set(rel, R.meta.inputs[rel]);
    }
    const rewrites = sharedRewrites(root, [...files], restoring, sbNow);
    if (rewrites.length && !shared)
      throw new Error(
        `Restoring ${[...restoring].join(', ')} would also change other beats: ${rewrites.map(r => `${r.file} (used by ${r.beats.join(', ')})`).join('; ')}. Add --shared to change them too, or restore the whole revision. Nothing was changed.`,
      );
    for (const id of restoring) {
      const old = sbR.beats.find(b => b.id === id);
      const at = sb.beats.findIndex(b => b.id === id);
      if (at >= 0) sb.beats[at] = old;
      else insertInOrder(sb, old, sbR.beats.map(b => b.id));
    }
    const metaFor = id =>
      restoring.has(id) ? storedJSON(root, R.meta.inputs[`assets/vo/${id}.json`]) : readJSONFile(path.join(root, 'assets', 'vo', `${id}.json`), null);
    const twice = overlappingSources(root, sb, metaFor);
    if (twice.length)
      throw new Error(
        `Restoring ${[...restoring].join(', ')} would play the same recording twice (${twice.map(p => p.join(' and ')).join('; ')}). Restore the beats that replaced it too, or the whole revision. Nothing was changed.`,
      );
    const { revision: point } = await snapshot(root, { kind: 'restore-point', reason: `before restoring ${[...restoring].join(', ')} from ${revision}`, force: true });
    restoreFiles(root, [...files]);
    writeStoryboard(root, sb);
    const decision = addDecision(root, { action: 'restore', role, by, said, reason: `restored ${[...restoring].join(', ')} from ${revision}`, revision });
    const { revision: after } = await snapshot(root, { kind: 'restored', reason: `restored ${[...restoring].join(', ')} from ${revision}` });
    writeReviewPage(root);
    return { revision, restorePoint: point.id, now: after.id, restored: [...restoring], ...(rewrites.length ? { alsoChanged: rewrites } : {}), decision: decision.id };
  }
  useProject(null);
  if (workingContent(root).contentId === R.meta.contentId) return { revision, unchanged: true, restored: [], verified: { state: 'exact' } };
  const { revision: point } = await snapshot(root, { kind: 'restore-point', reason: `before restoring ${revision}`, force: true });
  restoreFiles(root, Object.entries(R.meta.inputs));
  const aside = [];
  for (const rel of trackedFiles(root))
    if (!R.meta.inputs[rel]) aside.push({ file: rel, to: setAside(root, rel, point.id), why: `${revision} did not have it` });
  // Media the loader would now pick instead of the revision's (an image of another format, a bed).
  for (let pass = 0; pass < 4; pass++) {
    useProject(null);
    let ctx;
    try {
      ctx = prepareProjectSync(root, { draft: true, rough: true });
    } catch {
      break; // verifyAgainst reports why
    }
    const picked = Object.keys(ctx.manifest.hashes).filter(rel => !R.meta.inputs[rel] && /^assets\/(img|clips|music|sfx)\//.test(rel));
    if (!picked.length) break;
    for (const rel of picked) aside.push({ file: rel, to: setAside(root, rel, point.id), why: `the loader picked it over ${revision}'s own` });
  }
  useProject(null);
  const verified = verifyAgainst(root, R);
  const decision = addDecision(root, { action: 'restore', role, by, said, reason: `restored everything from ${revision}`, revision });
  const { revision: after } = await snapshot(root, { kind: 'restored', reason: `restored all from ${revision}` });
  writeReviewPage(root);
  return { revision, restorePoint: point.id, now: after.id, restored: ['whole revision'], aside, verified, decision: decision.id };
}

export { reviewTimeline, readKeeps };
