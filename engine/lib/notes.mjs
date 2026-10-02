// Notes, keeps and decisions: the durable side of a review conversation.
// - A note is anchored to the revision the person watched: the beat, the words around the
//   playhead, the recording's own time for them, an element if named. A later cut never
//   re-reads its timestamp; it follows beat lineage and looks for the quoted words, and says
//   `changed`, `stale` or `orphaned` when it cannot honestly find the same moment.
// - A keep ("keep the voice") pins part of the film; edits that would break it are refused.
// - A decision records who accepted, rejected or (in one-shot work) decided what, at which
//   revision. An agent's decision is never recorded as a person's acceptance.
import fs from 'node:fs';
import path from 'node:path';
import { wordKey } from './word-timing.mjs';
import { readEdits, spanFrames, slicePieces, loadSource, masterState, sliceProblem } from './recording.mjs';
import { protectedSource, currentSource, uncovered, revisionMaster } from './targets.mjs';
import { listRevisions, loadRevision, lineageOf, factsPrint } from './revisions.mjs';
import { checkId, nextId, readJSONFile, reviewPath, withLock, writeJSONAtomic } from './store.mjs';
import { parseTime, formatTime, anchorAt } from './anchor.mjs';
export { parseTime, formatTime, anchorAt };

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
export const KEEPS = ['voice', 'words', 'facts', 'picture', 'look'];
export const SCOPES = ['element', 'beat', 'range', 'chapter', 'film'];
const MAX_TEXT = 2000;

/**
 * A note copied from the review page, e.g.
 *   [ClearFrame r003 @ 2:13.40 · s047] the diagram is confusing
 * → {revision, at, beat, text}. Anything else → null.
 */
export function parseStamp(line) {
  const m = /^\s*\[ClearFrame (r\d{3,}) @ (\d+(?::\d{1,2}){0,2}(?:\.\d+)?)(?:–(\d+(?::\d{1,2}){0,2}(?:\.\d+)?))?(?: · ([a-z0-9][a-z0-9-_]*))?[^\]]*\]\s*([\s\S]*)$/i.exec(
    String(line),
  );
  if (!m) return null;
  return { revision: m[1], at: parseTime(m[2]), ...(m[3] ? { to: parseTime(m[3]) } : {}), ...(m[4] ? { beat: m[4] } : {}), text: m[5].trim() };
}

const keysOf = text =>
  String(text ?? '')
    .split(/\s+/)
    .map(wordKey)
    .filter(Boolean);
function findQuote(words, quote) {
  const q = keysOf(quote),
    keys = words.map(w => wordKey(w.w));
  const hits = [];
  if (!q.length) return hits;
  for (let i = 0; i + q.length <= keys.length; i++) if (q.every((k, j) => keys[i + j] === k)) hits.push(i);
  return hits;
}

/** Revisions after `from` up to and including `to`, oldest first (history is linear). */
function chain(root, from, to) {
  const all = listRevisions(root);
  const a = all.findIndex(r => r.id === from),
    b = to ? all.findIndex(r => r.id === to) : all.length - 1;
  if (a < 0) throw new Error(`No revision ${from}.`);
  return all.slice(a + 1, b + 1);
}

/**
 * Where a note's moment is in `target` ({id, timeline}; id null for the working copy):
 *   current  same beat, same content, same place
 *   moved    same content, now at a different time (or found by its recording time)
 *   changed  found, but the beat was edited since the note: it may already be addressed
 *   stale    the beat is there but the quoted words are not, or appear more than once
 *   orphaned the passage was cut or removed: nothing honestly corresponds to it any more
 *   addressed the passage was cut on this note's behalf (cut --note)
 */
