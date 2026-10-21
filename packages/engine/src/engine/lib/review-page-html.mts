import path from 'node:path';
import { formatTime } from './notes.mjs';
const entities = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);
export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => entities.get(c) ?? c);
/** JSON safe inside <script type="application/json">: no tag can close it early. */
export const inertJSON = (v: unknown): string =>
  (JSON.stringify(v) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
/** A relative URL from a page directory to a stored object (validated, percent-encoded). */
export function objectUrl(
  root: string,
  rel: unknown,
  pageDir: string,
): string | null {
  if (!rel) return null;
  const parts = String(rel).split('/');
  if (
    !(
      parts.length === 4 &&
      parts[0] === 'review' &&
      parts[1] === 'objects' &&
      /^[0-9a-f]{2}$/.test(parts[2]) &&
      /^[0-9a-f]{64}(\.[a-z0-9]{1,8})?$/.test(parts[3])
    )
  )
    return null;
  return path
    .relative(pageDir, path.join(root, ...parts))
    .split(path.sep)
    .map(encodeURIComponent)
    .join('/');
}
export const t = (s: number | undefined): string =>
  s != null && Number.isFinite(s) ? formatTime(s) : '';

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

export const page = (title: string, body: string, data: unknown): string =>
  `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style><body>${body}<script type="application/json" id="data">${inertJSON(data)}</script><script>${SCRIPT}</script></body></html>\n`;
