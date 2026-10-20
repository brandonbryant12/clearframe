import fs from 'node:fs';
import path from 'node:path';
import { ID, reviewPath, writeAtomic } from './store.mjs';
import { esc, t, page, objectUrl } from './review-page-html.mjs';
import type { Side, PassagePair, PassageReceipt } from './edit-loop.mjs';
import type { LoadedRevision, ImpactReport } from './revisions.mjs';
import type { Note } from './notes.mjs';
export interface ComparePageOptions {
  A: LoadedRevision;
  B: Side;
  report: ImpactReport;
  passages?: PassagePair[];
  note?: Note;
}
/** The before/after page for an impact report and its rendered passages. */
export function writeComparePage(
  root: string,
  { A, B, report, passages = [], note }: ComparePageOptions,
): string {
  const to = B.meta?.id ?? 'working';
  if (
    !ID.revision.test(A.meta.id) ||
    !(to === 'working' || ID.revision.test(to))
  )
    throw new Error('Invalid revision ids for a compare page.');
  const dir = reviewPath(root, 'compare', `${A.meta.id}-${to}`);
  fs.mkdirSync(dir, { recursive: true });
  const url = (rel: unknown) => objectUrl(root, rel, dir);
  function side(label: string, p: PassageReceipt | undefined): string {
    if (!p)
      return `<figure><figcaption><b>${esc(label)}</b></figcaption><div class="meta">Nothing here on this side.</div></figure>`;
    return `<figure><figcaption><b>${esc(label)}</b> <span class="meta">${t(p.range?.seconds?.[0])}–${t(p.range?.seconds?.[1])} of ${esc(p.revision ?? to)}</span></figcaption>${url(p.object) ? `<video class="pairplay" controls preload="metadata" src="${esc(url(p.object))}"></video>` : '<div class="meta">missing</div>'}
<div class="meta">${esc(p.from ?? 'rendered from the full prepared timeline (all neighbours, worlds and transitions in place)')}${p.verified ? ` · clock checked at frames ${p.verified.map((v) => `${v.film} (${psnrLabel(v.psnr)} dB)`).join(', ')}` : ''}${p.audio ? ` · audio cut from the full mix (film ${esc(p.audio.film?.integrated)} LUFS, this stretch ${esc(p.audio.stretch?.integrated)} LUFS)` : ''}</div>
<div class="meta">${esc((p.beats ?? []).map((b) => b.id).join(' · '))}</div></figure>`;
  }
  const pairs = passages
    .map(
      (p, i) =>
        `<div class="panel"><b>Passage ${i + 1}</b> <span class="meta">${esc(p.beats.join(', '))}${p.removed?.length ? ` · removed: ${esc(p.removed.join(', '))}` : ''}</span><div class="pair">${side(`Before (${A.meta.id})`, p.before)}${side(`After (${to})`, p.after)}</div></div>`,
    )
    .join('');
  const beatRows = report.beats
    .filter((x) => x.status !== 'unchanged')
    .map(
      (x) =>
        `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.status)}</td><td>${esc((x.reasons ?? []).join('; '))}${x.text ? `<div class="quote">“${esc(x.text)}”</div>` : ''}</td></tr>`,
    )
    .join('');
  const replies = B.meta
    ? [
        ['Accept', `accept ${B.meta.id}${note ? ` for ${note.id}` : ''}: `],
        ['Refine', `refine ${B.meta.id}${note ? ` (${note.id})` : ''}: `],
        ['Reject', `reject ${B.meta.id}${note ? ` (${note.id})` : ''}: `],
      ]
    : [];
  const body = `<header><h1>${esc(A.meta.id)} → ${esc(to)}${note ? ` <span class="badge">${esc(note.id)}</span>` : ''}</h1>
<div class="meta">${esc(B.timeline.title)} · ${B.meta?.kind === 'candidate' ? 'candidate revision: applied, not yet accepted' : esc(B.meta?.kind ?? 'working copy (not saved as a revision)')}</div></header>
<main style="grid-template-columns:1fr"><section>
${noteHTML(note)}
<div class="panel"><b>What changed</b><ul class="plain">${report.summary.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>${beatRows ? `<table><tr><th>Beat</th><th>Change</th><th>Why</th></tr>${beatRows}</table>` : ''}</div>
${passages.length ? `<button id="playboth">Play before and after together</button>` : ''}${pairs || '<div class="panel meta">No passages rendered.</div>'}
${replies.length ? `<div class="panel"><b>Reply</b><div class="meta">Copies a line to paste into the chat; finish it with your words. Acceptance is recorded only from your reply.</div>${replies.map(([l, r]) => `<button data-reply="${esc(r)}">${esc(l)}</button>`).join('')}<pre id="out"></pre><span id="flash" class="meta"></span></div>` : ''}
<p><a href="${esc(path.relative(dir, reviewPath(root, 'index.html')).split(path.sep).join('/'))}">Back to the review page</a></p>
</section></main>`;
  const file = path.join(dir, 'index.html');
  writeAtomic(
    file,
    page(`${A.meta.id} → ${to}`, body, {
      revision: B.meta?.id ?? A.meta.id,
      origin: 0,
      beats: [],
    }),
  );
  fs.writeFileSync(
    path.join(dir, 'compare.json'),
    JSON.stringify(
      { from: A.meta.id, to, note: note?.id ?? null, report, passages },
      null,
      2,
    ) + '\n',
  );
  return file;
}

function noteHTML(note: Note | undefined): string {
  if (!note) return '';
  return `<div class="panel"><b>Note ${esc(note.id)}</b> <span class="meta">on ${esc(note.revision)}${note.anchor ? ` @ ${t(note.anchor.at)} · ${esc(note.anchor.beat)}` : ''}</span><div>${esc(note.text)}</div>${anchorWordsHTML(note)}${note.keep?.length ? `<div class="meta">keep: ${esc(note.keep.join(', '))}</div>` : ''}</div>`;
}

function psnrLabel(psnr: number | null): string {
  return psnr != null && Number.isFinite(psnr) ? psnr.toFixed(1) : '∞';
}
function anchorWordsHTML(note: Note): string {
  if (!note.anchor?.words) return '';
  const original = note.anchor.source?.original;
  const source = original
    ? ` · recording ${t(original[0])}–${t(original[1])}`
    : '';
  return `<div class="quote">“${esc(note.anchor.words)}”${source}</div>`;
}