export function locate(root, note, target) {
  const a = note.anchor;
  if (!a || note.scope === 'film') return { state: 'current', reason: 'film-wide note' };
  if (target.id === note.revision) return { state: 'current', beat: a.beat, at: a.at };
  // Follow beat ids through every revision since the note (splits, merges, removals).
  let ids = [...new Set(a.beats ?? [a.beat])];
  let removedBy = null;
  const gone = new Set();
  const steps = chain(root, note.revision, target.id);
  const apply = lineage => {
    if (!lineage) return;
    ids = ids.flatMap(id => {
      const r = lineage.removed?.[id];
      if (!r) return [id];
      if (r.into?.length) return r.into;
      removedBy ??= r.by ? `${r.by} (“${r.words}”)` : 'an edit';
      gone.add(id);
      return [];
    });
    for (const [id, m] of Object.entries(lineage.merged ?? {})) if (m.from.some(f => ids.includes(f))) ids.push(id);
    // A beat that comes back under its own id (an undone cut, a rejected candidate, a restore).
    for (const id of Object.keys(lineage.added ?? {}))
      if (gone.has(id)) {
        ids.push(id);
        gone.delete(id);
        if (!gone.size) removedBy = null;
      }
    ids = [...new Set(ids)];
  };
  for (const r of steps) apply(r.lineage);
  if (!target.id) {
    const last = steps.at(-1)?.id ?? note.revision;
    apply(lineageOf(loadRevision(root, last).timeline, target.timeline, readEdits(root)));
  }
  const beats = target.timeline.beats.filter(b => ids.includes(b.id));
  // The playhead's place now: the quote's new time plus where the playhead sat after it began.
  const place = (b, i) => ({ beat: b.id, at: round(i == null ? b.start + (a.beatTime ?? 0) : b.words[i].t0 + (a.quoteAt != null ? a.at - a.quoteAt : 0)) });
  if (!a.words) {
    if (!beats.length) return { state: 'orphaned', reason: `${a.beat} was removed${removedBy ? ` by ${removedBy}` : ''}` };
    const b = beats.find(x => x.id === a.beat) ?? beats[0];
    return { state: b.prints.authored === a.prints.authored ? (b.id === a.beat && Math.abs(b.start + (a.beatTime ?? 0) - a.at) < 1e-3 ? 'current' : 'moved') : 'changed', ...place(b) };
  }
  const hits = beats.flatMap(b => findQuote(b.words, a.words).map(i => [b, i]));
  if (hits.length === 1) {
    const [b, i] = hits[0];
    const same = b.prints.authored === a.prints.authored;
    // Where the beat started in the revision the person watched.
    const shifted = b.id !== a.beat || Math.abs(b.start - (a.at - (a.beatTime ?? 0))) > 1e-3;
    return {
      state: same ? (shifted ? 'moved' : 'current') : 'changed',
      ...place(b, i),
      ...(same ? {} : { reason: `${b.id} was edited since ${note.revision}; check whether the note still applies` }),
    };
  }
  if (hits.length > 1)
    return { state: 'stale', reason: `the quoted words occur ${hits.length} times (${hits.map(([b]) => b.id).join(', ')}); point at it again` };
  // The words left these beats. Were they cut? A cut removes recording time, so compare spans.
  if (a.source) {
    const span = Math.max(1e-3, a.source.to - a.source.from);
    const cuts = target.timeline.beats.flatMap(b =>
      (b.source?.removed ?? [])
        .map(r => ({ ...r, overlap: Math.max(0, Math.min(a.source.to, r.to) - Math.max(a.source.from, r.from)) }))
        .filter(r => r.overlap > 0),
    );
    if (cuts.length) {
      const named = [...new Set(cuts.map(c => `${c.id}${c.words ? ` “${c.words}”` : ''}`))].join(', ');
      // Cut on this note's behalf (cut --note): the note is addressed, not lost.
      if (cuts.every(c => c.note === note.id))
        return { state: 'addressed', ...(beats[0] ? { beat: beats[0].id, at: round(beats[0].start) } : {}), reason: `cut for this note (${named})` };
      return cuts.reduce((s, c) => s + c.overlap, 0) >= span * 0.9
        ? { state: 'orphaned', reason: `the quoted words were cut (${named})` }
        : { state: 'stale', ...(beats[0] ? { beat: beats[0].id } : {}), reason: `part of the quoted words was cut (${named}); point at the moment again` };
    }
  }
  if (a.source) {
    const elsewhere = target.timeline.beats.filter(
      b => b.source && b.source.segments.some(s => s.source[0] <= a.source.from + 1e-3 && s.source[1] >= a.source.to - 1e-3),
    );
    const found = elsewhere.flatMap(b => findQuote(b.words, a.words).map(i => [b, i]));
    if (found.length === 1) return { state: 'moved', ...place(...found[0]), reason: 'found by its time in the recording' };
  }
  if (!beats.length) {
    // A beat removed whole for this note: by its id, or (after splits and merges renamed it)
    // by the recording time it played.
    const played = p => {
      const src = p.meta?.source;
      if (!src || !a.source) return false;
      const fps = src.fps ?? 30,
        [f0, f1] = spanFrames(p.meta, fps);
      return f0 / fps < a.source.to && f1 / fps > a.source.from;
    };
    const own = readEdits(root).find(e => e.note === note.id && e.beats?.some(p => p.deleted && ((a.beats ?? [a.beat]).includes(p.beat) || played(p))));
    if (own) return { state: 'addressed', reason: `${a.beat} was cut for this note (${own.id})` };
    return { state: 'orphaned', reason: `${a.beat} is gone${removedBy ? ` (removed by ${removedBy})` : ''}` };
  }
  return { state: 'stale', reason: `“${a.words}” is no longer in ${beats.map(b => b.id).join(', ')}; the wording changed` };
}

