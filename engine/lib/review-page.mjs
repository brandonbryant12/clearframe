// Static review pages, opened straight from disk (no server, no dependencies):
//   review/index.html                 the latest watchable revision: player, chapters and
//                                     transcript, notes, keeps, decisions, revision history
//   review/revisions/rNNN/index.html  the same for an older revision
//   review/compare/A-B/index.html     before/after passages and the impact report
// A note written on a page is copied (or downloaded) stamped with the revision and playhead,
// e.g. "[ClearFrame r003 @ 2:13.40 · s047] …", which `note` and `notes --import` read back.
// Every string from a project (notes, transcript, ids) is escaped; data for the page's script
// is embedded as inert JSON and only ever written into the page with textContent.
import fs from 'node:fs';
import path from 'node:path';
import { listRevisions, loadRevision, revisionVideo } from './revisions.mjs';
import { readNotes, readKeeps, readDecisions, locate, acceptance, formatTime } from './notes.mjs';
import { ID, reviewPath, writeAtomic } from './store.mjs';

export const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** JSON safe inside <script type="application/json">: no tag can close it early. */
export const inertJSON = v =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** A relative URL from a page directory to a stored object (validated, percent-encoded). */
function objectUrl(root, rel, pageDir) {
  if (!rel) return null;
  const parts = String(rel).split('/');
  if (!(parts.length === 4 && parts[0] === 'review' && parts[1] === 'objects' && /^[0-9a-f]{2}$/.test(parts[2]) && /^[0-9a-f]{64}(\.[a-z0-9]{1,8})?$/.test(parts[3])))
    return null;
  return path
    .relative(pageDir, path.join(root, ...parts))
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');
}
const t = s => (Number.isFinite(s) ? formatTime(s) : '');

const STYLE = `
:root{color-scheme:dark;--bg:#12161d;--panel:#1b222c;--line:#2b3542;--ink:#eef1f4;--muted:#9aa8b8;--accent:#7cc4ff;--warn:#ffcf6e;--bad:#ff8a80;--ok:#8be0a4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
header{padding:20px 28px;border-bottom:1px solid var(--line)}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:22px 0 8px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(320px,1fr);gap:24px;padding:20px 28px}@media(max-width:1000px){main{grid-template-columns:1fr}}
video{width:100%;background:#000;border-radius:8px}.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin-bottom:16px}
.meta{color:var(--muted);font-size:13px}.badge{display:inline-block;font-size:12px;padding:1px 7px;border-radius:999px;border:1px solid var(--line);margin-left:6px;color:var(--muted)}
.badge.warn{color:var(--warn);border-color:var(--warn)}.badge.bad{color:var(--bad);border-color:var(--bad)}.badge.ok{color:var(--ok);border-color:var(--ok)}
ol.beats{list-style:none;padding:0;margin:0;max-height:62vh;overflow:auto}ol.beats li{padding:8px 10px;border-radius:8px;cursor:pointer;border:1px solid transparent}
ol.beats li:hover{background:#222b37}ol.beats li.now{border-color:var(--accent);background:#1d2a39}.tc{font-family:ui-monospace,Menlo,monospace;color:var(--accent);font-size:13px}
.chapter{margin:14px 0 4px;font-weight:600;color:var(--muted)}textarea{width:100%;min-height:72px;background:#0e1218;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit}
button{background:#25303d;color:var(--ink);border:1px solid var(--line);border-radius:8px;padding:6px 12px;font:inherit;cursor:pointer;margin:6px 6px 0 0}button:hover{border-color:var(--accent)}
.playhead{font-family:ui-monospace,Menlo,monospace;font-size:13px;margin:8px 0}table{border-collapse:collapse;width:100%;font-size:13px}td,th{text-align:left;padding:5px 6px;border-bottom:1px solid var(--line);vertical-align:top}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:900px){.pair{grid-template-columns:1fr}}pre{white-space:pre-wrap;font-size:13px;color:var(--muted)}
.quote{color:var(--muted);font-style:italic}ul.plain{padding-left:18px;margin:6px 0}a{color:var(--accent)}
`;

