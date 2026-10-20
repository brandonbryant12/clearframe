import type { Timeline, RevisionMeta } from './revisions.mjs';

import type {
  Note,
  Keep,
  Decision,
  Located,
  Acceptance,
  acceptance,
} from './notes.mjs';
import { esc, t } from './review-page-html.mjs';
export type DisplayLocation = Omit<Located, 'state'> & {
  state: Located['state'] | 'unknown';
};
export interface LocatedNote {
  n: Note;
  where: DisplayLocation;
}
export function rowsHTML(
  timeline: Timeline,
  accepted: ReturnType<typeof acceptance>,
  openBy: Record<string, number>,
): string {
  let chapter: string | null | undefined;
  return timeline.beats
    .map((b) => {
      const head =
        b.chapter && b.chapter !== chapter
          ? `<div class="chapter">${esc(b.chapter)}</div>`
          : '';
      chapter = b.chapter ?? chapter;
      const a = accepted[b.id];
      const badges = [
        b.placeholder
          ? `<span class="badge warn" title="${esc(b.placeholder)}">placeholder</span>`
          : '',
        b.vo && b.vo.timing !== 'measured'
          ? '<span class="badge warn">estimated timing</span>'
          : '',
        acceptedBadge(a),
        openBy[b.id]
          ? `<span class="badge">${openBy[b.id]} open note(s)</span>`
          : '',
      ].join('');
      return `${head}<li data-id="${esc(b.id)}" data-start="${Number(b.start)}"><span class="tc">${t(b.start)}</span> <b>${esc(b.id)}</b>${b.speaker ? ` <span class="meta">${esc(b.speaker)}</span>` : ''} <span class="meta">${esc(b.block ?? '')}</span>${badges}<div>${esc(b.vo?.text ?? b.visual ?? '')}</div></li>`;
    })
    .join('');
}

export function noteRowsHTML(located: LocatedNote[]): string {
  return located
    .map(
      ({ n, where }) =>
        `<tr><td><b>${esc(n.id)}</b><br><span class="meta">${esc(n.revision)}${n.anchor ? ` @ ${t(n.anchor.at)}` : ''}</span></td><td>${esc(n.text)}${n.anchor?.words ? `<div class="quote">“${esc(n.anchor.words)}”</div>` : ''}${n.keep?.length ? `<div class="meta">keep: ${esc(n.keep.join(', '))}</div>` : ''}</td><td>${esc(n.status)}${n.resolution?.revision ? ` → ${esc(n.resolution.revision)}` : ''}<br><span class="badge ${locationBadge(where)}">${esc(where.state)}</span>${where.reason ? `<div class="meta">${esc(where.reason)}</div>` : ''}</td></tr>`,
    )
    .join('');
}

export function keepRowsHTML(keeps: Keep[]): string {
  return keeps
    .map(
      (k) =>
        `<tr><td>${esc(k.id)}</td><td>${esc(k.what)}</td><td>${esc(k.scope.film ? 'whole film' : (k.scope.beats ?? []).join(', '))}</td><td>${esc(k.by?.name ?? k.by?.role)}${k.said ? `<div class="quote">“${esc(k.said)}”</div>` : ''}</td><td>${k.active ? 'active' : 'released'}</td></tr>`,
    )
    .join('');
}

export function decisionRowsHTML(decisions: Decision[]): string {
  return decisions
    .slice(-12)
    .reverse()
    .map(
      (d) =>
        `<tr><td>${esc(d.id)}</td><td>${esc(d.action)}${d.role === 'agent' ? ' <span class="badge warn">agent decision, not a person’s acceptance</span>' : ''}</td><td>${esc(d.revision)}</td><td>${esc(d.by ?? d.role)}${decisionQuote(d)}</td></tr>`,
    )
    .join('');
}

export function revRowsHTML(revs: RevisionMeta[], currentId: string): string {
  return [...revs]
    .reverse()
    .map((r) => {
      return `<tr><td><b>${esc(r.id)}</b>${r.id === currentId ? ' <span class="badge ok">shown</span>' : ''}</td><td>${esc(r.kind)}${r.label ? ` · ${esc(r.label)}` : ''}</td><td>${esc((r.createdAt ?? '').replace('T', ' ').slice(0, 16))}</td><td>${videoLabel(r)}</td><td>${esc(r.reason ?? '')}</td></tr>`;
    })
    .join('');
}

function acceptedBadge(a: Acceptance | undefined): string {
  if (!a) return '';
  const color = a.state === 'changed' ? 'bad' : 'ok';
  const label = a.state === 'accepted' ? `accepted by ${a.by}` : a.state;
  return `<span class="badge ${color}">${esc(label)}</span>`;
}
function locationBadge(where: DisplayLocation): string {
  if (['stale', 'orphaned'].includes(where.state)) return 'bad';
  return where.state === 'changed' ? 'warn' : '';
}
function decisionQuote(d: Decision): string {
  if (d.said) return `<div class="quote">“${esc(d.said)}”</div>`;
  return d.reason ? `<div class="meta">${esc(d.reason)}</div>` : '';
}
function videoLabel(r: RevisionMeta): string {
  const video = r.videos?.find((v) => v.retained !== false);
  if (video) return esc(video.profile);
  if (r.videos?.length) return 'video released';
  return r.previews?.length ? 'previews only' : 'no video';
}
