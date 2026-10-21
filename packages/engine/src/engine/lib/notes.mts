// Notes, keeps and decisions: the durable side of a review conversation.
// - A note is anchored to the revision the person watched: the beat, the words around the
//   playhead, the recording's own time for them, an element if named. A later cut never
//   re-reads its timestamp; it follows beat lineage and looks for the quoted words, and says
//   `changed`, `stale` or `orphaned` when it cannot honestly find the same moment.
// - A keep ("keep the voice") pins part of the film; edits that would break it are refused.
// - A decision records who accepted, rejected or (in one-shot work) decided what, at which
//   revision. An agent's decision is never recorded as a person's acceptance.

import { listRevisions, loadRevision, type Timeline } from './revisions.mjs';
import { checkId, nextId, withLock } from './store.mjs';
import { isRecord } from './errors.mjs';
import { parseTime, formatTime, anchorAt } from './anchor.mjs';
import {
  KEEPS,
  NOTE_STATUSES,
  SCOPES,
  readNotes,
  writeNotes,
  type Author,
  type Note,
  type NoteAnchor,
} from './notes-model.mjs';
import { addKeep } from './notes-keeps.mjs';

export { parseTime, formatTime, anchorAt };
export {
  KEEPS,
  SCOPES,
  readNotes,
  readKeeps,
  readDecisions,
} from './notes-model.mjs';
export type {
  Author,
  BeatBaseline,
  Decision,
  Keep,
  Note,
  NoteAnchor,
  NoteEvent,
} from './notes-model.mjs';
export { locate } from './notes-locate.mjs';
export type { Located, LocateTarget, NoteState } from './notes-locate.mjs';
export {
  addKeep,
  releaseKeep,
  checkKeeps,
  keepConflicts,
} from './notes-keeps.mjs';
export type {
  KeepConflict,
  KeepRequest,
  KeepViolation,
} from './notes-keeps.mjs';

const MAX_TEXT = 2000;

export interface Stamp {
  revision: string;
  at: number;
  to?: number;
  beat?: string;
  text: string;
}

/**
 * A note copied from the review page, e.g.
 *   [ClearFrame r003 @ 2:13.40 · s047] the diagram is confusing
 * → {revision, at, beat, text}. Anything else → null.
 */
export function parseStamp(line: unknown): Stamp | null {
  const m = /^\s*\[ClearFrame (r\d{3,}) @ ([^\]]*)\]\s*([\s\S]*)$/i.exec(
    String(line),
  );
  if (!m) return null;
  const span = /^([\d:.]+)(?:–([\d:.]+))?/.exec(m[2]);
  if (!span) return null;
  const validTime = /^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/;
  if (!validTime.test(span[1]) || (span[2] && !validTime.test(span[2])))
    return null;
  const beat = /^ · ([a-z0-9][a-z0-9-_]*)/i.exec(
    m[2].slice(span[0].length),
  )?.[1];
  return {
    revision: m[1],
    at: parseTime(span[1]),
    ...(span[2] ? { to: parseTime(span[2]) } : {}),
    ...(beat ? { beat } : {}),
    text: m[3].trim(),
  };
}

function cleanText(text: unknown): string {
  const t = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!t) throw new Error('A note needs text.');
  if (t.length > MAX_TEXT)
    throw new Error(`A note is limited to ${MAX_TEXT} characters.`);
  return t;
}
const author = (by: unknown, agent: boolean): Author => ({
  role: agent ? 'agent' : 'human',
  ...(by ? { name: String(by).slice(0, 80) } : {}),
});

export interface NoteRequest {
  text: unknown;
  revision?: string;
  at?: number;
  to?: number;
  beat?: string;
  element?: string;
  keep?: string[];
  scope?: string;
  kind?: string;
  by?: unknown;
  agent?: boolean;
  via?: string;
}

function beatAnchor(
  timeline: Timeline,
  rev: string,
  beat: string,
  element: string | undefined,
): NoteAnchor {
  const b = timeline.beats.find((x) => x.id === beat);
  if (!b) throw new Error(`No beat ${beat} in ${rev}.`);
  if (element != null && !b.elements.includes(element))
    throw new Error(`${beat} has no element "${element}".`);
  return {
    beat,
    beats: [beat],
    at: b.start,
    beatTime: 0,
    chapter: b.chapter,
    words: '',
    ...(element != null ? { element } : {}),
    prints: {
      authored: b.prints.authored,
      picture: b.prints.picture,
      words: b.prints.words,
      rendered: b.prints.rendered,
    },
  };
}

function noteScope(
  scope: string | undefined,
  anchor: NoteAnchor | null,
  to: number | undefined,
  element: string | undefined,
): string {
  if (scope != null) return scope;
  if (!anchor) return 'film';
  if (to != null) return 'range';
  return element != null ? 'element' : 'beat';
}