const SCRIPT = `
const D = JSON.parse(document.getElementById('data').textContent);
const v = document.getElementById('player');
const fmt = s => { const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + r.toFixed(2).padStart(5, '0'); };
const beatAt = s => D.beats.find(b => s >= b.start && s < b.end) || D.beats[D.beats.length - 1];
const wordsNear = (b, s) => { const w = b.words; if (!w.length) return ''; let k = w.findIndex(x => s >= x[1] && s < x[2]); if (k < 0) k = w.findIndex(x => x[1] >= s); if (k < 0) k = w.length - 1; return w.slice(Math.max(0, k - 2), k + 3).map(x => x[0]).join(' '); };
const head = document.getElementById('playhead');
const items = [...document.querySelectorAll('ol.beats li[data-start]')];
function now() { return v ? v.currentTime + (D.origin || 0) : 0; }
function tick() {
  if (!v) return; const s = now(), b = beatAt(s);
  head.textContent = D.revision + ' @ ' + fmt(s) + ' · ' + b.id + (b.chapter ? ' · ' + b.chapter : '') + ' · “' + wordsNear(b, s) + '”';
  for (const li of items) li.classList.toggle('now', li.dataset.id === b.id);
}
if (v) { v.addEventListener('timeupdate', tick); v.addEventListener('seeked', tick); }
for (const li of items) li.addEventListener('click', () => { if (v) { v.currentTime = Math.max(0, Number(li.dataset.start) - (D.origin || 0) + 0.001); v.play(); } });
const box = document.getElementById('note'), list = document.getElementById('list'), queued = [];
function stamp() { const s = now(), b = beatAt(s); return { revision: D.revision, at: Math.round(s * 1000) / 1000, beat: b.id, quote: wordsNear(b, s), text: box.value.trim() }; }
function line(n) { return '[ClearFrame ' + n.revision + ' @ ' + fmt(n.at) + ' · ' + n.beat + ' · “' + n.quote + '”] ' + n.text; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); flash('Copied. Paste it into the chat.'); }
  catch { const a = document.createElement('textarea'); a.value = text; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); flash('Copied.'); } catch { flash('Select and copy the text below.'); } a.remove(); }
  document.getElementById('out').textContent = text;
}
function flash(m) { const f = document.getElementById('flash'); f.textContent = m; setTimeout(() => (f.textContent = ''), 2500); }
const go = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
go('copy', () => { const n = stamp(); if (!n.text) return flash('Write the note first.'); copy(line(n)); });
go('add', () => { const n = stamp(); if (!n.text) return flash('Write the note first.'); queued.push(n); const li = document.createElement('li'); li.textContent = line(n); list.appendChild(li); box.value = ''; });
go('copyall', () => copy(queued.map(line).join('\\n')));
go('download', () => { const blob = new Blob([JSON.stringify({ clearframe: 'notes/1', notes: queued.map(({ quote, ...n }) => n) }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'notes-' + D.revision + '.json'; a.click(); });
for (const b of document.querySelectorAll('button[data-reply]')) b.addEventListener('click', () => copy(b.dataset.reply));
const both = document.getElementById('playboth');
if (both) both.addEventListener('click', () => { for (const p of document.querySelectorAll('video.pairplay')) { p.currentTime = 0; p.play(); } });
tick();
`;