// ------------------------------------------------------------------ notes

export const readNotes = root => readJSONFile(reviewPath(root, 'notes.json'), { version: 1, notes: [] }).notes;
const writeNotes = (root, notes) => writeJSONAtomic(reviewPath(root, 'notes.json'), { version: 1, notes });

function cleanText(text) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!t) throw new Error('A note needs text.');
  if (t.length > MAX_TEXT) throw new Error(`A note is limited to ${MAX_TEXT} characters.`);
  return t;
}
const author = (by, agent) => (agent ? { role: 'agent', ...(by ? { name: String(by).slice(0, 80) } : {}) } : { role: 'human', ...(by ? { name: String(by).slice(0, 80) } : {}) });

/**
 * Record a note against the revision the person watched. With `at` it is anchored to that
 * moment; with `beat` alone to the whole beat; with neither it is about the whole film.
 */
export function addNote(root, { text, revision, at, to, beat, element, keep = [], scope, kind, by, agent = false, via = 'cli' }) {
  text = cleanText(text);
  if (scope != null && !SCOPES.includes(scope)) throw new Error(`--scope must be ${SCOPES.join(', ')}`);
  for (const k of keep) if (!KEEPS.includes(k)) throw new Error(`keep must be ${KEEPS.join(', ')}`);
  if (beat != null) checkId('beat', beat);
  const revs = listRevisions(root);
  const rev = revision ? revs.find(r => r.id === checkId('revision', revision)) : [...revs].reverse().find(r => (r.videos ?? []).length) ?? revs.at(-1);
  if (!rev) throw new Error('No revision yet: render a draft (or run snapshot) so a note can say which cut it is about.');
  const { timeline } = loadRevision(root, rev.id);
  let anchor = null;
  if (at != null) anchor = anchorAt(timeline, at, { to, beat, element });
  else if (beat != null) {
    const b = timeline.beats.find(x => x.id === beat);
    if (!b) throw new Error(`No beat ${beat} in ${rev.id}.`);
    if (element != null && !b.elements.includes(element)) throw new Error(`${beat} has no element "${element}".`);
    anchor = { beat, beats: [beat], at: b.start, beatTime: 0, chapter: b.chapter, words: '', ...(element != null ? { element } : {}), prints: { authored: b.prints.authored, picture: b.prints.picture, words: b.prints.words, rendered: b.prints.rendered } };
  }
  scope ??= !anchor ? 'film' : to != null ? 'range' : element != null ? 'element' : 'beat';
  return withLock(root, () => {
    const notes = readNotes(root);
    const note = {
      id: nextId('n', notes.map(n => n.id)),
      createdAt: new Date().toISOString(),
      author: author(by, agent),
      via,
      revision: rev.id,
      text,
      scope,
      ...(kind ? { kind } : {}),
      anchor,
      keep,
      status: 'open',
      history: [{ status: 'open', at: new Date().toISOString(), revision: rev.id }],
    };
    if (scope === 'chapter' && anchor) {
      note.anchor.beats = timeline.beats.filter(b => b.chapter === anchor.chapter).map(b => b.id);
      if (anchor.chapter == null) throw new Error('This beat has no chapter; use --scope range with --to, or --scope beat.');
    }
    notes.push(note);
    writeNotes(root, notes);
    for (const what of keep)
      addKeep(root, { what, beats: note.anchor?.beats ?? null, revision: rev.id, by: note.author, said: text, note: note.id });
    return note;
  });
}