/**
 * Record a note against the revision the person watched. With `at` it is anchored to that
 * moment; with `beat` alone to the whole beat; with neither it is about the whole film.
 */
export function addNote(
  root: string,
  {
    text: given,
    revision,
    at,
    to,
    beat,
    element,
    keep = [],
    scope: asked,
    kind,
    by,
    agent = false,
    via = 'cli',
  }: NoteRequest,
): Note {
  const text = cleanText(given);
  if (asked != null && !SCOPES.includes(asked))
    throw new Error(`--scope must be ${SCOPES.join(', ')}`);
  for (const k of keep)
    if (!KEEPS.includes(k)) throw new Error(`keep must be ${KEEPS.join(', ')}`);
  if (beat != null) checkId('beat', beat);
  const revs = listRevisions(root);
  const rev = revision
    ? revs.find((r) => r.id === checkId('revision', revision))
    : ([...revs].reverse().find((r) => (r.videos ?? []).length) ?? revs.at(-1));
  if (!rev)
    throw new Error(
      'No revision yet: render a draft (or run snapshot) so a note can say which cut it is about.',
    );
  const { timeline } = loadRevision(root, rev.id);
  let anchor: NoteAnchor | null = null;
  if (at != null) anchor = anchorAt(timeline, at, { to, beat, element });
  else if (beat != null) anchor = beatAnchor(timeline, rev.id, beat, element);
  const scope = noteScope(asked, anchor, to, element);
  return withLock(root, () => {
    const notes = readNotes(root);
    const note: Note = {
      id: nextId(
        'n',
        notes.map((n) => n.id),
      ),
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
      history: [
        { status: 'open', at: new Date().toISOString(), revision: rev.id },
      ],
    };
    if (scope === 'chapter' && anchor) {
      const chapter = anchor.chapter;
      anchor.beats = timeline.beats
        .filter((b) => b.chapter === chapter)
        .map((b) => b.id);
      if (chapter == null)
        throw new Error(
          'This beat has no chapter; use --scope range with --to, or --scope beat.',
        );
    }
    notes.push(note);
    writeNotes(root, notes);
    for (const what of keep)
      addKeep(root, {
        what,
        beats: note.anchor?.beats ?? null,
        revision: rev.id,
        by: note.author,
        said: text,
        note: note.id,
      });
    return note;
  });
}

export function updateNote(
  root: string,
  id: string,
  change: (note: Note) => void,
): Note {
  checkId('note', id);
  return withLock(root, () => {
    const notes = readNotes(root);
    const n = notes.find((x) => x.id === id);
    if (!n) throw new Error(`No note ${id}.`);
    change(n);
    writeNotes(root, notes);
    return n;
  });
}
export function setNoteStatus(
  root: string,
  id: string,
  status: string,
  {
    revision,
    by,
    reason,
  }: { revision?: string; by?: unknown; reason?: string } = {},
): Note {
  if (!NOTE_STATUSES.includes(status))
    throw new Error(`Unknown note status ${status}`);
  return updateNote(root, id, (n) => {
    n.status = status;
    if (status === 'applied')
      n.resolution = {
        revision,
        at: new Date().toISOString(),
        ...(reason ? { summary: reason } : {}),
      };
    n.history.push({
      status,
      at: new Date().toISOString(),
      ...(revision ? { revision } : {}),
      ...(by ? { by } : {}),
      ...(reason ? { reason } : {}),
    });
  });
}

const timeOf = (v: unknown): number | undefined => {
  if (v == null) return undefined;
  return typeof v === 'number' ? v : parseTime(String(v));
};
const optionalString = (v: unknown): string | undefined =>
  v == null ? undefined : String(v);

/** Notes exported by the review page (or written by hand): {notes: [{revision, at, to?, beat?, text}]}. */
export function importNotes(
  root: string,
  data: unknown,
  { by, via = 'page' }: { by?: unknown; via?: string } = {},
): Note[] {
  let list: unknown = data;
  if (!Array.isArray(data)) list = isRecord(data) ? data.notes : undefined;
  if (!Array.isArray(list))
    throw new Error('Expected {"notes": [...]} from the review page.');
  if (list.length > 500) throw new Error('Too many notes in one file.');
  return list.map((n: unknown) => {
    if (!isRecord(n)) throw new Error('Each note must be an object.');
    const keep = Array.isArray(n.keep) ? n.keep.map(String) : [];
    return addNote(root, {
      text: n.text,
      revision: optionalString(n.revision),
      at: timeOf(n.at),
      to: timeOf(n.to),
      beat: optionalString(n.beat),
      element: optionalString(n.element),
      keep,
      scope: optionalString(n.scope),
      by: n.by ?? by,
      via,
    });
  });
}

// ------------------------------------------------------------------ decisions

export { addDecision, acceptance } from './notes-decisions.mjs';
export type {
  DecisionRequest,
  Acceptance,
  AcceptanceState,
} from './notes-decisions.mjs';