const page = (title, body, data) =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style><body>${body}<script type="application/json" id="data">${inertJSON(data)}</script><script>${SCRIPT}</script></body></html>\n`;

function notValidated(meta, video) {
  const nv = [];
  const receipt = video?.receiptData?.notValidated;
  for (const p of meta.placeholders ?? []) nv.push(`${p.beat}: placeholder (${p.reason})`);
  for (const u of meta.unfinished ?? []) nv.push(`${u.beat}: ${u.element} marked unfinished${u.note ? ` (${u.note})` : ''}`);
  if (meta.estimatedTiming?.length) nv.push(`estimated word timing in ${meta.estimatedTiming.length} beat(s): ${meta.estimatedTiming.slice(0, 8).join(', ')}${meta.estimatedTiming.length > 8 ? '…' : ''}`);
  if (receipt?.craft?.length) nv.push(...receipt.craft.map(c => `craft: ${c}`));
  if (receipt?.audit && receipt.audit !== 'run') nv.push(`frame audit: ${receipt.audit}`);
  return nv;
}
const readReceipt = (root, v) => {
  try {
    const parts = String(v?.receipt ?? '').split('/');
    return v?.receipt ? JSON.parse(fs.readFileSync(path.join(root, ...parts), 'utf8')) : null;
  } catch {
    return null;
  }
};

/** Write the review page for `rev` (default: the newest revision with a kept video). */
export function writeReviewPage(root, { rev } = {}) {
  const revs = listRevisions(root);
  if (!revs.length) return null;
  const chosen = rev ? revs.find(r => r.id === rev) : ([...revs].reverse().find(r => (r.videos ?? []).some(v => v.retained !== false)) ?? revs.at(-1));
  if (!chosen) throw new Error(`No revision ${rev}.`);
  const { meta, timeline } = loadRevision(root, chosen.id);
  const isLatestPage = !rev;
  const file = isLatestPage ? reviewPath(root, 'index.html') : reviewPath(root, 'revisions', meta.id, 'index.html');
  const dir = path.dirname(file);
  const video = revisionVideo(root, meta);
  if (video) video.receiptData = readReceipt(root, video);
  const src = video ? objectUrl(root, video.object, dir) : null;
  const notes = readNotes(root),
    keeps = readKeeps(root),
    decisions = readDecisions(root);
  const accepted = acceptance(root, timeline);
  const openBy = {};
  const located = notes.map(n => {
    let where;
    try {
      where = n.revision === meta.id ? { state: 'current', beat: n.anchor?.beat } : locate(root, n, { id: meta.id, timeline });
    } catch (e) {
      where = { state: 'unknown', reason: e.message };
    }
    if (where.beat && ['open', 'question'].includes(n.status)) openBy[where.beat] = (openBy[where.beat] ?? 0) + 1;
    return { n, where };
  });
  let chapter;
  const rows = timeline.beats
    .map(b => {
      const head = b.chapter && b.chapter !== chapter ? `<div class="chapter">${esc(b.chapter)}</div>` : '';
      chapter = b.chapter ?? chapter;
      const a = accepted[b.id];
      const badges = [
        b.placeholder ? `<span class="badge warn" title="${esc(b.placeholder)}">placeholder</span>` : '',
        b.vo && b.vo.timing !== 'measured' ? '<span class="badge warn">estimated timing</span>' : '',
        a ? `<span class="badge ${a.state === 'changed' ? 'bad' : 'ok'}">${esc(a.state === 'accepted' ? `accepted by ${a.by}` : a.state)}</span>` : '',
        openBy[b.id] ? `<span class="badge">${openBy[b.id]} open note(s)</span>` : '',
      ].join('');
      return `${head}<li data-id="${esc(b.id)}" data-start="${Number(b.start)}"><span class="tc">${t(b.start)}</span> <b>${esc(b.id)}</b>${b.speaker ? ` <span class="meta">${esc(b.speaker)}</span>` : ''} <span class="meta">${esc(b.block ?? '')}</span>${badges}<div>${esc(b.vo?.text ?? b.visual ?? '')}</div></li>`;
    })
    .join('');
  const noteRows = located
    .map(
      ({ n, where }) =>
        `<tr><td><b>${esc(n.id)}</b><br><span class="meta">${esc(n.revision)}${n.anchor ? ` @ ${t(n.anchor.at)}` : ''}</span></td><td>${esc(n.text)}${n.anchor?.words ? `<div class="quote">“${esc(n.anchor.words)}”</div>` : ''}${n.keep?.length ? `<div class="meta">keep: ${esc(n.keep.join(', '))}</div>` : ''}</td><td>${esc(n.status)}${n.resolution?.revision ? ` → ${esc(n.resolution.revision)}` : ''}<br><span class="badge ${['stale', 'orphaned'].includes(where.state) ? 'bad' : where.state === 'changed' ? 'warn' : ''}">${esc(where.state)}</span>${where.reason ? `<div class="meta">${esc(where.reason)}</div>` : ''}</td></tr>`,
    )
    .join('');
  const keepRows = keeps
    .map(
      k =>
        `<tr><td>${esc(k.id)}</td><td>${esc(k.what)}</td><td>${esc(k.scope.film ? 'whole film' : k.scope.beats.join(', '))}</td><td>${esc(k.by?.name ?? k.by?.role)}${k.said ? `<div class="quote">“${esc(k.said)}”</div>` : ''}</td><td>${k.active ? 'active' : 'released'}</td></tr>`,
    )
    .join('');
  const decisionRows = decisions
    .slice(-12)
    .reverse()
    .map(
      d =>
        `<tr><td>${esc(d.id)}</td><td>${esc(d.action)}${d.role === 'agent' ? ' <span class="badge warn">agent decision, not a person’s acceptance</span>' : ''}</td><td>${esc(d.revision)}</td><td>${esc(d.by ?? d.role)}${d.said ? `<div class="quote">“${esc(d.said)}”</div>` : d.reason ? `<div class="meta">${esc(d.reason)}</div>` : ''}</td></tr>`,
    )
    .join('');
  const compareDir = reviewPath(root, 'compare');
  const compares = fs.existsSync(compareDir)
    ? fs
        .readdirSync(compareDir)
        .filter(d => /^[a-z0-9-]+$/i.test(d) && fs.existsSync(path.join(compareDir, d, 'index.html')))
        .sort()
    : [];
  const revRows = [...revs]
    .reverse()
    .map(r => {
      const v = (r.videos ?? []).find(x => x.retained !== false);
      return `<tr><td><b>${esc(r.id)}</b>${r.id === meta.id ? ' <span class="badge ok">shown</span>' : ''}</td><td>${esc(r.kind)}${r.label ? ` · ${esc(r.label)}` : ''}</td><td>${esc(r.createdAt.replace('T', ' ').slice(0, 16))}</td><td>${v ? esc(v.profile) : (r.videos ?? []).length ? 'video released' : r.previews?.length ? 'previews only' : 'no video'}</td><td>${esc(r.reason ?? '')}</td></tr>`;
    })
    .join('');
  const nv = notValidated(meta, video);
  const body = `<header><h1>${esc(timeline.title)} <span class="badge">${esc(meta.id)}</span>${video ? `<span class="badge ${video.profile === 'final' ? 'ok' : 'warn'}">${esc(video.profile)}</span>` : ''}</h1>
