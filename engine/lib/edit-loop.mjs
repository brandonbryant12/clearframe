// The edit loop: a note becomes a candidate revision with a before/after preview of exactly
// the passage it touched; the person accepts it, refines it or rejects it. Rejecting undoes
// that candidate's changes only where nothing has been edited since; restoring a whole
// revision is explicit and first saves the current state as a revision of its own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderRange, cutPassage, frameRange } from '../../fframes/render.mjs';
import { prepareProject } from '../../fframes/prepare.mjs';
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
  reviewTimeline,
} from './revisions.mjs';
import { readNotes, locate, setNoteStatus, checkKeeps, addDecision, readKeeps, readDecisions } from './notes.mjs';
import { readEdits } from './recording.mjs';
import { assetSrc } from './timing.mjs';
import { checkId, putObject, readJSONFile, restoreObject, reviewPath, writeJSONAtomic } from './store.mjs';
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
  const report = impact(A.timeline, B.timeline, { lineage: B.meta?.lineage ?? lineageOf(A.timeline, B.timeline, readEdits(root)), from, to: to ?? 'working' });
  const shown = await passages(root, { A, B, report, handles, ctxB, tag: `cmp-${from}-${to ?? 'working'}` });
  const page = writeComparePage(root, { A, B, report, passages: shown });
  return { report, passages: shown, page };
}

// ------------------------------------------------------------------ restoring

/** The files that make one beat: its narration and every media file it names. */
function beatFiles(sbBeat, sbAssets, inputs) {
  const rels = new Set([`assets/vo/${sbBeat.id}.wav`, `assets/vo/${sbBeat.id}.json`]);
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'asset' && typeof x === 'string') {
          const a = sbAssets.find(a => a.id === x);
          if (a?.file) rels.add(a.file);
          for (const rel of Object.keys(inputs)) if (new RegExp(`^assets/(img|clips|sfx)/${x.replace(/[^a-z0-9_-]/gi, '')}(-(far|mid|near))?\\.[a-z0-9]+$`, 'i').test(rel)) rels.add(rel);
        } else if (k === 'file' && typeof x === 'string') rels.add(x);
        else walk(x);
      }
  };
  walk([sbBeat.props, sbBeat.art, sbBeat.plate]);
  return [...rels].filter(rel => inputs[rel]);
}

function restoreBeatFiles(root, meta, sbBeat, sbAssets) {
  for (const rel of beatFiles(sbBeat, sbAssets, meta.inputs)) {
    const dest = path.resolve(root, rel);
    if (!dest.startsWith(root + path.sep)) throw new Error(`Refusing to restore outside the project: ${rel}`);
    restoreObject(root, meta.inputs[rel], dest);
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

/**
 * Undo a candidate's changes where nobody has edited since: beats it changed go back to its
 * parent, beats it added go, beats it removed return. Anything edited after the candidate is a
 * conflict and is left alone (named in the report). The state before is saved as a revision.
 */
export async function rejectRevision(root, { revision, note, by, said }) {
  checkId('revision', revision);
  const C = loadRevision(root, revision);
  if (!C.meta.parent) throw new Error(`${revision} has no parent to go back to.`);
  const P = loadRevision(root, C.meta.parent);
  const { revision: point } = await snapshot(root, { kind: 'restore-point', reason: `before rejecting ${revision}`, force: true });
  const { timeline: W } = await workingTimeline(root);
  const sb = readJSONFile(path.join(root, 'storyboard.json'));
  const sbP = storyboardOf(root, P.meta.id),
    sbC = storyboardOf(root, C.meta.id);
  const changes = impact(P.timeline, C.timeline, { lineage: C.meta.lineage }).beats;
  const restored = [],
    conflicts = [];
  const inW = id => W.beats.find(b => b.id === id);
  for (const x of changes) {
    const c = C.timeline.beats.find(b => b.id === x.id);
    if (x.status === 'content') {
      const w = inW(x.id);
      if (!w || w.prints.authored !== c.prints.authored) {
        conflicts.push(`${x.id} was edited after ${revision}`);
        continue;
      }
      const old = sbP.beats.find(b => b.id === x.id);
      sb.beats[sb.beats.findIndex(b => b.id === x.id)] = old;
      restoreBeatFiles(root, P.meta, old, sbP.assets ?? []);
      restored.push(x.id);
    } else if (x.status === 'added') {
      const w = inW(x.id);
      if (w && w.prints.authored !== c.prints.authored) {
        conflicts.push(`${x.id} (added by ${revision}) was edited since`);
        continue;
      }
      sb.beats = sb.beats.filter(b => b.id !== x.id);
      restored.push(x.id);
    } else if (x.status === 'removed') {
      if (sb.beats.some(b => b.id === x.id)) continue;
      const old = sbP.beats.find(b => b.id === x.id);
      insertInOrder(sb, old, sbP.beats.map(b => b.id));
      restoreBeatFiles(root, P.meta, old, sbP.assets ?? []);
      restored.push(x.id);
    }
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
  fs.appendFileSync(reviewPath(root, 'edits.jsonl'), JSON.stringify({ id: `x${Date.now()}`, op: 'reject', of: revision, beats: restored, conflicts, at: new Date().toISOString() }) + '\n');
  const { revision: after } = await snapshot(root, { kind: 'restored', reason: `rejected ${revision}: restored ${restored.join(', ') || 'nothing'} from ${P.meta.id}` });
  writeReviewPage(root);
  return { revision, parent: P.meta.id, restorePoint: point.id, now: after.id, restored, conflicts, decision: decision.id };
}

/**
 * Restore a whole revision (or some of its beats) into the working copy. Explicit and
 * recoverable: the current state is first saved as a revision, and every file comes from the
 * object store, checked against its hash. Renders are not promised bit-identical when the
 * renderer has changed since.
 */
export async function restoreRevision(root, { revision, beats, by, said, role = 'human' }) {
  checkId('revision', revision);
  const R = loadRevision(root, revision);
  const { revision: point } = await snapshot(root, { kind: 'restore-point', reason: `before restoring ${revision}`, force: true });
  const sbR = storyboardOf(root, revision);
  let restored;
  if (beats?.length) {
    const sb = readJSONFile(path.join(root, 'storyboard.json'));
    for (const id of beats) {
      checkId('beat', id);
      const old = sbR.beats.find(b => b.id === id);
      if (!old) throw new Error(`${revision} has no beat ${id}.`);
      const at = sb.beats.findIndex(b => b.id === id);
      if (at >= 0) sb.beats[at] = old;
      else insertInOrder(sb, old, sbR.beats.map(b => b.id));
      restoreBeatFiles(root, R.meta, old, sbR.assets ?? []);
    }
    writeStoryboard(root, sb);
    restored = beats;
  } else {
    for (const [rel, object] of Object.entries(R.meta.inputs)) {
      const dest = path.resolve(root, rel);
      if (!dest.startsWith(root + path.sep)) throw new Error(`Refusing to restore outside the project: ${rel}`);
      restoreObject(root, object, dest);
    }
    restored = ['whole revision'];
  }
  const decision = addDecision(root, { action: 'restore', role, by, said, reason: `restored ${beats?.length ? beats.join(', ') : 'everything'} from ${revision}`, revision });
  const { revision: after } = await snapshot(root, { kind: 'restored', reason: `restored ${beats?.length ? beats.join(', ') : 'all'} from ${revision}` });
  writeReviewPage(root);
  return { revision, restorePoint: point.id, now: after.id, restored, decision: decision.id };
}

export { reviewTimeline, readKeeps };
