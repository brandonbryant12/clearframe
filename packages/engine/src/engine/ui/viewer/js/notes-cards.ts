import type { Film, Version, Board } from './00-boundary-films.js';

import { server, clock, esc, plural } from './00-core.js';

import { sortNotes, notesOf, versionOf, timeIn } from './notes-storage.js';
import { spotOf, placeOf } from './notes-prompt.js';
import type { Note } from './notes-model.js';

/** The numbers on the stickies pinned to the picture, in the list's order. */
export function noteNumbers(f: Film, v: Version | null): Map<string, number> {
  let k = 0;
  return new Map(
    sortNotes(f, v, notesOf(f))
      .filter((n) => spotOf(n))
      .map((n): [string, number] => [n.id, ++k]),
  );
}

export function stickyLabel(
  t: number | null,
  b: Board | null | undefined,
): string {
  if (t != null) return clock(t);
  return b ? `Scene ${b.number}` : 'Whole film';
}

export function stickyFoot(f: Film, n: Note): string {
  if (n.state === 'open')
    return '<button class="link" data-act="done">✓ Done</button>';
  if (n.state !== 'changed')
    return '<span class="muted">Done</span><span class="grow"></span><button class="link" data-act="open">Reopen</button>';
  const changedIn = n.changedIn ? versionOf(f, n.changedIn) : null;
  return `<span class="changedby">The agent changed this${changedIn ? ` in v${changedIn.number}` : ''}</span><span class="grow"></span><button class="link" data-act="done">Looks good</button><button class="link" data-act="open">Not yet</button>`;
}

export function stickyHTML(
  f: Film,
  v: Version | null,
  n: Note,
  num: number | undefined,
  active: boolean,
): string {
  const t = timeIn(v, n),
    from = versionOf(f, n.version),
    b = n.scene ? f.boards?.find((x) => x.id === n.scene) : null,
    place = placeOf(n);
  const other =
    from && v && from.id !== v.id
      ? `<span class="from" title="Left on version ${from.number}">v${from.number}</span>`
      : '';
  return `<article class="sticky ${n.state} ${active ? 'active' : ''}" data-id="${esc(n.id)}">
      <div class="shead"><button class="when" data-act="seek" ${t == null && !b ? 'disabled' : ''}>${num ? `<b class="num">${num}</b>` : ''}${esc(stickyLabel(t, b))}</button>${other}
        <span class="by">${esc(n.by ?? '')}</span><span class="grow"></span>${n.state === 'open' ? '<button class="x" data-act="removed" title="Remove this note" aria-label="Remove this note">×</button>' : ''}</div>
      <p>${esc(n.text)}</p>${place ? `<div class="where">${esc(place)}</div>` : ''}
      ${n.state === 'changed' && n.answer ? `<div class="answer"><b>Agent:</b> ${esc(n.answer)}</div>` : ''}
      <div class="sfoot">${stickyFoot(f, n)}</div></article>`;
}

export function emptyWords(f: Film, v: Version | null): string {
  if (v)
    return 'No notes yet. Click anywhere on the picture to leave one right there, or type above.';
  return f.boards?.length
    ? 'No notes yet. Click a scene to leave a note on it, or type above.'
    : 'No notes yet.';
}

/** Under the list: send the open notes, approve the latest cut, or say who approved it. */
export function sendHTML(
  f: Film,
  v: Version | null,
  all: readonly Note[],
): string {
  const open = all.filter((n) => n.state === 'open');
  if (open.length)
    return `<button class="btn agent" data-send>Send ${plural(open.length, 'note')} to the agent</button>`;
  if (
    v &&
    v === f.versions.at(-1) &&
    v.id !== 'latest' &&
    !v.approved &&
    f.kind === 'clearframe' &&
    server &&
    !all.some((n) => n.state === 'changed')
  )
    return `<button class="btn" data-approve>Approve version ${v.number}</button>`;
  if (!v?.approved) return '';
  const { by, said } = v.approved;
  return `<div class="approved">✓ Approved${by ? ` by ${esc(by)}` : ''}${said ? ` — “${esc(said)}”` : ''}</div>`;
}
