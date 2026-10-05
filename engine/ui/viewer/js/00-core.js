// Shared state and helpers. Files in this folder are inlined in name order into one script scope.
const data = JSON.parse(document.getElementById('data').textContent);
const app = document.getElementById('app'), box = document.getElementById('lightbox');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const when = iso => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const clock = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const length = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const bytes = n => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
const fontById = Object.fromEntries(data.library.fonts.map(f => [f.id, f]));
const fontName = id => fontById[id] ? `${fontById[id].family} ${fontById[id].style}` : 'Unknown font';
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let server = false, stopLoop = null;
const serverReady = location.protocol.startsWith('http') ? fetch('/api/ping').then(r => { server = r.ok; }).catch(() => {}) : Promise.resolve();

/** POST to the local viewer server; throws the server's message on failure. */
async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? 'Could not save');
  return json;
}

document.getElementById('stamp').textContent = `Updated ${when(data.generatedAt)}`;
const tabs = active => { for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === active)); };
const qualityChip = v => `<span class="chip ${v.quality === 'Final' ? 'final' : ''}">${esc(v.quality)}</span>`;
const approvedChip = v => v.approved ? `<span class="chip approved">✓ Approved${v.approved.by ? ` by ${esc(v.approved.by)}` : ''}</span>` : '';
const versionName = v => `Version ${v.number}${v.label ? ` · ${esc(v.label)}` : ''}`;

function lightbox(html) { box.innerHTML = `<div class="frame">${html}</div>`; box.hidden = false; box.querySelector('[data-close]')?.focus(); }
function close() { box.querySelectorAll('video,audio').forEach(m => m.pause()); box.hidden = true; box.innerHTML = ''; }
box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