export function updateNote(root, id, change) {
  checkId('note', id);
  return withLock(root, () => {
    const notes = readNotes(root);
    const n = notes.find(x => x.id === id);
    if (!n) throw new Error(`No note ${id}.`);
    change(n);
    writeNotes(root, notes);
    return n;
  });
}
export function setNoteStatus(root, id, status, { revision, by, reason } = {}) {
  if (!['open', 'applied', 'accepted', 'dismissed', 'question'].includes(status)) throw new Error(`Unknown note status ${status}`);
  return updateNote(root, id, n => {
    n.status = status;
    if (status === 'applied') n.resolution = { revision, at: new Date().toISOString(), ...(reason ? { summary: reason } : {}) };
    n.history.push({ status, at: new Date().toISOString(), ...(revision ? { revision } : {}), ...(by ? { by } : {}), ...(reason ? { reason } : {}) });
  });
}

/** Notes exported by the review page (or written by hand): {notes: [{revision, at, to?, beat?, text}]}. */
export function importNotes(root, data, { by, via = 'page' } = {}) {
  const list = Array.isArray(data) ? data : data?.notes;
  if (!Array.isArray(list)) throw new Error('Expected {"notes": [...]} from the review page.');
  if (list.length > 500) throw new Error('Too many notes in one file.');
  return list.map(n => {
    if (!n || typeof n !== 'object') throw new Error('Each note must be an object.');
    const at = n.at == null ? undefined : typeof n.at === 'number' ? n.at : parseTime(n.at);
    const to = n.to == null ? undefined : typeof n.to === 'number' ? n.to : parseTime(n.to);
    const keep = Array.isArray(n.keep) ? n.keep.map(String) : [];
    return addNote(root, { text: n.text, revision: n.revision, at, to, beat: n.beat ?? undefined, element: n.element ?? undefined, keep, scope: n.scope ?? undefined, by: n.by ?? by, via });
  });
}

// ------------------------------------------------------------------ keeps

export const readKeeps = root => readJSONFile(reviewPath(root, 'keeps.json'), { version: 1, keeps: [] }).keeps;
const writeKeeps = (root, keeps) => writeJSONAtomic(reviewPath(root, 'keeps.json'), { version: 1, keeps });

/** What a keep holds still, read from the revision it was made against. */
function baselineOf(timeline, what, beats) {
  if (what === 'look') return { look: timeline.film.look };
  const out = {};
  for (const b of timeline.beats.filter(x => !beats || beats.includes(x.id)))
    out[b.id] = {
      voice: b.prints.voice,
      audio: b.prints.audio,
      words: keysOf(b.vo?.text ?? '').join(' '),
      facts: b.prints.facts,
      picture: b.prints.picture,
      removals: (b.source?.removed ?? []).map(r => r.id),
    };
  return out;
}

export function addKeep(root, { what, beats, film, revision, by, said, note }) {
  if (!KEEPS.includes(what)) throw new Error(`keep must be ${KEEPS.join(', ')}`);
  if (!by?.role) throw new Error('A keep records who asked for it.');
  const rev = revision ?? listRevisions(root).at(-1)?.id;
  if (!rev) throw new Error('No revision yet: render a draft or run snapshot first.');
  const { timeline } = loadRevision(root, rev);
  const scopeBeats = what === 'look' || film ? null : beats;
  if (scopeBeats) for (const id of scopeBeats) if (!timeline.beats.some(b => b.id === id)) throw new Error(`No beat ${id} in ${rev}.`);
  return withLock(root, () => {
    const keeps = readKeeps(root);
    const keep = {
      id: nextId('k', keeps.map(k => k.id)),
      what,
      scope: scopeBeats ? { beats: scopeBeats } : { film: true },
      revision: rev,
      by,
      ...(said ? { said: String(said).slice(0, 500) } : {}),
      ...(note ? { note } : {}),
      createdAt: new Date().toISOString(),
      active: true,
      baseline: baselineOf(timeline, what, scopeBeats),
    };
    keeps.push(keep);
    writeKeeps(root, keeps);
    return keep;
  });
}
export function releaseKeep(root, id, { by, said }) {
  checkId('keep', id);
  if (by?.role !== 'human') throw new Error('Only the person who can ask for a keep can release it: pass --by NAME.');
  return withLock(root, () => {
    const keeps = readKeeps(root);
    const k = keeps.find(x => x.id === id);
    if (!k) throw new Error(`No keep ${id}.`);
    Object.assign(k, { active: false, releasedAt: new Date().toISOString(), releasedBy: by, ...(said ? { releaseSaid: said } : {}) });
    writeKeeps(root, keeps);
    return k;
  });
}

