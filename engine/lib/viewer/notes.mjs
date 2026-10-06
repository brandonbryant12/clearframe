// Notes from the viewer: create, resolve, reopen and reply, in the engine's review record
// (ClearFrame films) or the film's own notes.json (films described by film.json).
import fs from 'node:fs';
import path from 'node:path';
import { addNote, setNoteStatus, updateNote, readNotes } from '../notes.mjs';
import { readJSON } from './media.mjs';

const isManifest = dir => fs.existsSync(path.join(dir, 'film.json'));
const manifestNotes = dir => readJSON(path.join(dir, 'notes.json'), { notes: [] });
const writeManifestNotes = (dir, data) => fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(data, null, 2) + '\n');
const pinsFile = dir => path.join(dir, 'review/viewer-pins.json');
const cleanText = (text, max = 2000) => {
  if (typeof text !== 'string' || !text.trim() || text.length > max) throw new Error(`A note needs text (up to ${max.toLocaleString('en-US')} characters).`);
  return text.trim();
};
const tagsOf = text => [...new Set((text.match(/#[\p{L}\p{N}_-]+/gu) ?? []).map(t => t.slice(1).toLowerCase()))];

/** Where a pin sits on the frame, in words an agent (or a person) can follow. */
export function spotWords({ x, y }) {
  const row = y < 1 / 3 ? 'top' : y > 2 / 3 ? 'bottom' : 'middle', col = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'centre';
  return row === 'middle' && col === 'centre' ? 'centre' : `${row} ${col}`;
}

// Engine states, in the words a reviewer uses.
const RESOLVED = { applied: 'Applied', accepted: 'Resolved', dismissed: "Won't change" };

/** One shape for the page, whichever record the note came from. */
export function noteView(n, { pins = {}, engine = false } = {}) {
  const pin = engine ? pins[n.id] : n.pin;
  const status = engine ? n.status : n.status ?? 'open';
  const resolved = engine ? status in RESOLVED : status === 'resolved';
  return {
    id: n.id, text: n.text, by: (engine ? n.author?.name ?? n.author : n.by) ?? null, createdAt: n.createdAt ?? null,
    at: engine ? n.anchor?.at ?? null : n.at ?? null,
    scope: n.scope ?? (n.at == null && !n.anchor ? 'film' : 'beat'),
    element: (engine ? n.anchor?.element ?? pins[n.id]?.element : n.element) ?? null,
    pin: pin?.x != null ? { x: pin.x, y: pin.y } : null, where: pin?.x != null ? spotWords(pin) : null, on: typeof pin?.on === 'string' ? pin.on : null,
    // The raw status, and the agent's one-line answer when it acted on the note.
    status, changedIn: engine && status === 'applied' ? n.resolution?.revision ?? null : null, answer: engine && status === 'applied' ? n.resolution?.summary ?? null : null,
    resolved, state: resolved ? (engine ? `${RESOLVED[status]}${status === 'applied' && n.resolution?.revision ? ` in ${n.resolution.revision}` : ''}` : 'Resolved') : status === 'question' ? 'Question' : 'Open',
    tags: tagsOf(n.text ?? ''), replies: (n.replies ?? []).map(r => ({ text: r.text, by: r.by ?? null, at: r.at ?? null })),
  };
}

/** Record a note: anchored to its moment (and, where the engine knows it, the element under the pin). */
export function saveNote(dir, { version, at, text, by, element, pin, scope }) {
  text = cleanText(text);
  const whole = scope === 'film' || at == null;
  if (!whole && !(Number.isFinite(at) && at >= 0)) throw new Error('Note time must be a nonnegative number');
  if (whole && (pin != null || element != null)) throw new Error('Whole-cut notes cannot have a picture pin');
  if (pin != null && !(Number.isFinite(pin.x) && Number.isFinite(pin.y) && pin.x >= 0 && pin.x <= 1 && pin.y >= 0 && pin.y <= 1)) throw new Error('pin needs x and y between 0 and 1');
  // A pin keeps the words on screen under it, so the note can say what was pointed at.
  if (pin != null) pin = { x: pin.x, y: pin.y, ...(typeof pin.on === 'string' && pin.on.trim() ? { on: pin.on.trim().slice(0, 200) } : {}) };
  if (isManifest(dir)) {
    const data = manifestNotes(dir);
    const note = { id: `n${String(data.notes.length + 1).padStart(3, '0')}`, version, at: whole ? null : at, scope: whole ? 'film' : 'beat', text, by: by || null, element: element ?? null,
      pin: pin ?? null, status: 'open', replies: [], createdAt: new Date().toISOString() };
    data.notes.push(note);
    writeManifestNotes(dir, data);
    return noteView(note);
  }
  const args = { text, revision: version === 'latest' ? undefined : version, ...(whole ? { scope: 'film' } : { at }), by: by || undefined, via: 'viewer' };
  // Authored elements anchor in the engine; generated chart parts anchor to the moment, and the viewer keeps the element.
  let note;
  try { note = addNote(dir, { ...args, element: element ?? undefined }); }
  catch (e) { if (element == null || !/has no element/.test(e.message)) throw e; note = addNote(dir, args); }
  const pins = readJSON(pinsFile(dir), {});
  if (pin || element) {
    pins[note.id] = { ...(pin ?? {}), ...(element ? { element } : {}) };
    fs.writeFileSync(pinsFile(dir), JSON.stringify(pins, null, 2) + '\n');
  }
  return noteView(note, { pins, engine: true });
}

/** Resolve or reopen. In the engine a reviewer's resolution is `accepted`; reopening is `open`. */
export function setNoteState(dir, id, { resolved, by, dismiss = false } = {}) {
  if (typeof resolved !== 'boolean') throw new Error('resolved is true or false');
  if (isManifest(dir)) {
    const data = manifestNotes(dir), n = data.notes.find(x => x.id === id);
    if (!n) throw new Error(`No note ${id}.`);
    n.status = resolved ? 'resolved' : 'open';
    (n.history ??= []).push({ status: n.status, at: new Date().toISOString(), ...(by ? { by } : {}) });
    writeManifestNotes(dir, data);
    return noteView(n);
  }
  // In the engine a resolution is a person's acceptance (or their "won't change"): it names them.
  if (resolved && !String(by ?? '').trim()) throw new Error('Resolving a note records who decided: enter your name first.');
  const n = setNoteStatus(dir, id, resolved ? (dismiss ? 'dismissed' : 'accepted') : 'open', { by: by || undefined });
  return noteView(n, { pins: readJSON(pinsFile(dir), {}), engine: true });
}

/** Add a reply to a note's thread. */
export function replyToNote(dir, id, { text, by } = {}) {
  const reply = { text: cleanText(text, 1000), by: by || null, at: new Date().toISOString() };
  if (isManifest(dir)) {
    const data = manifestNotes(dir), n = data.notes.find(x => x.id === id);
    if (!n) throw new Error(`No note ${id}.`);
    (n.replies ??= []).push(reply);
    writeManifestNotes(dir, data);
    return noteView(n);
  }
  const n = updateNote(dir, id, x => { (x.replies ??= []).push(reply); });
  return noteView(n, { pins: readJSON(pinsFile(dir), {}), engine: true });
}

/** Reload persisted threads without rebuilding the viewer or resetting playback. */
export function loadViewerNotes(dir) {
  if (isManifest(dir)) return manifestNotes(dir).notes.map(n => ({ ...noteView(n), version: n.version }));
  const pins = readJSON(pinsFile(dir), {});
  return readNotes(dir).map(n => ({ ...noteView(n, { pins, engine: true }), version: n.revision }));
}

/** The agent's answer to a note it acted on: applied, with what it changed in one line. A person still decides. */
export function answerNote(dir, id, { said, revision } = {}) {
  said = cleanText(said, 400);
  if (isManifest(dir)) throw new Error('Notes on a film made outside ClearFrame are answered by people.');
  const n = readNotes(dir).find(x => x.id === id);
  if (!n) throw new Error(`No note ${id}.`);
  if (n.status === 'accepted' || n.status === 'dismissed') throw new Error(`${id} is already closed by a person.`);
  setNoteStatus(dir, id, 'applied', { revision: revision ?? undefined, reason: said, by: 'agent' });
  return loadViewerNotes(dir).find(x => x.id === id);
}
