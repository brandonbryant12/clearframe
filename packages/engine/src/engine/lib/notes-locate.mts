// Where a note's moment is now: followed through beat lineage and found by its quoted words,
// never by re-reading its timestamp.
import { wordKey } from './word-timing.mjs';
import { editParts, readEdits, type EditPart } from './recording-model.mjs';
import { spanFrames } from './recording-slices.mjs';
import {
  listRevisions,
  loadRevision,
  lineageOf,
  type Lineage,
  type RevisionMeta,
  type Timeline,
  type TimelineBeat,
} from './revisions.mjs';

import type { Note, NoteAnchor } from './notes-model.mjs';
import type { Word } from '../domain.mjs';

const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

export type NoteState =
  | 'current'
  | 'moved'
  | 'changed'
  | 'stale'
  | 'orphaned'
  | 'addressed';
export interface Located {
  state: NoteState;
  beat?: string;
  at?: number;
  reason?: string;
}
/** A revision (`id`) or the working copy (`id` null) and its timeline. */
export interface LocateTarget {
  id: string | null;
  timeline: Timeline;
}
export type LocatableNote = Pick<Note, 'revision' | 'scope' | 'anchor'> & {
  id?: string;
};

export const keysOf = (text: unknown): string[] =>
  String(text ?? '')
    .split(/\s+/)
    .map(wordKey)
    .filter(Boolean);
function findQuote(words: Word[], quote: unknown): number[] {
  const q = keysOf(quote),
    keys = words.map((w) => wordKey(w.w));
  const hits: number[] = [];
  if (!q.length) return hits;
  for (let i = 0; i + q.length <= keys.length; i++)
    if (q.every((k, j) => keys[i + j] === k)) hits.push(i);
  return hits;
}

/** Revisions after `from` up to and including `to`, oldest first (history is linear). */
function chain(root: string, from: string, to: string | null): RevisionMeta[] {
  const all = listRevisions(root);
  const a = all.findIndex((r) => r.id === from),
    b = to ? all.findIndex((r) => r.id === to) : all.length - 1;
  if (a < 0) throw new Error(`No revision ${from}.`);
  return all.slice(a + 1, b + 1);
}

/** Beat ids followed through splits, merges and removals, and what removed them. */
class BeatTrail {
  ids: string[];
  removedBy: string | null = null;
  private readonly gone = new Set<string>();

  constructor(ids: string[]) {
    this.ids = [...new Set(ids)];
  }

  apply(lineage: Lineage | null | undefined): void {
    if (!lineage) return;
    this.ids = this.ids.flatMap((id) => this.follow(lineage, id));
    for (const [id, m] of Object.entries(lineage.merged ?? {}))
      if (m.from.some((f) => this.ids.includes(f))) this.ids.push(id);
    // A beat that comes back under its own id (an undone cut, a rejected candidate, a restore).
    for (const id of Object.keys(lineage.added ?? {})) {
      if (!this.gone.has(id)) continue;
      this.ids.push(id);
      this.gone.delete(id);
      if (!this.gone.size) this.removedBy = null;
    }
    this.ids = [...new Set(this.ids)];
  }

  private follow(lineage: Lineage, id: string): string[] {
    const r = lineage.removed?.[id];
    if (!r) return [id];
    if (r.into?.length) return r.into;
    this.removedBy ??= r.by ? `${r.by} (“${r.words}”)` : 'an edit';
    this.gone.add(id);
    return [];
  }
}

interface Search {
  root: string;
  note: LocatableNote;
  a: NoteAnchor;
  target: LocateTarget;
  beats: TimelineBeat[];
  removedBy: string | null;
}

// The playhead's place now: the quote's new time plus where the playhead sat after it began.
function place(
  a: NoteAnchor,
  b: TimelineBeat,
  i?: number,
): { beat: string; at: number } {
  if (i == null) return { beat: b.id, at: round(b.start + (a.beatTime ?? 0)) };
  const offset = a.quoteAt != null ? a.at - a.quoteAt : 0;
  return { beat: b.id, at: round(b.words[i].t0 + offset) };
}

function withoutWords(s: Search): Located {
  const { a, beats } = s;
  if (!beats.length)
    return {
      state: 'orphaned',
      reason: `${a.beat} was removed${s.removedBy ? ` by ${s.removedBy}` : ''}`,
    };
  const b = beats.find((x) => x.id === a.beat) ?? beats[0];
  if (b.prints.authored !== a.prints.authored)
    return { state: 'changed', ...place(a, b) };
  const current =
    b.id === a.beat && Math.abs(b.start + (a.beatTime ?? 0) - a.at) < 1e-3;
  return { state: current ? 'current' : 'moved', ...place(a, b) };
}

function foundOnce(s: Search, b: TimelineBeat, i: number): Located {
  const { a, note } = s;
  const same = b.prints.authored === a.prints.authored;
  // Where the beat started in the revision the person watched.
  const shifted =
    b.id !== a.beat || Math.abs(b.start - (a.at - (a.beatTime ?? 0))) > 1e-3;
  if (!same)
    return {
      state: 'changed',
      ...place(a, b, i),
      reason: `${b.id} was edited since ${note.revision}; check whether the note still applies`,
    };
  return { state: shifted ? 'moved' : 'current', ...place(a, b, i) };
}