/**
 * Source sample ranges the person had removed: removals made by cuts the edit log shows they
 * asked for (a removal record's own `by` is not taken on trust), and the beats they cut whole.
 */
function personRemoved(root, now, edits) {
  const theirs = new Set(edits.filter(e => ['cut', 'pauses'].includes(e.op) && e.by?.role === 'human').map(e => e.id));
  const spans = now.removals.filter(r => theirs.has(r.id)).map(r => r.samples);
  for (const e of edits)
    if (['cut', 'pauses'].includes(e.op) && e.by?.role === 'human')
      for (const p of e.beats ?? [])
        if (p.deleted && p.meta?.source && now.transcript)
          for (const x of slicePieces(p.meta, { rate: now.transcript.rate, fps: p.meta.source.fps ?? 30 })) if (x.pad == null) spans.push([x.from, x.to]);
  return spans;
}

/** The master as it is now, read once: its state and its samples (to check slices against). */
function recordingNow(root) {
  if (!fs.existsSync(path.join(root, 'source', 'recording.wav'))) return masterState(root);
  let src;
  try {
    src = loadSource(root);
  } catch (e) {
    return { sha: null, problem: `source/recording.wav cannot be read (${e.message})` };
  }
  return { ...masterState(root, src.sha), src };
}

/**
 * Keeps broken by going from the keep's revision to `timeline` (a candidate or the working
 * copy). For beats of an imported recording, `voice` and `words` are judged by what the keep's
 * revision played (transcript words and recording spans), whatever those beats are called now
 * after splits or merges: `words` breaks when any protected word no longer plays; `voice` when
 * any protected recording no longer plays, unless the person had it cut, and when the audio
 * itself is not that recording: the master must be the file the keep's revision played (and
 * match its record), and every beat playing protected recording must hold exactly the samples
 * its metadata declares from it. Other keeps, and narration that is not a recording, follow
 * the beats through lineage.
 */
