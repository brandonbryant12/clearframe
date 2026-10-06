// Shared state and helpers. Files in this folder are inlined in name order into one script scope.
// The page does three things: show films, take sticky notes on them, and talk to an agent about them.
const data = JSON.parse(document.getElementById('data').textContent);
const app = document.getElementById('app'), sheetEl = document.getElementById('sheet'), toastEl = document.getElementById('toast');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const when = iso => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const clock = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const myName = () => store.get('cf-name', '');
// With `viewer --serve` notes save into each film and the agent is one message away; opened as a
// file, notes stay in this browser and travel to your agent as a message you copy.
let server = false, agentOn = false, stopPage = null;
const serverReady = location.protocol.startsWith('http')
  ? fetch('/api/ping').then(r => r.json()).then(j => { server = !!j.ok; }).then(() => fetch('/api/agent/status')).then(r => r.ok ? r.json() : null).then(j => { agentOn = !!j?.enabled; }).catch(() => {})
  : Promise.resolve();

/** GET (no body) or POST JSON to the local server; errors carry the server's message and status. */
async function call(url, body) {
  const r = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status, data: j });
  return j;
}

/** A centred sheet over the page; Escape or a click outside closes it. */
function sheet(html) {
  sheetEl.innerHTML = `<div class="sheetcard" role="dialog" aria-modal="true">${html}</div>`;
  sheetEl.hidden = false;
  return sheetEl.querySelector('.sheetcard');
}
const closeSheet = () => { sheetEl.hidden = true; sheetEl.innerHTML = ''; };
sheetEl.addEventListener('click', e => { if (e.target === sheetEl || e.target.closest('[data-close]')) closeSheet(); });

let toastTimer = 0;
function toast(html, ms = 3000) {
  toastEl.innerHTML = html; toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
}

/** Your name, asked once: notes and decisions saved in a film record who made them. */
function askName(why = 'Notes and decisions record who made them.') {
  if (myName()) return Promise.resolve(myName());
  return new Promise(resolve => {
    const card = sheet(`<h2>What's your name?</h2><p class="muted">${esc(why)}</p><input class="field" id="name-in" autocomplete="name" placeholder="Your name">
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="name-ok">Continue</button></div>`);
    const input = card.querySelector('#name-in'), ok = () => { const n = input.value.trim(); if (!n) return input.focus(); store.set('cf-name', n); closeSheet(); resolve(n); };
    card.querySelector('#name-ok').onclick = ok;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    input.focus();
    sheetEl.addEventListener('click', function gone() { if (sheetEl.hidden) { sheetEl.removeEventListener('click', gone); resolve(myName() || null); } });
  });
}

/** A small Markdown reader for briefs and the agent's replies: headings, bold, code, lists, paragraphs. */
function markdown(md) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let list = false;
  for (const line of String(md ?? '').split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/), li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (!li && list) { out.push('</ul>'); list = false; }
    if (h) out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
    else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
}

const header = f => `<header class="bar">${f ? '<a class="home" href="#/">← Films</a>' : '<span class="brand">ClearFrame</span>'}${f ? `<span class="crumb">${esc(f.title)}</span><span class="pill s-${esc(f.stage?.id ?? '')}">${esc(f.stage?.label ?? '')}</span>` : ''}<span class="grow"></span><span id="barright"></span></header>`;
