import {
  type RevisionMeta,
  type RevisionVideo,
  listRevisions,
  loadRevision,
  revisionVideo,
} from './revisions.mjs';
import fs from 'node:fs';
import path from 'node:path';

import {
  readNotes,
  readKeeps,
  readDecisions,
  locate,
  acceptance,
} from './notes.mjs';
import { reviewPath, writeAtomic } from './store.mjs';

import { errorMessage } from './errors.mjs';
import { esc, t, page, objectUrl } from './review-page-html.mjs';
import { readReceipt, notValidated } from './review-page-receipt.mjs';
import {
  rowsHTML,
  noteRowsHTML,
  keepRowsHTML,
  decisionRowsHTML,
  revRowsHTML,
  type DisplayLocation,
} from './review-page-rows.mjs';

export { esc, inertJSON } from './review-page-html.mjs';
export { writeComparePage } from './review-page-compare.mjs';
/** Write the review page for `rev` (default: the newest revision with a kept video). */
export function writeReviewPage(
  root: string,
  { rev }: { rev?: string } = {},
): string | null {
  const revs = listRevisions(root);
  if (!revs.length) return null;
  const chosen = rev
    ? revs.find((r) => r.id === rev)
    : ([...revs]
        .reverse()
        .find((r) => (r.videos ?? []).some((v) => v.retained !== false)) ??
      revs.at(-1));
  if (!chosen) throw new Error(`No revision ${rev}.`);
  const { meta, timeline } = loadRevision(root, chosen.id);
  const isLatestPage = !rev;
  const file = isLatestPage
    ? reviewPath(root, 'index.html')
    : reviewPath(root, 'revisions', meta.id, 'index.html');
  const dir = path.dirname(file);
  const video = revisionVideo(root, meta);
  const receipt = readReceipt(root, video);
  const src = video ? objectUrl(root, video.object, dir) : null;
  const notes = readNotes(root),
    keeps = readKeeps(root),
    decisions = readDecisions(root);
  const accepted = acceptance(root, timeline);
  const openBy: Record<string, number> = {};
  const located = notes.map((n) => {
    let where: DisplayLocation;
    try {
      where =
        n.revision === meta.id
          ? { state: 'current', beat: n.anchor?.beat }
          : locate(root, n, { id: meta.id, timeline });
    } catch (e) {
      where = { state: 'unknown', reason: errorMessage(e) };
    }
    if (where.beat && ['open', 'question'].includes(n.status))
      openBy[where.beat] = (openBy[where.beat] ?? 0) + 1;
    return { n, where };
  });
  const rows = rowsHTML(timeline, accepted, openBy);
  const noteRows = noteRowsHTML(located);
  const keepRows = keepRowsHTML(keeps);
  const decisionRows = decisionRowsHTML(decisions);
  const compareDir = reviewPath(root, 'compare');
  const compares = fs.existsSync(compareDir)
    ? fs
        .readdirSync(compareDir)
        .filter(
          (d) =>
            /^[a-z0-9-]+$/i.test(d) &&
            fs.existsSync(path.join(compareDir, d, 'index.html')),
        )
        .sort()
    : [];
  const revRows = revRowsHTML(revs, meta.id);
  const nv = notValidated(meta, receipt);
  const body = `<header><h1>${esc(timeline.title)} <span class="badge">${esc(meta.id)}</span>${videoBadge(video)}</h1>
<div class="meta">${esc(meta.kind)}${meta.label ? ` · ${esc(meta.label)}` : ''} · saved ${esc((meta.createdAt ?? '').replace('T', ' ').slice(0, 19))} · ${t(timeline.duration)} · ${timeline.beats.length} beats · ${esc(timeline.width)}×${esc(timeline.height)} @ ${esc(timeline.fps)} fps${meta.parent ? ` · after ${esc(meta.parent)}` : ''}</div></header>
<main><section>
${playerHTML(meta, src)}
<div class="playhead" id="playhead"></div>
<div class="panel"><b>Note at the playhead</b><div class="meta">Stamped with ${esc(meta.id)}, the time, the beat and the words around it. Paste into the chat, or download several as a file for <code>notes DIR --import</code>.</div>
<textarea id="note" placeholder="What feels wrong here? “keep the voice” and similar instructions belong in the note too."></textarea>
<button id="copy">Copy note</button><button id="add">Add to list</button><button id="copyall">Copy list</button><button id="download">Download notes.json</button> <span class="meta" id="flash"></span>
<ol id="list" class="meta"></ol><pre id="out"></pre></div>
${nv.length ? `<div class="panel"><b>Not yet validated in this cut</b><ul class="plain">${nv.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
<h2>Notes</h2><div class="panel">${noteRows ? `<table><tr><th>Note</th><th>Text</th><th>Status · here</th></tr>${noteRows}</table>` : '<span class="meta">No notes yet.</span>'}</div>
<h2>Keeps</h2><div class="panel">${keepRows ? `<table><tr><th></th><th>Keep</th><th>Scope</th><th>Asked by</th><th></th></tr>${keepRows}</table>` : '<span class="meta">Nothing pinned.</span>'}</div>
<h2>Decisions</h2><div class="panel">${decisionRows ? `<table>${decisionRows}</table>` : '<span class="meta">No decisions recorded. Applied is not accepted: acceptance is recorded only when a person gives it.</span>'}</div>
</section><section>
<h2>Chapters and transcript</h2><div class="panel"><ol class="beats">${rows}</ol></div>
<h2>Revisions</h2><div class="panel"><table>${revRows}</table>${
    compares.length
      ? `<p>${compares
          .map(
            (c) =>
              `<a href="${esc(
                path
                  .relative(dir, path.join(compareDir, c, 'index.html'))
                  .split(path.sep)
                  .join('/'),
              )}">${esc(c)}</a>`,
          )
          .join(' · ')}</p>`
      : ''
  }</div>
</section></main>`;
  const data = {
    revision: meta.id,
    origin: 0,
    beats: timeline.beats.map((b) => ({
      id: b.id,
      start: b.start,
      end: b.end,
      chapter: b.chapter,
      words: b.words.map((w) => [w.w, w.t0, w.t1]),
    })),
  };
  writeAtomic(file, page(`${timeline.title} · ${meta.id}`, body, data));
  return file;
}

function videoBadge(video: RevisionVideo | null): string {
  if (!video) return '';
  const color = video.profile === 'final' ? 'ok' : 'warn';
  return `<span class="badge ${color}">${esc(video.profile)}</span>`;
}
function playerHTML(meta: RevisionMeta, src: string | null): string {
  if (src)
    return `<video id="player" controls preload="metadata" src="${esc(src)}"></video>`;
  const released = meta.videos?.length
    ? ' (released to save space; the record and inputs remain)'
    : '';
  const previews = meta.previews?.length
    ? 'Its previews are on its compare page.'
    : 'Render it to watch.';
  return `<div class="panel">No full video is kept for ${esc(meta.id)}${released}. ${previews}</div>`;
}