export function checkKeeps(root, timeline, { overrides = [] } = {}) {
  const violations = [];
  const edits = readEdits(root);
  const humanCut = id => {
    const e = edits.find(x => x.id === id);
    return e?.by?.role === 'human';
  };
  let now = null,
    master = null,
    byPerson = null;
  const audited = new Map();
  for (const k of readKeeps(root).filter(k => k.active && !overrides.includes(k.id))) {
    // Facts are re-read from the keep's own revision with today's rule, so a keep made under an
    // older fingerprint scheme is still judged on what the beat showed.
    const sbK = k.what === 'facts' ? readJSONFile(reviewPath(root, 'revisions', k.revision, 'storyboard.json'), null) : null;
    if (k.what === 'look') {
      if (k.baseline.look !== timeline.film.look) violations.push({ keep: k.id, what: 'look', message: 'the film look changed (palette, motion, captions, framing or format)' });
      continue;
    }
    const prot = ['voice', 'words'].includes(k.what) ? protectedSource(root, k.revision, k.scope.film ? null : k.scope.beats) : {};
    if (Object.keys(prot).length && k.what === 'words') {
      now ??= currentSource(root);
      for (const [id, p] of Object.entries(prot)) {
        const gone = p.words.filter(i => !now.words.has(i));
        if (gone.length)
          violations.push({ keep: k.id, what: 'words', beat: id, message: `words of ${id} no longer play (“${gone.slice(0, 8).map(i => now.transcript.words[i].w).join(' ')}”)` });
      }
    } else if (Object.keys(prot).length) {
      // The recording itself first: slices can only be checked against the right master.
      master ??= recordingNow(root);
      const played = revisionMaster(root, k.revision);
      const wrong = master.problem ?? (played && played !== master.sha ? `source/recording.wav is not the recording ${k.revision} played: it was replaced` : null);
      if (wrong) {
        violations.push({ keep: k.id, what: 'voice', message: `${wrong} (${Object.keys(prot).join(', ')})` });
      } else {
        now ??= currentSource(root);
        byPerson ??= personRemoved(root, now, edits);
        for (const [id, p] of Object.entries(prot)) {
          const missing = p.spans.flatMap(span => uncovered(span, now.spans));
          const unexplained = missing.flatMap(span => uncovered(span, byPerson));
          if (unexplained.length)
            violations.push({ keep: k.id, what: 'voice', beat: id, message: `${id} no longer plays all of its recording: cut without the person asking, or replaced` });
          // What plays it now (the beat, its parts, or the beat it merged into) must be the recording.
          for (const x of now.beats.filter(x => x.spans.some(([a, b]) => p.spans.some(([c, d]) => a < d && b > c)))) {
            if (!audited.has(x.id)) audited.set(x.id, sliceProblem(root, x.id, x.meta, master.src, now.fps));
            const why = audited.get(x.id);
            if (why) violations.push({ keep: k.id, what: 'voice', beat: id, message: `${x.id === id ? id : `${x.id} (playing ${id}'s recording)`} does not play the recording: ${why}` });
          }
        }
      }
    }
    const target = { id: null, timeline };
    for (const [id, base] of Object.entries(k.baseline)) {
      if (prot[id]) continue; // judged by its recording above
      // Follow the beat through splits and merges since the keep was made.
      const where = locate(root, { revision: k.revision, scope: 'beat', anchor: { beat: id, beats: [id], words: '', at: 0, beatTime: 0, prints: {} } }, target);
      const now = timeline.beats.filter(b => b.id === where.beat || (b.was ?? []).includes(id));
      const say = m => violations.push({ keep: k.id, what: k.what, beat: id, message: m });
      if (!now.length) {
        const cut = edits.find(e => e.op === 'cut' && e.beats?.some(p => p.beat === id && p.deleted));
        if (k.what === 'voice' && cut && humanCut(cut.id)) continue;
        say(`${id} was removed${cut ? ` by ${cut.id}` : ''}`);
        continue;
      }
      if (k.what === 'words') {
        const text = now.map(b => keysOf(b.vo?.text ?? '').join(' ')).join(' ');
        if (text !== base.words) say(`the words of ${id} changed`);
      } else if (k.what === 'facts' || k.what === 'picture') {
        const beatK = sbK?.beats?.find(b => b.id === id);
        const want = k.what === 'facts' && beatK ? factsPrint(beatK, sbK.sources ?? []) : base[k.what];
        if (now.some(b => b.prints[k.what] !== want))
          say(`the ${k.what === 'facts' ? 'facts shown (figures, labels, units, wording or attribution)' : 'picture'} of ${id} changed`);
      } else if (k.what === 'voice') {
        // Narration that is not an imported recording: its take, and the audio cut from it.
        if (now.some(b => b.prints.voice !== base.voice)) say(`${id} no longer plays the same take`);
        else if (now.some(b => b.prints.audio !== base.audio)) say(`the audio of ${id} changed`);
      }
    }
  }
  return violations;
}

/**
 * Keeps a planned cut would break, before anything is cut. `plans` are dry-run reports (each
 * beat entry lists the transcript words it removes and, for a whole beat, the recording it
 * played). `words` breaks on any protected word; `voice` on any protected recording when the
 * agent decided the cut (a person's own cut keeps the voice). An override counts only when it
 * was passed and the person recorded it.
 */
export function keepConflicts(root, plans, { by, overrides = [] } = {}) {
  const words = new Set(),
    spans = [];
  for (const plan of plans)
    for (const p of plan.beats ?? []) {
      for (const i of p.indices ?? []) words.add(i);
      if (p.removal) spans.push(p.removal.samples);
      for (const s of p.pieces ?? []) spans.push(s);
    }
  const granted = new Set(readDecisions(root).filter(d => d.action === 'override' && d.role === 'human').map(d => d.scope?.keep));
  const out = [];
  for (const k of readKeeps(root).filter(k => k.active && ['voice', 'words'].includes(k.what))) {
    if (overrides.includes(k.id) && granted.has(k.id)) continue;
    if (k.what === 'voice' && by?.role === 'human') continue;
    const prot = protectedSource(root, k.revision, k.scope.film ? null : k.scope.beats);
    const hit = Object.entries(prot)
      .filter(([, p]) => p.words.some(i => words.has(i)) || (k.what === 'voice' && p.spans.some(([c, d]) => spans.some(([a, b]) => a < d && b > c))))
      .map(([id]) => id);
    if (hit.length) out.push({ keep: k, beats: hit });
  }
  return out;
}

// ------------------------------------------------------------------ decisions

export function readDecisions(root) {
  const file = reviewPath(root, 'decisions.jsonl');
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];
}

/**
 * accept/reject: a person's verdict on a revision (or one note's result, or some beats), with
 * their name and their words. decide: an agent's call in one-shot work, labelled as such.
 */
export function addDecision(root, { action, role, by, said, reason, revision, scope = {} }) {
  if (!['accept', 'reject', 'decide', 'override', 'restore'].includes(action)) throw new Error(`Unknown decision ${action}`);
  checkId('revision', revision);
  if (['accept', 'reject', 'override'].includes(action)) {
    if (role !== 'human') throw new Error(`${action} records a person's decision: pass --by NAME and --said "their words". Agents use decide.`);
    if (!by || !String(said ?? '').trim())
      throw new Error(`${action} needs --by NAME and --said "what they said", so the decision is attributable.`);
  }
  if (action === 'decide' && role !== 'agent') throw new Error('decide records an agent decision.');
  const { meta, timeline } = loadRevision(root, revision);
  const beats = scope.beats ?? (scope.note ? (readNotes(root).find(n => n.id === scope.note)?.anchor?.beats ?? null) : null);
  if (scope.note) checkId('note', scope.note);
  const prints = Object.fromEntries(
    timeline.beats.filter(b => !beats || beats.includes(b.id)).map(b => [b.id, { authored: b.prints.authored, rendered: b.prints.rendered, start: b.start }]),
  );
  return withLock(root, () => {
    const list = readDecisions(root);
    const d = {
      id: nextId('d', list.map(x => x.id)),
      at: new Date().toISOString(),
      action,
      role,
      ...(by ? { by: String(by).slice(0, 80) } : {}),
      ...(said ? { said: String(said).slice(0, 1000) } : {}),
      ...(reason ? { reason: String(reason).slice(0, 1000) } : {}),
      revision,
      contentId: meta.contentId,
      // What was on screen when the decision was made: the revision's kept encodes.
      videos: (meta.videos ?? []).filter(v => v.retained !== false).map(v => ({ profile: v.profile, sha256: v.sha256 })),
      scope: { ...scope, ...(beats ? { beats } : {}) },
      film: timeline.film.look,
      prints,
    };
    const file = reviewPath(root, 'decisions.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(d) + '\n');
    return d;
  });
}

/**
 * Does a person's acceptance still hold for each beat of `timeline`? accepted (same content,
 * same place), moved (same content, new time: it stands), looks-different (a neighbour or the
 * film changed how it renders: quick look), changed (its own content changed: review again).
 */
export function acceptance(root, timeline) {
  const out = {};
  const verdicts = readDecisions(root).filter(d => ['accept', 'reject'].includes(d.action) && d.role === 'human');
  for (const b of timeline.beats) {
    const d = [...verdicts].reverse().find(x => x.action === 'accept' && x.prints?.[b.id]);
    if (!d) continue;
    // Rejecting the same revision afterwards takes the acceptance back for the beats it covered.
    if (verdicts.some(x => x.action === 'reject' && x.revision === d.revision && x.prints?.[b.id] && Date.parse(x.at) >= Date.parse(d.at))) continue;
    const p = d.prints[b.id];
    out[b.id] = {
      decision: d.id,
      revision: d.revision,
      by: d.by,
      state:
        p.authored !== b.prints.authored ? 'changed' : p.rendered !== b.prints.rendered ? 'looks-different' : Math.abs(p.start - b.start) > 1e-3 ? 'moved' : 'accepted',
    };
  }
  return out;
}
