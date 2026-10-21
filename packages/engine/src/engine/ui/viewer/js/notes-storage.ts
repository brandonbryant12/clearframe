import { decodeLocalNote, decodeSavedNote } from './00-boundary-films.js';
import type {
  Film,
  Version,
  SavedNote,
  LocalNote,
} from './00-boundary-films.js';
import { stored, readableOf, isRecord } from './00-boundary.js';
import { store, server, myName, askName, call } from './00-core.js';

import type { NoteState, NoteAct, Note, NewNote } from './notes-model.js';

export const localKey = (id: string) => `cf-notes:${id}`;

export const versionOf = (f: Film, id: string | null | undefined) =>
  f.versions.find((v) => v.id === id) ?? null;

export const STATE = new Map<string, NoteState>([
  ['open', 'open'],
  ['question', 'open'],
  ['applied', 'changed'],
  ['accepted', 'done'],
  ['dismissed', 'done'],
]);

export const NOTE_ACTS: readonly NoteAct[] = ['done', 'open', 'removed'];

export const noteAct = (act: string) =>
  NOTE_ACTS.find((a) => a === act) ?? null;

export const localNotes = (id: string) =>
  stored(localKey(id), readableOf(decodeLocalNote), []);

/** This browser's notes for a film exactly as stored, so a change keeps every field it had. */
export function storedList(key: string): unknown[] {
  const list = store.get(key, []);
  return Array.isArray(list) ? list : [];
}

/** Every note on the film, from every version, plus the ones kept in this browser. */
export function notesOf(f: Film): Note[] {
  const out = savedNotesOf(f);
  for (const n of localNotes(f.id))
    if (n.state !== 'removed') out.push({ ...n, state: n.state, local: true });
  return out;
}

export function savedNotesOf(f: Film): Note[] {
  const seen = new Set<string>(),
    out: Note[] = [];
  for (const v of f.versions)
    for (const n of v.notes ?? []) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      out.push({
        ...n,
        version: n.earlier ?? v.id,
        at: n.earlier ? (n.earlierAt ?? null) : n.at,
        state: STATE.get(n.status ?? '') ?? (n.resolved ? 'done' : 'open'),
      });
    }
  return out;
}

export const timeIn = (v: Version | null, n: Note) =>
  n.at == null || !v ? null : n.at;

export const sceneAt = (v: Version | null, t: number | null | undefined) =>
  v?.scenes?.find((s) => t != null && t >= s.start && t < s.end) ??
  (t != null ? v?.scenes?.at(-1) : null) ??
  null;

// Whole-film notes first, then by moment (or by scene on boards).
export const sortKey = (f: Film, v: Version | null, n: Note) =>
  timeIn(v, n) ??
  (n.scene ? (f.boards?.find((b) => b.id === n.scene)?.number ?? 1e6) : -1);

export const sortNotes = (f: Film, v: Version | null, list: readonly Note[]) =>
  [...list].sort((a, b) => sortKey(f, v, a) - sortKey(f, v, b));

/** Replace a saved note in its version's list with the server's copy. */
export function keepNote(
  f: Film,
  saved: SavedNote,
  versionId: string | null | undefined,
) {
  const v = versionOf(f, versionId) ?? f.versions.at(-1);
  if (!v) return;
  v.notes ??= [];
  const i = v.notes.findIndex((x) => x.id === saved.id);
  if (i >= 0) v.notes[i] = { ...v.notes[i], ...saved };
  else v.notes.push(saved);
}

export async function addNote(
  f: Film,
  note: NewNote,
): Promise<SavedNote | LocalNote | null> {
  // Notes on a saved version go into the film when served; boards and loose cuts stay in this browser.
  if (server && f.notesTo && note.version && note.version !== 'latest')
    return saveToFilm(f, note, note.version);
  const saved: LocalNote = {
    ...note,
    by: myName() || null,
    id: `local-${Date.now()}`,
    state: 'open',
    createdAt: new Date().toISOString(),
  };
  store.set(localKey(f.id), [...storedList(localKey(f.id)), saved]);
  return saved;
}

export async function saveToFilm(
  f: Film,
  note: NewNote,
  version: string,
): Promise<SavedNote | null> {
  const by = await askName('Notes saved in the film record who left them.');
  if (!by) return null;
  const saved = decodeSavedNote(
    await call('/api/notes', {
      film: f.id,
      version,
      text: note.text,
      by,
      ...(note.at == null ? { scope: 'film' } : { at: note.at }),
      ...(note.spot
        ? { pin: { x: note.spot.x, y: note.spot.y, on: note.on ?? undefined } }
        : {}),
      ...(note.element ? { element: note.element } : {}),
    }),
    '/api/notes',
  );
  keepNote(f, saved, version);
  return saved;
}

/** done, open (again) or removed. A note saved in the film records who closed it. */
export async function setState(
  f: Film,
  n: Note,
  state: NoteAct,
): Promise<void> {
  if (n.local) return setLocalState(f, n, state);
  if (!server)
    throw new Error(
      'Open the viewer with --serve to change notes saved in the film.',
    );
  const by =
    state === 'open'
      ? myName()
      : await askName('Closing a note records who decided.');
  if (state !== 'open' && !by) return;
  const saved = decodeSavedNote(
    await call('/api/notes/state', {
      film: f.id,
      id: n.id,
      resolved: state !== 'open',
      dismiss: state === 'removed',
      by,
    }),
    '/api/notes/state',
  );
  keepNote(f, saved, n.version);
}

export function setLocalState(f: Film, n: Note, state: NoteAct): void {
  const key = localKey(f.id),
    list = storedList(key),
    i = list.findIndex((x) => isRecord(x) && x.id === n.id),
    x = list[i];
  if (isRecord(x)) {
    list[i] = { ...x, state };
    store.set(key, list);
  }
}
