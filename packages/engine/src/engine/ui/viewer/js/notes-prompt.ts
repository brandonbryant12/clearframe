import type { Spot, Film, Version, Scene } from './00-boundary-films.js';
import { find } from './00-boundary.js';
import { myName, clock, sheet, esc } from './00-core.js';

import type { Note } from './notes-model.js';
import { versionOf, sceneAt } from './notes-storage.js';

// ---------------------------------------------------------------- notes in words, for the agent
export const stampTime = (t: number) =>
  `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

export const shellQuote = (s: string) =>
  JSON.stringify(s).replace(/[$`]/g, (c) => `\\${c}`);

/** Which third of the picture a coordinate falls in. */
export function third(
  at: number,
  low: string,
  mid: string,
  high: string,
): string {
  if (at < 1 / 3) return low;
  return at > 2 / 3 ? high : mid;
}

export function spotWords({ x, y }: Spot) {
  const row = third(y, 'top', 'middle', 'bottom'),
    col = third(x, 'left', 'centre', 'right');
  return row === 'middle' && col === 'centre' ? 'centre' : `${row} ${col}`;
}

export const spotOf = (n: Note) => n.spot ?? n.pin ?? null;

export const placeOf = (n: Note) => {
  const spot = spotOf(n);
  return [spot && spotWords(spot), n.on && `on “${n.on}”`]
    .filter(Boolean)
    .join(', ');
};

export const versionWords = (v: Version) =>
  `version ${v.number}${v.id !== 'latest' ? ` (${v.id})` : ''}`;

export const sceneWords = (s: Scene) =>
  `scene ${s.number} (${s.kind}${s.id ? `, ${s.id}` : ''})`;

export function momentWords(f: Film, n: Note, v: Version | null): string {
  if (n.at != null)
    return `${clock(n.at)}${v && f.versions.length > 1 ? ` in version ${v.number}` : ''}`;
  const b = n.scene ? f.boards?.find((x) => x.id === n.scene) : null;
  return b ? `Scene ${b.number} (${b.kind})` : 'Whole film';
}

/** One line a person can read and the agent can act on: which note, when, which scene, where, what. */
export function noteLine(f: Film, n: Note, i: number): string {
  const v = versionOf(f, n.version),
    s = n.at != null ? sceneAt(v, n.at) : null,
    place = placeOf(n);
  const bits = [
    n.local ? null : n.id,
    momentWords(f, n, v),
    s && sceneWords(s),
    place && `pinned ${place}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return `${i + 1}. ${bits}: ${n.text}`;
}

export function notesHead(f: Film, v: Version | null): string {
  if (f.kind === 'brief')
    return `Please make a film from the brief in ${f.folder}.`;
  return v
    ? `Here are my notes on ${versionWords(v)} of “${f.title}”.`
    : `Here are my notes on the storyboard for “${f.title}”.`;
}

export function notesAsk(f: Film, v: Version | null, saved: number): string {
  if (f.kind === 'brief') return 'Show me a rough cut first.';
  if (!v)
    return 'Change only the scenes these notes are about, then render a rough cut.';
  return `${saved ? 'They are saved as review notes (clearframe_notes lists them, with where each is pinned). ' : ''}Change only what each note points at, render a new cut, then answer each note you acted on.`;
}

/** The message that hands notes to the agent: the notes, then what to do with them. */
export function notesMessage(
  f: Film,
  v: Version | null,
  notes: readonly Note[],
): string {
  const lines = notes.map((n, i) => noteLine(f, n, i)).join('\n');
  return `${notesHead(f, v)}\n\n${lines}${lines ? '\n\n' : ''}${notesAsk(f, v, notes.filter((n) => !n.local).length)}`;
}

/** The command that records a note kept in this browser into the film's review record. */
export function recordCommand(
  f: Film,
  n: Note,
  where: string,
  by: string,
): string {
  if (n.at == null)
    return `clearframe note ${where} ${shellQuote(n.text)} --rev ${n.version}${by}`;
  const scene = sceneAt(versionOf(f, n.version), n.at)?.id,
    place = placeOf(n);
  return `clearframe note ${where} ${shellQuote(`[ClearFrame ${n.version} @ ${stampTime(n.at)}${scene ? ` · ${scene}` : ''}${place ? ` · ${place}` : ''}] ${n.text}`)}${by}`;
}

export function savedWords(
  saved: readonly Note[],
  where: string,
): string | null {
  if (!saved.length) return null;
  return `${saved.map((n) => n.id).join(', ')} ${saved.length === 1 ? 'is' : 'are'} saved in its review record (\`clearframe notes ${where}\` shows where each is now).`;
}

export function recordWords(
  f: Film,
  saved: number,
  record: readonly string[],
): string | null {
  if (f.kind !== 'clearframe' || !record.length) return null;
  return `Record ${saved ? 'the others' : 'them'} first:\n${record.join('\n')}`;
}

/** Opened as a file there is no agent on the page: the same notes as a message to paste, with the commands to record them. */
export function pastePrompt(
  f: Film,
  v: Version | null,
  notes: readonly Note[],
): string {
  const where = f.folder,
    by = myName() ? ` --by ${shellQuote(myName())}` : '';
  const head = v
    ? `Here are my notes on ${versionWords(v)} of “${f.title}”.`
    : `Here are my notes on the storyboard for “${f.title}”.`;
  const saved = notes.filter((n) => !n.local),
    record = notes
      .filter((n) => n.local && n.version && n.version !== 'latest')
      .map((n) => recordCommand(f, n, where, by));
  return [
    head,
    '',
    notes.map((n, i) => noteLine(f, n, i)).join('\n'),
    '',
    `The film is in ${where}.`,
    savedWords(saved, where),
    recordWords(f, saved.length, record),
    f.kind === 'clearframe'
      ? 'Then follow skills/clearframe-review: change only what each note points at, render a new cut, and tell me what you changed for each note.'
      : 'Tell me what you would change for each note.',
  ]
    .filter((x) => x != null)
    .join('\n');
}

export async function copy(value: string, button?: HTMLElement | null) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const t = document.createElement('textarea');
    t.value = value;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  if (button) {
    const was = button.textContent;
    button.textContent = 'Copied ✓';
    setTimeout(() => {
      button.textContent = was;
    }, 1800);
  }
}

export function pasteSheet(
  f: Film,
  v: Version | null,
  notes: readonly Note[],
): void {
  const card = sheet(`<h2>Hand your notes to your agent</h2>
    <p class="muted">Paste this into Claude Code (or another coding agent) in the ClearFrame folder. Each note carries its moment and its spot on the picture, so the agent can find the exact frame.</p>
    <textarea class="prompt" spellcheck="false">${esc(pastePrompt(f, v, notes))}</textarea>
    <div class="row"><button class="btn" data-close>Close</button><button class="btn primary" data-copy>Copy</button></div>`);
  const button = find(card, '[data-copy]', HTMLButtonElement);
  button.onclick = () =>
    copy(find(card, 'textarea', HTMLTextAreaElement).value, button);
}
