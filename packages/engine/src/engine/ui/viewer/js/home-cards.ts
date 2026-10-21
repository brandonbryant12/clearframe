import { byIdOptional } from './00-boundary.js';

import type { Film } from './00-boundary-films.js';
import { data, server, esc, plural, when } from './00-core.js';
import { notesOf } from './10-notes.js';

export const cover = (f: Film) =>
  f.versions.at(-1)?.poster ?? f.boards?.find((b) => b.image)?.image ?? null;

export const briefLine = (md: string | null | undefined) => {
  const lines = String(md ?? '')
    .split('\n')
    .map((l) => l.replace(/[#*`]/g, '').trim())
    .filter(Boolean);
  return (
    lines.find((l) => /^the one idea:/i.test(l)) ??
    lines[1] ??
    lines[0] ??
    ''
  ).replace(/^the one idea:\s*/i, '');
};

export const openNotes = (f: Film) =>
  notesOf(f).filter((n) => n.state === 'open').length;

export const toCheck = (f: Film) =>
  notesOf(f).filter((n) => n.state === 'changed').length;

// Films waiting on you first: changes to check, then cuts with no notes yet, then the rest by date.
export function filmWeight(f: Film): number {
  if (toCheck(f)) return 0;
  return f.versions.length && f.stage?.id !== 'final' && !openNotes(f) ? 1 : 2;
}

export const noFilms = () =>
  server
    ? ''
    : `<div class="empty">No films in ${esc(data.roots.join(', '))} yet.</div>`;

export function drawFilms() {
  const el = byIdOptional('films', HTMLElement);
  if (!el) return;
  const films = [...data.films].sort(
    (a, b) =>
      filmWeight(a) - filmWeight(b) ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  el.innerHTML = films.length ? films.map((f) => card(f)).join('') : noFilms();
}

export function filmStatus(f: Film): string {
  const open = openNotes(f),
    check = toCheck(f);
  if (check) return `<b class="hot">${plural(check, 'change')} to check</b>`;
  return open ? plural(open, 'open note') : esc(f.stage?.next ?? '');
}

export function card(f: Film): string {
  const img = cover(f),
    v = f.versions.at(-1);
  return `<a class="card" href="#/film/${esc(f.id)}">
    <div class="poster ${f.aspect}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="briefsnip">${esc(briefLine(f.brief) || 'No picture yet')}</span>`}</div>
    <div class="cbody"><div class="ctitle">${esc(f.title)}</div>
      <div class="cmeta"><span class="pill s-${esc(f.stage?.id ?? '')}">${esc(f.stage?.label ?? '')}</span>${v ? `<span>Version ${v.number}</span>` : ''}<span>${esc(when(f.updatedAt))}</span></div>
      <div class="cstatus">${filmStatus(f)}</div></div></a>`;
}
