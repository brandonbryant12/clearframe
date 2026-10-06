// Home: start a film from an idea. With the local server, creating one makes a project folder,
// links an OpenCode conversation and sends the brief as its first message, then opens the studio
// with the conversation beside the picture. Every step carries a durable id (the create request,
// the first submission) kept until it is confirmed, so a refresh or a retry never makes two films
// or sends the brief twice.

let S_HOME = { agent: false }, homeCleanup = null, creating = false;
const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');
const FORM_KEY = 'cf-new-film';

/** Fresh films from the server: a film made a moment ago is listed without rebuilding the page. */
async function refreshFilms() {
  const r = await fetch('/api/films').then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (r?.films) { data.films = r.films; data.roots = r.roots; }
  return r;
}

async function mountHome() {
  let alive = true; homeCleanup = () => { alive = false; homeCleanup = null; };
  await serverReady;
  if (!alive || !server) return;
  const [films, status, catalog] = await Promise.all([refreshFilms(), call('/api/agent/status').catch(() => null), call('/api/agent/catalog').catch(() => null)]);
  if (!alive || !document.getElementById('home-top')) return;
  S_HOME = { agent: !!status?.enabled, status, catalog, projects: films?.projects ?? status?.projects };
  board();
  if (!S_HOME.agent) { if (status?.disabled && status.disabled !== 'Started with --no-agent.') document.getElementById('home-top').innerHTML = `<p class="empty">${esc(status.disabled)}</p>`; return; }
  homeForm();
  // A create interrupted by a refresh finishes with the same ids.
  const f = store.get(FORM_KEY, null);
  if (f?.request && f.started) createFilm(true);
}

