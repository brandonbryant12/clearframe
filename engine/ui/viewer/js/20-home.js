// Home: say what you want made, and see every film. With the local server, making one creates a
// project folder, links an agent conversation to it and sends your words as the first message,
// then opens the film. Every step carries a durable id (the create request, the first message)
// kept until it is confirmed, so a refresh or a retry never makes two films or sends twice.

let S_HOME = { agent: false, catalog: null }, homeCleanup = null, creating = false;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
const FORM_KEY = 'cf-new-film';

/** Fresh films from the server: a film made a moment ago is listed without rebuilding the page. */
async function refreshFilms() {
  const r = await fetch('/api/films').then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (r?.films) { data.films = r.films; data.roots = r.roots; }
  return r;
}

const cover = f => f.versions.at(-1)?.poster ?? f.boards?.find(b => b.image)?.image ?? null;
const briefLine = md => { const lines = String(md ?? '').split('\n').map(l => l.replace(/[#*`]/g, '').trim()).filter(Boolean); return (lines.find(l => /^the one idea:/i.test(l)) ?? lines[1] ?? lines[0] ?? '').replace(/^the one idea:\s*/i, ''); };
const openNotes = f => notesOf(f).filter(n => n.state === 'open').length;
const toCheck = f => notesOf(f).filter(n => n.state === 'changed').length;

function home() {
  document.title = 'ClearFrame';
  app.innerHTML = `${header()}<section class="page"><div id="home-top"></div>
    <h2 class="films-h">${data.films.length ? 'Films' : ''}</h2><div class="grid" id="films"></div></section>`;
  drawFilms();
  mountHome();
}

function drawFilms() {
  const el = document.getElementById('films'); if (!el) return;
  // Films waiting on you first: changes to check, then cuts with no notes yet, then the rest by date.
  const weight = f => toCheck(f) ? 0 : f.versions.length && f.stage?.id !== 'final' && !openNotes(f) ? 1 : 2;
  const films = [...data.films].sort((a, b) => weight(a) - weight(b) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  el.innerHTML = films.length ? films.map(card).join('') : server ? '' : `<div class="empty">No films in ${esc(data.roots.join(', '))} yet.</div>`;
}

function card(f) {
  const img = cover(f), v = f.versions.at(-1), open = openNotes(f), check = toCheck(f);
  const status = check ? `<b class="hot">${plural(check, 'change')} to check</b>` : open ? plural(open, 'open note') : esc(f.stage?.next ?? '');
  return `<a class="card" href="#/film/${esc(f.id)}">
    <div class="poster ${f.shape}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="briefsnip">${esc(briefLine(f.brief) || 'No picture yet')}</span>`}</div>
    <div class="cbody"><div class="ctitle">${esc(f.title)}</div>
      <div class="cmeta"><span class="pill s-${esc(f.stage?.id ?? '')}">${esc(f.stage?.label ?? '')}</span>${v ? `<span>Version ${v.number}</span>` : ''}<span>${esc(when(f.updatedAt))}</span></div>
      <div class="cstatus">${status}</div></div></a>`;
}

async function mountHome() {
  let alive = true; homeCleanup = () => { alive = false; homeCleanup = null; };
  await serverReady;
  if (!alive || !server) return;
  const [films, catalog] = await Promise.all([refreshFilms(), agentOn ? call('/api/agent/catalog').catch(() => null) : null]);
  if (!alive || !document.getElementById('home-top')) return;
  S_HOME = { agent: agentOn, catalog, projects: films?.projects };
  drawFilms();
  if (!S_HOME.agent) return;
  homeForm();
  // A create interrupted by a refresh finishes with the same ids.
  const f = store.get(FORM_KEY, null);
  if (f?.request && f.started) createFilm(true);
}

function homeForm() {
  const el = document.getElementById('home-top'); if (!el) return;
  const f = store.get(FORM_KEY, null) ?? {};
  el.innerHTML = `<form class="make" id="nf" novalidate>
      <h1>What are we making?</h1>
      <textarea id="nf-idea" rows="3" placeholder="A 45-second explainer on why there are two high tides a day, for curious teenagers." aria-label="The idea">${esc(f.idea ?? '')}</textarea>
      <div class="makerow">
        <div class="seg" role="radiogroup" aria-label="Format">${[['landscape', 'Wide'], ['vertical', 'Tall']].map(([v, l]) => `<label><input type="radio" name="nf-format" value="${v}" ${(f.format ?? 'landscape') === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <button type="button" class="btn small" id="nf-add">Add files…</button><input type="file" id="nf-files" multiple hidden accept=".md,.markdown,.txt,.pdf,.docx,.html,.htm,.rtf,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.mov,.webm,.wav,.mp3,.m4a">
        <span class="grow"></span><button class="btn agent inline" type="submit" id="nf-go">Make it</button></div>
      <ul class="files" id="nf-list">${(f.documents ?? []).map(d => `<li>${esc(d)} <button type="button" class="link" data-remove="${esc(d)}" aria-label="Remove ${esc(d)}">Remove</button></li>`).join('')}</ul>
      <p class="muted small progress" id="nf-progress" role="status" aria-live="polite">The agent writes it and renders a first cut you can watch. Reports, scripts or pictures you add are read and used.</p>
    </form>`;
  const form = document.getElementById('nf');
  const save = () => { const cur = store.get(FORM_KEY, null) ?? {}; store.set(FORM_KEY, { ...cur, ...readForm() }); };
  form.addEventListener('input', save); form.addEventListener('change', save);
  form.addEventListener('submit', e => { e.preventDefault(); createFilm(); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'nf-idea') { e.preventDefault(); createFilm(); } });
  document.getElementById('nf-add').onclick = () => document.getElementById('nf-files').click();
  document.getElementById('nf-files').onchange = e => { const files = [...e.target.files]; e.target.value = ''; addSources(files); };
  syncGo();
  document.getElementById('nf-list').onclick = e => { const b = e.target.closest('[data-remove]'); if (!b) return; const cur = store.get(FORM_KEY, {}); cur.documents = (cur.documents ?? []).filter(d => d !== b.dataset.remove); store.set(FORM_KEY, cur); b.closest('li').remove(); };
}
function readForm() {
  return { idea: document.getElementById('nf-idea')?.value ?? '', title: '', playbook: '', treatment: '', audience: '', takeaway: '',
    format: document.querySelector('input[name="nf-format"]:checked')?.value ?? 'landscape', mode: 'oneshot' };
}
const progress = (text, tone = '') => { const p = document.getElementById('nf-progress'); if (p) { p.textContent = text; p.dataset.tone = tone; } };

/**
 * Files wait in a draft folder named by the create request until the film exists. Each upload is
 * bound to the draft it started in: its result is recorded only in that draft (never in a newer
 * form after a create), Make it waits for it, and it keeps going if you leave the page and come back.
 */
const drafts = new Map(); // request -> { pending: Map<id, { name, promise }> }
const draftOf = request => { if (!drafts.has(request)) drafts.set(request, { pending: new Map() }); return drafts.get(request); };
function updateDraft(request, fn) { const cur = store.get(FORM_KEY, null); if (!cur || cur.request !== request) return false; fn(cur); store.set(FORM_KEY, cur); return true; }
const pendingUploads = request => (request && drafts.get(request)?.pending.size) || 0;
function syncGo() {
  const req = store.get(FORM_KEY, null)?.request, n = pendingUploads(req), go = document.getElementById('nf-go');
  if (go) { go.disabled = creating || n > 0; go.textContent = n ? `Uploading ${plural(n, 'file')}…` : 'Make it'; }
  const list = document.getElementById('nf-list');
  if (list) for (const li of list.querySelectorAll('[data-pending]')) if (![...(drafts.get(req)?.pending.keys() ?? [])].includes(li.dataset.pending)) li.remove();
  if (list && req) for (const [id, u] of drafts.get(req)?.pending ?? []) if (!list.querySelector(`[data-pending="${id}"]`)) list.insertAdjacentHTML('beforeend', `<li data-pending="${id}">${esc(u.name)} <span class="muted">uploading…</span></li>`);
}
function addSources(files) {
  const cur = store.get(FORM_KEY, null) ?? {};
  cur.request ??= `req-${newId()}`; store.set(FORM_KEY, { ...cur, ...readForm(), request: cur.request });
  const request = cur.request, draft = draftOf(request);
  return Promise.all(files.map(f => {
    const id = newId();
    const promise = (async () => {
      try {
        const r = await fetch(`/api/upload?draft=${encodeURIComponent(request)}&name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'x-clearframe-upload': '1', 'content-type': 'application/octet-stream' }, body: f });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) { progress(`${f.name}: ${j.error ?? 'refused'}`, 'error'); return; }
        if (updateDraft(request, d => { d.documents = [...new Set([...(d.documents ?? []), j.file])]; })) {
          document.getElementById('nf-list')?.insertAdjacentHTML('beforeend', `<li>${esc(j.file)} <button type="button" class="link" data-remove="${esc(j.file)}" aria-label="Remove ${esc(j.file)}">Remove</button></li>`);
          progress(`Added ${j.file}.`);
        }
      } catch (e) { progress(`${f.name}: ${e.message}`, 'error'); }
      finally { draft.pending.delete(id); syncGo(); }
    })();
    draft.pending.set(id, { name: f.name, promise });
    syncGo();
    return promise;
  }));
}

/** The first message: the idea in the person's words, and what to do with the starter project. */
function firstMessage(f, film) {
  const pb = S_HOME.catalog?.playbooks?.find(p => p.id === f.playbook), tr = S_HOME.catalog?.treatments?.find(t => t.id === f.treatment);
  return [`Make this film: ${f.idea.trim() || '(see the source documents)'}`,
    f.title?.trim() && `Title: ${f.title.trim()}`, `Format: ${f.format === 'vertical' ? 'vertical 9:16' : 'landscape 16:9'}`,
    f.audience?.trim() && `Audience: ${f.audience.trim()}`, f.takeaway?.trim() && `Takeaway: ${f.takeaway.trim()}`,
    pb ? `Starting structure: ${pb.title}` : 'Starting structure: your choice (the project started from a general starter)', tr ? `Look: ${tr.title ?? tr.id}` : null,
    f.documents?.length ? `Files I gave (${f.documents.join(', ')}) are in the project: documents as ${(film.files ?? []).map(x => x.name).filter(n => /^source\//.test(n)).join(', ') || 'source/'} (summarised in BRIEF.md and EVIDENCE.md), pictures and media in ${(film.files ?? []).map(x => x.name).filter(n => /^assets\/uploads\//.test(n)).join(', ') || 'none'}. Read the documents with clearframe_files before writing; tie every number to its source.` : null,
    '', `The project "${film.title}" starts from a playbook with sample scenes, narration, numbers and sources. Replace all of it with this film's own: rewrite or replace every scene and its narration, remove sample figures and sources, keep it a film rather than slides, and group the work into a few clearly labelled edits. Where a picture is not designed yet, mark that scene "placeholder" with what it should become; never leave sample content.`,
    f.mode === 'together'
      ? 'We are building this together. Read the brief and sources, then propose a short plan: the scenes in order (one line each, with what the picture does), the look, and the voice. Change nothing yet; end by asking me to confirm or adjust.'
      : 'Start with clearframe_guide topic authoring (short). Then make the first cut I can watch: queue a rough cut with clearframe_render (kind draft), follow it with clearframe_job until it finishes, fix any engine errors it reports and queue it again if needed. Finish by telling me briefly, in plain words, what the cut contains and which scenes are still placeholders. I will watch it and leave notes on the moments I want changed.'].filter(x => x != null && x !== false && x !== '').join('\n');
}

async function createFilm(resume = false) {
  if (creating) return;
  let cur = { ...(store.get(FORM_KEY, null) ?? {}), ...(resume ? {} : readForm()) };
  // Files still uploading belong to this draft: wait for them so the film and its brief include them.
  if (pendingUploads(cur.request)) {
    creating = true; syncGo(); progress(`Waiting for ${plural(pendingUploads(cur.request), 'file')} to finish uploading…`);
    await Promise.allSettled([...draftOf(cur.request).pending.values()].map(u => u.promise));
    creating = false;
    cur = { ...(store.get(FORM_KEY, null) ?? {}), ...(resume ? {} : readForm()) };
  }
  if (!cur.idea?.trim() && !cur.documents?.length) { progress('Say what the film is about, or add a document.', 'error'); document.getElementById('nf-idea')?.focus(); syncGo(); return; }
  creating = true;
  const go = document.getElementById('nf-go'); if (go) go.disabled = true;
  cur.request ??= `req-${newId()}`; cur.submission ??= newSubmission(); cur.started = true;
  cur.mode ??= 'oneshot';
  store.set(FORM_KEY, cur);
  try {
    progress(resume ? 'Finishing the film you started…' : 'Making the project…');
    const made = await call('/api/projects', { request: cur.request, idea: cur.idea, title: cur.title, playbook: cur.playbook || undefined, treatment: cur.treatment || undefined,
      format: cur.format, mode: cur.mode, audience: cur.audience, takeaway: cur.takeaway, documents: cur.documents ?? [] });
    await refreshFilms();
    progress('Starting the agent…');
    const film = made.film ?? data.films.find(x => x.id === made.id) ?? { title: cur.title || 'the film' };
    const first = { id: cur.submission, submission: cur.submission, text: firstMessage(cur, film), scope: { kind: 'film' }, delivery: 'queue', hash: null, t: 0 };
    try { await call('/api/agent/prompt', { film: made.id, ...first }); }
    catch (e) {
      // The film exists: open it with the message waiting in its outbox (same id), shown as not sent with the reason.
      store.set(`cf-agent-outbox:${made.id}`, [...store.get(`cf-agent-outbox:${made.id}`, []).filter(o => o.id !== first.id), { ...first, failed: e.message }]);
    }
    store.set(FORM_KEY, null); drafts.delete(cur.request);
    location.hash = `#/film/${made.id}`;
  } catch (e) {
    progress(`${e.message}${e.status >= 500 || !e.status ? ' — your words are kept; try again.' : ''}`, 'error');
  } finally { creating = false; syncGo(); }
}