<div class="meta">${esc(meta.kind)}${meta.label ? ` · ${esc(meta.label)}` : ''} · saved ${esc(meta.createdAt.replace('T', ' ').slice(0, 19))} · ${t(timeline.duration)} · ${timeline.beats.length} beats · ${esc(timeline.width)}×${esc(timeline.height)} @ ${esc(timeline.fps)} fps${meta.parent ? ` · after ${esc(meta.parent)}` : ''}</div></header>
<main><section>
${src ? `<video id="player" controls preload="metadata" src="${esc(src)}"></video>` : `<div class="panel">No full video is kept for ${esc(meta.id)}${(meta.videos ?? []).length ? ' (released to save space; the record and inputs remain)' : ''}. ${meta.previews?.length ? 'Its previews are on its compare page.' : 'Render it to watch.'}</div>`}
<div class="playhead" id="playhead"></div>
<div class="panel"><b>Note at the playhead</b><div class="meta">Stamped with ${esc(meta.id)}, the time, the beat and the words around it. Paste into the chat, or download several as a file for <code>notes DIR --import</code>.</div>
<textarea id="note" placeholder="What feels wrong here? “keep the voice” and similar instructions belong in the note too."></textarea>
<button id="copy">Copy note</button><button id="add">Add to list</button><button id="copyall">Copy list</button><button id="download">Download notes.json</button> <span class="meta" id="flash"></span>
<ol id="list" class="meta"></ol><pre id="out"></pre></div>
${nv.length ? `<div class="panel"><b>Not yet validated in this cut</b><ul class="plain">${nv.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
<h2>Notes</h2><div class="panel">${noteRows ? `<table><tr><th>Note</th><th>Text</th><th>Status · here</th></tr>${noteRows}</table>` : '<span class="meta">No notes yet.</span>'}</div>
<h2>Keeps</h2><div class="panel">${keepRows ? `<table><tr><th></th><th>Keep</th><th>Scope</th><th>Asked by</th><th></th></tr>${keepRows}</table>` : '<span class="meta">Nothing pinned.</span>'}</div>
<h2>Decisions</h2><div class="panel">${decisionRows ? `<table>${decisionRows}</table>` : '<span class="meta">No decisions recorded. Applied is not accepted: acceptance is recorded only when a person gives it.</span>'}</div>
</section><section>
<h2>Chapters and transcript</h2><div class="panel"><ol class="beats">${rows}</ol></div>
<h2>Revisions</h2><div class="panel"><table>${revRows}</table>${compares.length ? `<p>${compares.map(c => `<a href="${esc(path.relative(dir, path.join(compareDir, c, 'index.html')).split(path.sep).join('/'))}">${esc(c)}</a>`).join(' · ')}</p>` : ''}</div>
</section></main>`;
  const data = {
    revision: meta.id,
    origin: 0,
    beats: timeline.beats.map(b => ({ id: b.id, start: b.start, end: b.end, chapter: b.chapter, words: b.words.map(w => [w.w, w.t0, w.t1]) })),
  };
  writeAtomic(file, page(`${timeline.title} · ${meta.id}`, body, data));
  return file;
}