function homeForm() {
  const el = document.getElementById('home-top'); if (!el) return;
  const f = store.get(FORM_KEY, null) ?? {};
  const pb = S_HOME.catalog?.playbooks ?? [], tr = S_HOME.catalog?.treatments ?? [];
  const rt = S_HOME.status?.runtime;
  el.innerHTML = `<section class="home-hero" aria-labelledby="home-h">
    <div class="home-intro"><p class="home-kicker">ClearFrame studio</p><h1 id="home-h">What are we making?</h1>
      <p class="lede">Describe the film. ClearFrame makes the project and its own agent conversation; the agent writes it and renders a full-length rough cut you can watch, change by hand, or keep talking through. Explainers, research digests, podcast clips, lessons, product reveals, reports, trailers.</p></div>
    <form class="home-form" id="nf" novalidate>
      <label class="home-label" for="nf-idea">The idea</label>
      <textarea id="nf-idea" rows="4" placeholder="A 45-second explainer on why there are two high tides a day, for curious teenagers. Start on a beach at dawn; end with the Moon and the far-side bulge." required>${esc(f.idea ?? '')}</textarea>
      <div class="home-grid">
        <label><span>Title <span class="home-opt">optional</span></span><input id="nf-title" value="${esc(f.title ?? '')}" placeholder="Why the tide turns twice" maxlength="100"></label>
        <fieldset class="home-format"><legend>Format</legend><div>${[['landscape', 'Landscape', '16:9'], ['vertical', 'Vertical', '9:16']].map(([v, l, r]) => `<label><input type="radio" name="nf-format" value="${v}" ${(f.format ?? 'landscape') === v ? 'checked' : ''}><span><b>${l}</b> ${r}</span></label>`).join('')}</div></fieldset>
        <label>Kind of film<select id="nf-playbook"><option value="">Let the agent choose</option>${pb.map(p => `<option value="${esc(p.id)}" ${f.playbook === p.id ? 'selected' : ''}>${esc(p.title)}</option>`).join('')}</select></label>
        <label>Look<select id="nf-treatment"><option value="">Let the agent choose</option>${tr.map(t => `<option value="${esc(t.id)}" ${f.treatment === t.id ? 'selected' : ''}>${esc(t.title ?? t.id)}</option>`).join('')}</select></label>
      </div>
      <fieldset class="home-mode"><legend>How should the agent work?</legend><div>${[['oneshot', 'Make it for me', 'It writes the film and renders a full-length rough cut, then reports. You review, then refine.'], ['together', 'Build it together', 'It reads the brief, proposes a plan and asks before each step. You decide as it goes.']]
        .map(([v, t, d]) => `<label><input type="radio" name="nf-mode" value="${v}" ${(f.mode ?? 'oneshot') === v ? 'checked' : ''}><span><b>${t}</b>${d}</span></label>`).join('')}</div><p class="meta">You can switch at any time in the studio.</p></fieldset>
      <details class="home-more" ${f.audience || f.takeaway ? 'open' : ''}><summary>Audience and takeaway</summary><div class="home-grid two">
        <label>Who it is for<input id="nf-audience" value="${esc(f.audience ?? '')}" placeholder="Curious teenagers, no physics background"></label>
        <label>What they should remember<input id="nf-takeaway" value="${esc(f.takeaway ?? '')}" placeholder="Two bulges: one toward the Moon, one away"></label></div></details>
      <div class="home-sources"><button type="button" class="btn" id="nf-add">Add source documents…</button><input type="file" id="nf-files" multiple hidden accept=".md,.markdown,.txt,.pdf,.docx,.html,.htm,.rtf,.csv,.json">
        <span class="meta">Reports, scripts, transcripts or notes (PDF, DOCX, Markdown, text, HTML, CSV). The agent reads them; numbers stay tied to their sources.</span>
        <ul class="home-files" id="nf-list">${(f.documents ?? []).map(d => `<li>${esc(d)} <button type="button" class="link" data-remove="${esc(d)}" aria-label="Remove ${esc(d)}">Remove</button></li>`).join('')}</ul></div>
      <div class="home-go"><span class="home-agent" title="${esc(rt?.error ?? '')}"><i class="dot s-${esc(rt?.state ?? 'stopped')}"></i>Agent: Big Pickle (free, OpenCode Zen) · OpenCode ${esc(rt?.version ?? '2.0.24')}${rt?.state === 'error' ? ' · needs attention' : ''}</span>
        <button class="btn primary" type="submit" id="nf-go">Create and start building</button></div>
      <div class="home-progress" id="nf-progress" role="status" aria-live="polite"></div>
      <p class="meta home-where">New films are folders in <code>${esc(S_HOME.projects ?? 'projects')}/</code>. Setup: <code>docs/agent-studio.md</code>.</p>
    </form></section>`;
  const form = document.getElementById('nf');
  const save = () => { const cur = store.get(FORM_KEY, null) ?? {}; store.set(FORM_KEY, { ...cur, ...readForm() }); };
  form.addEventListener('input', save); form.addEventListener('change', save);
  form.addEventListener('submit', e => { e.preventDefault(); createFilm(); });
  form.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); createFilm(); } });
  document.getElementById('nf-add').onclick = () => document.getElementById('nf-files').click();
  document.getElementById('nf-files').onchange = e => { const files = [...e.target.files]; e.target.value = ''; addSources(files); };
  syncGo();
  document.getElementById('nf-list').onclick = e => { const b = e.target.closest('[data-remove]'); if (!b) return; const cur = store.get(FORM_KEY, {}); cur.documents = (cur.documents ?? []).filter(d => d !== b.dataset.remove); store.set(FORM_KEY, cur); b.closest('li').remove(); };
}
function readForm() {
  const v = id => document.getElementById(id)?.value ?? '';
  return { idea: v('nf-idea'), title: v('nf-title'), playbook: v('nf-playbook'), treatment: v('nf-treatment'), audience: v('nf-audience'), takeaway: v('nf-takeaway'),
    format: document.querySelector('input[name="nf-format"]:checked')?.value ?? 'landscape', mode: document.querySelector('input[name="nf-mode"]:checked')?.value ?? 'oneshot' };
}
const progress = (text, tone = '') => { const p = document.getElementById('nf-progress'); if (p) { p.textContent = text; p.dataset.tone = tone; } };

/**
 * Sources wait in a draft folder named by the create request until the film exists. Each upload is
 * bound to the draft it started in: its result is recorded only in that draft (never in a newer
 * form after a create), Create waits for it, and it keeps going if you leave the page and come back.
 */
