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
import { readEdits } from './recording.mjs';
import { listRevisions, loadRevision, lineageOf } from './revisions.mjs';
import { checkId, nextId, readJSONFile, reviewPath, withLock, writeJSONAtomic } from './store.mjs';

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
export const KEEPS = ['voice', 'words', 'facts', 'picture', 'look'];
export const SCOPES = ['element', 'beat', 'range', 'chapter', 'film'];
const MAX_TEXT = 2000;

// ------------------------------------------------------------------ time

/** 133.4, 2:13, 2:13.4 or 1:02:13.5 → seconds. */
export function parseTime(value) {
  const s = String(value).trim();
  if (!/^(?:\d+(?::\d{1,2}){0,2}(?:\.\d*)?|\.\d+)$/.test(s)) throw new Error(`Not a time: ${JSON.stringify(value)} (use 133.4 or 2:13.4)`);
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
export function formatTime(t) {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

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

// ------------------------------------------------------------------ anchors

const sourceAt = (beat, t) => {
  const s = beat.source?.segments?.find(x => t >= x.film[0] - 1e-6 && t <= x.film[1] + 1e-6);
  return s ? round(s.source[0] + (t - s.film[0]), 3) : null;
};

/**
 * Where time `at` falls on a revision's timeline: the beat showing at that frame, the words
 * spoken around it, their time in the source recording, and any cut close enough that the
 * person may have meant the neighbouring beat (reported, never guessed).
 */
export function anchorAt(timeline, at, { to, beat: forced, element } = {}) {
  if (!(Number.isFinite(at) && at >= 0 && at < timeline.duration + 1e-6))
    throw new Error(`${formatTime(at)} is outside this revision (${formatTime(timeline.duration)} long).`);
  if (to != null && !(to > at)) throw new Error('A range must end after it starts.');
  const frame = Math.min(timeline.frames - 1, Math.floor(at * timeline.fps + 1e-6));
  let beat = timeline.beats.find(b => frame >= b.startFrame && frame < b.startFrame + b.frames);
  const near = [];
  for (const b of timeline.beats) {
    if (b === beat) continue;
    const edge = Math.min(Math.abs(at - b.end), Math.abs(at - b.start));
    if (edge <= 0.3) near.push({ beat: b.id, seconds: round(edge) });
  }
  if (forced) {
    const f = timeline.beats.find(b => b.id === forced);
    if (!f) throw new Error(`No beat ${forced} in this revision.`);
    if (f !== beat && !near.some(n => n.beat === forced))
      throw new Error(`${forced} is not on screen at ${formatTime(at)} in this revision (that is ${beat.id}).`);
    beat = f;
  }
  const words = beat.words ?? [];
  let k = words.findIndex(w => at >= w.t0 && at < w.t1);
  if (k < 0) k = words.findIndex(w => w.t0 >= at);
  if (k < 0) k = words.length - 1;
  const i0 = Math.max(0, k - 2),
    i1 = Math.min(words.length - 1, k + 2);
  if (element != null && !beat.elements.includes(element))
    throw new Error(`${beat.id} has no element "${element}" (it has: ${beat.elements.join(', ') || 'none named'}).`);
  const beats = to != null ? timeline.beats.filter(b => b.start < to && b.end > at).map(b => b.id) : [beat.id];
  let quote = words.length ? words.slice(i0, i1 + 1) : [];
  // A range quotes what its first beat says inside it: a quote is always found within one beat.
  if (to != null) quote = words.filter(w => w.t1 > at && w.t0 < to).slice(0, 12);
  const src = quote.length && beat.source ? [sourceAt(beat, quote[0].t0), sourceAt(beat, quote.at(-1).t1)] : null;
  return {
    beat: beat.id,
    beats,
    at: round(at),
    ...(to != null ? { to: round(to) } : {}),
    beatTime: round(at - beat.start),
    chapter: beat.chapter ?? null,
    words: quote.map(w => w.w).join(' '),
    ...(quote.length ? { quoteAt: round(quote[0].t0) } : {}),
    ...(src && src[0] != null && src[1] != null
      ? { source: { file: beat.source.file, from: src[0], to: src[1], original: [round(src[0] + beat.source.offset), round(src[1] + beat.source.offset)] } }
      : {}),
    ...(element != null ? { element } : {}),
    ...(near.length ? { near } : {}),
    prints: { authored: beat.prints.authored, picture: beat.prints.picture, words: beat.prints.words, rendered: beat.prints.rendered },
  };
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
    const own = readEdits(root).find(e => e.note === note.id && e.beats?.some(p => p.deleted && (a.beats ?? [a.beat]).includes(p.beat)));
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
 * Keeps broken by going from the keep's revision to `timeline` (a candidate or the working
 * copy). `voice` allows cuts the person asked for (recorded with role human); `words` does not.
 */
export function checkKeeps(root, timeline, { overrides = [] } = {}) {
  const violations = [];
  const edits = readEdits(root);
  const humanCut = id => {
    const e = edits.find(x => x.id === id);
    return e?.by?.role === 'human';
  };
  for (const k of readKeeps(root).filter(k => k.active && !overrides.includes(k.id))) {
    if (k.what === 'look') {
      if (k.baseline.look !== timeline.film.look) violations.push({ keep: k.id, what: 'look', message: 'the film look changed (palette, motion, captions, framing or format)' });
      continue;
    }
    const target = { id: null, timeline };
    for (const [id, base] of Object.entries(k.baseline)) {
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
        if (now.some(b => b.prints[k.what] !== base[k.what])) say(`the ${k.what === 'facts' ? 'figures or attribution' : 'picture'} of ${id} changed`);
      } else if (k.what === 'voice') {
        if (now.some(b => b.prints.voice !== base.voice)) {
          say(`${id} no longer plays the same recording or take`);
          continue;
        }
        if (now.length === 1 && now[0].id === id && now[0].prints.audio !== base.audio) {
          const added = (now[0].source?.removed ?? []).map(r => r.id).filter(r => !base.removals.includes(r));
          const undone = base.removals.filter(r => !(now[0].source?.removed ?? []).some(x => x.id === r));
          if (!added.length && !undone.length) say(`the audio of ${id} changed`);
          else if (added.some(r => !humanCut(r))) say(`${id} was cut without the person asking (${added.filter(r => !humanCut(r)).join(', ')})`);
        }
      }
    }
  }
  return violations;
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
  const accepts = readDecisions(root).filter(d => d.action === 'accept' && d.role === 'human');
  for (const b of timeline.beats) {
    const d = [...accepts].reverse().find(x => x.prints?.[b.id]);
    if (!d) continue;
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