/** The before/after page for an impact report and its rendered passages. */
export function writeComparePage(root, { A, B, report, passages = [], note }) {
  const to = B.meta?.id ?? 'working';
  if (!ID.revision.test(A.meta.id) || !(to === 'working' || ID.revision.test(to))) throw new Error('Invalid revision ids for a compare page.');
  const dir = reviewPath(root, 'compare', `${A.meta.id}-${to}`);
  fs.mkdirSync(dir, { recursive: true });
  const url = rel => objectUrl(root, rel, dir);
  const side = (label, p, T) =>
    p
      ? `<figure><figcaption><b>${esc(label)}</b> <span class="meta">${t(p.range?.seconds?.[0])}–${t(p.range?.seconds?.[1])} of ${esc(p.revision ?? to)}</span></figcaption>${url(p.object) ? `<video class="pairplay" controls preload="metadata" src="${esc(url(p.object))}"></video>` : '<div class="meta">missing</div>'}
<div class="meta">${esc(p.from ?? 'rendered from the full prepared timeline (all neighbours, worlds and transitions in place)')}${p.verified ? ` · clock checked at frames ${p.verified.map(v => `${v.film} (${Number.isFinite(v.psnr) ? v.psnr.toFixed(1) : '∞'} dB)`).join(', ')}` : ''}${p.audio ? ` · audio cut from the full mix (film ${esc(p.audio.film?.integrated)} LUFS, this stretch ${esc(p.audio.stretch?.integrated)} LUFS)` : ''}</div>
<div class="meta">${esc((p.beats ?? []).map(b => b.id).join(' · '))}${T ? '' : ''}</div></figure>`
      : `<figure><figcaption><b>${esc(label)}</b></figcaption><div class="meta">Nothing here on this side.</div></figure>`;
  const pairs = passages
    .map(
      (p, i) =>
        `<div class="panel"><b>Passage ${i + 1}</b> <span class="meta">${esc(p.beats.join(', '))}${p.removed?.length ? ` · removed: ${esc(p.removed.join(', '))}` : ''}</span><div class="pair">${side(`Before (${A.meta.id})`, p.before, A.timeline)}${side(`After (${to})`, p.after, B.timeline)}</div></div>`,
    )
    .join('');
  const beatRows = report.beats
    .filter(x => x.status !== 'unchanged')
    .map(x => `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.status)}</td><td>${esc((x.reasons ?? []).join('; '))}${x.text ? `<div class="quote">“${esc(x.text)}”</div>` : ''}</td></tr>`)
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
${note ? `<div class="panel"><b>Note ${esc(note.id)}</b> <span class="meta">on ${esc(note.revision)}${note.anchor ? ` @ ${t(note.anchor.at)} · ${esc(note.anchor.beat)}` : ''}</span><div>${esc(note.text)}</div>${note.anchor?.words ? `<div class="quote">“${esc(note.anchor.words)}”${note.anchor.source ? ` · recording ${t(note.anchor.source.original[0])}–${t(note.anchor.source.original[1])}` : ''}</div>` : ''}${note.keep?.length ? `<div class="meta">keep: ${esc(note.keep.join(', '))}</div>` : ''}</div>` : ''}
<div class="panel"><b>What changed</b><ul class="plain">${report.summary.map(s => `<li>${esc(s)}</li>`).join('')}</ul>${beatRows ? `<table><tr><th>Beat</th><th>Change</th><th>Why</th></tr>${beatRows}</table>` : ''}</div>
${passages.length ? `<button id="playboth">Play before and after together</button>` : ''}${pairs || '<div class="panel meta">No passages rendered.</div>'}
${replies.length ? `<div class="panel"><b>Reply</b><div class="meta">Copies a line to paste into the chat; finish it with your words. Acceptance is recorded only from your reply.</div>${replies.map(([l, r]) => `<button data-reply="${esc(r)}">${esc(l)}</button>`).join('')}<pre id="out"></pre><span id="flash" class="meta"></span></div>` : ''}
<p><a href="${esc(path.relative(dir, reviewPath(root, 'index.html')).split(path.sep).join('/'))}">Back to the review page</a></p>
</section></main>`;
  const file = path.join(dir, 'index.html');
  writeAtomic(file, page(`${A.meta.id} → ${to}`, body, { revision: B.meta?.id ?? A.meta.id, origin: 0, beats: [] }));
  fs.writeFileSync(path.join(dir, 'compare.json'), JSON.stringify({ from: A.meta.id, to, note: note?.id ?? null, report, passages }, null, 2) + '\n');
  return file;
}