// The words left these beats. Were they cut? A cut removes recording time, so compare spans.
function byCut(
  s: Search,
  source: NonNullable<NoteAnchor['source']>,
): Located | null {
  const { note, beats } = s;
  const span = Math.max(1e-3, source.to - source.from);
  const cuts = s.target.timeline.beats.flatMap((b) =>
    (b.source?.removed ?? [])
      .map((r) => ({
        ...r,
        overlap: Math.max(
          0,
          Math.min(source.to, r.to) - Math.max(source.from, r.from),
        ),
      }))
      .filter((r) => r.overlap > 0),
  );
  if (!cuts.length) return null;
  const named = [
    ...new Set(cuts.map((c) => `${c.id}${c.words ? ` “${c.words}”` : ''}`)),
  ].join(', ');
  // Cut on this note's behalf (cut --note): the note is addressed, not lost.
  if (cuts.every((c) => c.note === note.id))
    return {
      state: 'addressed',
      ...(beats[0] ? { beat: beats[0].id, at: round(beats[0].start) } : {}),
      reason: `cut for this note (${named})`,
    };
  if (cuts.reduce((n, c) => n + c.overlap, 0) >= span * 0.9)
    return {
      state: 'orphaned',
      reason: `the quoted words were cut (${named})`,
    };
  return {
    state: 'stale',
    ...(beats[0] ? { beat: beats[0].id } : {}),
    reason: `part of the quoted words was cut (${named}); point at the moment again`,
  };
}

function byRecordingTime(
  s: Search,
  source: NonNullable<NoteAnchor['source']>,
): Located | null {
  const elsewhere = s.target.timeline.beats.filter(
    (b) =>
      b.source &&
      b.source.segments.some(
        (seg) =>
          seg.source[0] <= source.from + 1e-3 &&
          seg.source[1] >= source.to - 1e-3,
      ),
  );
  const found = elsewhere.flatMap((b) =>
    findQuote(b.words, s.a.words).map((i): [TimelineBeat, number] => [b, i]),
  );
  return found.length === 1
    ? {
        state: 'moved',
        ...place(s.a, ...found[0]),
        reason: 'found by its time in the recording',
      }
    : null;
}

// A beat removed whole for this note: by its id, or (after splits and merges renamed it)
// by the recording time it played.
function whenGone(s: Search): Located {
  const { a, note } = s;
  const played = (p: EditPart): boolean => {
    const src = p.meta?.source;
    if (!src || !a.source) return false;
    const fps = src.fps ?? 30,
      [f0, f1] = spanFrames({ source: src }, fps);
    return f0 / fps < a.source.to && f1 / fps > a.source.from;
  };
  const own = readEdits(s.root).find(
    (e) =>
      e.note === note.id &&
      editParts(e).some(
        (p) =>
          p.deleted && ((a.beats ?? [a.beat]).includes(p.beat) || played(p)),
      ),
  );
  if (own)
    return {
      state: 'addressed',
      reason: `${a.beat} was cut for this note (${own.id})`,
    };
  return {
    state: 'orphaned',
    reason: `${a.beat} is gone${s.removedBy ? ` (removed by ${s.removedBy})` : ''}`,
  };
}

function byWords(s: Search): Located {
  const { a, beats } = s;
  const hits = beats.flatMap((b) =>
    findQuote(b.words, a.words).map((i): [TimelineBeat, number] => [b, i]),
  );
  if (hits.length === 1) return foundOnce(s, ...hits[0]);
  if (hits.length > 1)
    return {
      state: 'stale',
      reason: `the quoted words occur ${hits.length} times (${hits.map(([b]) => b.id).join(', ')}); point at it again`,
    };
  const viaSource = a.source
    ? (byCut(s, a.source) ?? byRecordingTime(s, a.source))
    : null;
  if (viaSource) return viaSource;
  if (!beats.length) return whenGone(s);
  return {
    state: 'stale',
    reason: `“${a.words}” is no longer in ${beats.map((b) => b.id).join(', ')}; the wording changed`,
  };
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
export function locate(
  root: string,
  note: LocatableNote,
  target: LocateTarget,
): Located {
  const a = note.anchor;
  if (!a || note.scope === 'film')
    return { state: 'current', reason: 'film-wide note' };
  if (target.id === note.revision)
    return { state: 'current', beat: a.beat, at: a.at };
  // Follow beat ids through every revision since the note (splits, merges, removals).
  const trail = new BeatTrail(a.beats ?? (a.beat ? [a.beat] : []));
  const steps = chain(root, note.revision, target.id);
  for (const r of steps) trail.apply(r.lineage);
  if (!target.id) {
    const last = steps.at(-1)?.id ?? note.revision;
    trail.apply(
      lineageOf(
        loadRevision(root, last).timeline,
        target.timeline,
        readEdits(root),
      ),
    );
  }
  const beats = target.timeline.beats.filter((b) => trail.ids.includes(b.id));
  const search: Search = {
    root,
    note,
    a,
    target,
    beats,
    removedBy: trail.removedBy,
  };
  return a.words ? byWords(search) : withoutWords(search);
}