const drafts = new Map(); // request -> { pending: Map<id, { name, promise }> }
const draftOf = request => { if (!drafts.has(request)) drafts.set(request, { pending: new Map() }); return drafts.get(request); };
function updateDraft(request, fn) { const cur = store.get(FORM_KEY, null); if (!cur || cur.request !== request) return false; fn(cur); store.set(FORM_KEY, cur); return true; }
const pendingUploads = request => (request && drafts.get(request)?.pending.size) || 0;
function syncGo() {
  const req = store.get(FORM_KEY, null)?.request, n = pendingUploads(req), go = document.getElementById('nf-go');
  if (go) { go.disabled = creating || n > 0; go.textContent = n ? `Uploading ${plural(n, 'source')}…` : 'Create and start building'; }
  const list = document.getElementById('nf-list');
  if (list) for (const li of list.querySelectorAll('[data-pending]')) if (![...(drafts.get(req)?.pending.keys() ?? [])].includes(li.dataset.pending)) li.remove();
  if (list && req) for (const [id, u] of drafts.get(req)?.pending ?? []) if (!list.querySelector(`[data-pending="${id}"]`)) list.insertAdjacentHTML('beforeend', `<li data-pending="${id}">${esc(u.name)} <span class="meta">uploading…</span></li>`);
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

/** The first message: the brief in the person's words, and what to do with the starter. */
function firstMessage(f, film) {
  const pb = S_HOME.catalog?.playbooks?.find(p => p.id === f.playbook), tr = S_HOME.catalog?.treatments?.find(t => t.id === f.treatment);
  return [`Make this film: ${f.idea.trim() || '(see the source documents)'}`,
    f.title.trim() && `Title: ${f.title.trim()}`, `Format: ${f.format === 'vertical' ? 'vertical 9:16' : 'landscape 16:9'}`,
    f.audience.trim() && `Audience: ${f.audience.trim()}`, f.takeaway.trim() && `Takeaway: ${f.takeaway.trim()}`,
    pb ? `Starting structure: ${pb.title}` : 'Starting structure: your choice (the project started from a general starter)', tr ? `Look: ${tr.title ?? tr.id}` : null,
    f.documents?.length ? `Sources you gave (${f.documents.join(', ')}) are in the project as ${(film.files ?? []).map(x => x.name).filter(n => /^source\//.test(n)).join(', ') || 'source/'}; the intake summarised them in BRIEF.md and EVIDENCE.md. Read them with clearframe_files before writing; tie every number to its source.` : null,
    '', `The project "${film.title}" starts from a playbook with sample scenes, narration, numbers and sources. Replace all of it with this film's own: rewrite or replace every scene and its narration, remove sample figures and sources, keep it a film rather than slides, and group the work into a few clearly labelled edits. Where a picture is not designed yet, mark that scene "placeholder" with what it should become; never leave sample content.`,
    f.mode === 'together'
      ? 'We are building this together. Read the brief and sources, then propose a short plan: the scenes in order (one line each, with what the picture does), the look, and the voice. Change nothing yet; end by asking me to confirm or adjust.'
      : 'Start with clearframe_guide topic authoring (short). Then make the first cut I can watch: queue a rough cut with clearframe_render (kind draft), follow it with clearframe_job until it finishes, fix any engine errors it reports and queue it again if needed. Finish by telling me briefly what the cut contains, which scenes are placeholders, and what you need from me.'].filter(x => x != null && x !== false).join('\n');
}

async function createFilm(resume = false) {
  if (creating) return;
  let cur = { ...(store.get(FORM_KEY, null) ?? {}), ...(resume ? {} : readForm()) };
  // Sources still uploading belong to this draft: wait for them so the film and its brief include them.
  if (pendingUploads(cur.request)) {
    creating = true; syncGo(); progress(`Waiting for ${plural(pendingUploads(cur.request), 'source')} to finish uploading…`);
    await Promise.allSettled([...draftOf(cur.request).pending.values()].map(u => u.promise));
    creating = false;
    cur = { ...(store.get(FORM_KEY, null) ?? {}), ...(resume ? {} : readForm()) };
  }
  if (!cur.idea?.trim() && !cur.documents?.length) { progress('Describe the film, or add a source document.', 'error'); document.getElementById('nf-idea')?.focus(); syncGo(); return; }
  creating = true;
  const go = document.getElementById('nf-go'); if (go) go.disabled = true;
  cur.request ??= `req-${newId()}`; cur.submission ??= newSubmission(); cur.started = true;
  store.set(FORM_KEY, cur);
  try {
    progress(resume ? 'Finishing the film you started…' : 'Creating the project…');
    const made = await call('/api/projects', { request: cur.request, idea: cur.idea, title: cur.title, playbook: cur.playbook || undefined, treatment: cur.treatment || undefined,
      format: cur.format, mode: cur.mode, audience: cur.audience, takeaway: cur.takeaway, documents: cur.documents ?? [] });
    await refreshFilms();
    progress('Starting the agent and sending the brief…');
    const film = made.film ?? data.films.find(x => x.id === made.id) ?? { title: cur.title || 'the film' };
    const st = await call(`/api/studio/state?film=${encodeURIComponent(made.id)}`).catch(() => null);
    const first = { id: cur.submission, submission: cur.submission, text: firstMessage(cur, film), scope: { kind: 'film' }, delivery: 'queue', hash: st?.hash ?? null, t: 0 };
    try { await call('/api/agent/prompt', { film: made.id, ...first }); }
    catch (e) {
      // The film exists: open it with the brief waiting in its outbox (same id), shown as not sent with the reason.
      store.set(`cf-agent-outbox:${made.id}`, [...store.get(`cf-agent-outbox:${made.id}`, []).filter(o => o.id !== first.id), { ...first, failed: e.message }]);
    }
    store.set(FORM_KEY, null); drafts.delete(cur.request);
    store.set('cf-agent-open', true);
    location.hash = `#/film/${made.id}`;
  } catch (e) {
    progress(`${e.message}${e.status >= 500 || !e.status ? ' — your idea is kept; try again.' : ''}`, 'error');
  } finally { creating = false; syncGo(); }
}
