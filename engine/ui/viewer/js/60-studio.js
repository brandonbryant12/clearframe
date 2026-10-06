// Studio: one working copy, one selection, one playhead. Every panel renders from `S` and is
// morphed in place, so a field you are typing in keeps its caret while the rest refreshes.
// Edits go through one queued command path (the same one agents use); previews are native jobs.
let S = null, studioCleanup = null;
// A route change abandons queued work and late replies from the previous workspace.
const currentSession = session => !!session && S === session && !session.disposed;
const requireSession = session => { if (!currentSession(session)) throw Object.assign(new Error('Workspace closed'), { name: 'AbortError' }); };
// Read-only handle for local automation and debugging (the page never reads it back).
globalThis.clearframeStudio = () => S;
const LAYOUTS = {
  story: { name: 'Story', left: 'script', right: 'inspect', monitor: 'working', hint: 'Narration and order' },
  design: { name: 'Design', left: 'scenes', right: 'inspect', monitor: 'working', hint: 'Picture, type and motion' },
  review: { name: 'Review', left: 'scenes', right: 'review', monitor: 'rendered', hint: 'Notes, candidates and verdicts' },
  deliver: { name: 'Deliver', left: 'scenes', right: 'deliver', monitor: 'rendered', hint: 'Readiness and exports' },
};
const LEFT_TABS = [['scenes', 'Scenes'], ['script', 'Script'], ['library', 'Library'], ['assets', 'Assets'], ['brief', 'Brief']];
const RIGHT_TABS = [['inspect', 'Inspect'], ['film', 'Film'], ['review', 'Review'], ['deliver', 'Deliver']];

/** GET or POST JSON; errors carry the server's message, status and details. */
async function call(url, body) {
  const r = await fetch(url, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Request failed (${r.status})`), { status: r.status, data: j });
  return j;
}

// ------------------------------------------------------------------ morph: patch the DOM, keep focus

function morph(target, html) {
  const t = document.createElement('template'); t.innerHTML = html;
  patchChildren(target, t.content);
}
const keyOf = n => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
function patchChildren(a, b) {
  const keyed = new Map([...a.childNodes].filter(keyOf).map(n => [keyOf(n), n]));
  let i = 0;
  for (const nb of [...b.childNodes]) {
    const k = keyOf(nb);
    let na = k != null ? keyed.get(k) : a.childNodes[i];
    if (na && k == null && keyOf(na) != null) na = null;
    if (na && (na.nodeType !== nb.nodeType || na.nodeName !== nb.nodeName)) na = null;
    if (na) { if (a.childNodes[i] !== na) a.insertBefore(na, a.childNodes[i] ?? null); patchNode(na, nb); }
    else a.insertBefore(nb, a.childNodes[i] ?? null);
    i++;
  }
  while (a.childNodes.length > i) a.lastChild.remove();
}
function patchNode(a, b) {
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  const focused = a === document.activeElement, field = /^(INPUT|TEXTAREA|SELECT)$/.test(a.nodeName);
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name) && !(name === 'data-dirty' && focused)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  if (field && !(focused && a.dataset.dirty)) {
    if (a.nodeName === 'TEXTAREA') { if (!focused && a.value !== b.value) a.value = b.value; return; }
    if (a.type === 'checkbox') a.checked = b.hasAttribute('checked');
    else if (a.nodeName === 'SELECT') { patchChildren(a, b); const sel = b.querySelector('option[selected]'); a.value = sel ? sel.value : (b.querySelector('option')?.value ?? ''); return; }
    else if (!focused && a.value !== b.getAttribute('value')) a.value = b.getAttribute('value') ?? '';
  }
  if (a.nodeName === 'TEXTAREA') return;
  if (a.hasAttribute('data-keep') && a.getAttribute('data-keep') === b.getAttribute('data-keep')) return;
  patchChildren(a, b);
}

// ------------------------------------------------------------------ entry

async function studio(id) {
  studioCleanup?.(); studioCleanup = null;
  const f = data.films.find(x => x.id === id); if (!f) return films();
  tabs('films'); document.body.classList.add('editing');
  app.innerHTML = '<div class="studio-loading" role="status">Opening the working copy…</div>';
  const layout = store.get('cf-studio-layout', 'design');
  const session = S = { id, f, st: null, schema: null, review: null, jobs: [], queue: Promise.resolve(), saving: 0, disposed: false, timers: [],
    sel: { beat: null, element: null, words: null, note: null }, layout: LAYOUTS[layout] ? layout : 'design',
    left: null, right: null, monitor: { source: 'working', rev: f.versions.at(-1)?.id ?? null, compare: 'rendered', wipe: 0.5, side: false },
    t: 0, zoom: store.get('cf-studio-zoom', 1), fieldErrors: {}, drafts: {}, auto: store.get('cf-studio-auto', true), noting: false, filter: 'open',
    lib: store.get('cf-studio-lib', 'blocks'), dirtyStill: null, open: store.get('cf-studio-open', {}), name: store.get('cf-name', '') };
  agentInit(session);
  const L = LAYOUTS[S.layout]; S.left = L.left; S.right = L.right; S.monitor.source = L.monitor === 'rendered' && S.f.versions.length ? 'rendered' : 'working';
  const cleanup = () => { session.disposed = true; session.timers.forEach(clearTimeout); clearInterval(session.poller); session.resize?.disconnect(); if (S !== session) return; document.body.classList.remove('editing'); removeEventListener('keydown', studioKeys, true); S = null; };
  studioCleanup = cleanup; stopLoop = cleanup;
  try {
    await serverReady; requireSession(session); if (!server) throw Error('Run `clearframe viewer --serve` to edit this film: the studio saves into the project through the local server.');
    const [state, schema] = await Promise.all([call(`/api/studio/state?film=${encodeURIComponent(id)}`), call('/api/studio/schema')]);
    requireSession(session); session.st = state; session.schema = schema;
  } catch (e) {
    if (currentSession(session)) app.innerHTML = `<div class="studio-loading"><h1>Open the editing studio</h1><p>${esc(e.message)}</p><a class="btn" href="#/film/${id}/${f.versions.at(-1)?.id ?? 'review'}">View the film and its notes</a></div>`;
    return;
  }
  if (!currentSession(session)) return;
  S.sel.beat = store.get(`cf-studio-sel:${id}`, null);
  if (!S.st.storyboard.beats.some(b => b.id === S.sel.beat)) S.sel.beat = S.st.storyboard.beats[0]?.id;
  S.t = workingBeat(S.sel.beat)?.start ?? 0;
  shell(); render(); bindStudio();
  // The timeline's scale depends on its width: redraw it when the workspace is resized.
  S.resize = new ResizeObserver(() => invalidate(['timeline'])); S.resize.observe(document.getElementById('st-timeline'));
  addEventListener('keydown', studioKeys, true);
  await refreshJobs(true);
  if (!currentSession(session)) return;
  // Notes can arrive from another tab or the CLI: read them on open and now and then.
  refreshNotes();
  S && (S.poller = setInterval(() => { refreshJobs(); watchSource(); refreshAgent(); if (Date.now() - (S.lastNotes ?? 0) > 15000 && !document.hidden) { S.lastNotes = Date.now(); refreshNotes(); } }, 600));
  autoStill();
  if (S.agent.outbox.length) flushOutbox(); else refreshAgent(true);
}

// ------------------------------------------------------------------ state helpers

const beatsOf = () => S.st.storyboard.beats;
const beatById = id => beatsOf().find(b => b.id === id);
const workingBeat = id => S.st.timing?.beats.find(b => b.id === id) ?? null;
const sceneName = b => b ? (b.label || b.props?.title || b.props?.text || b.id) : '';
const versionOf = id => S.f.versions.find(v => v.id === id) ?? S.f.versions.at(-1) ?? null;
const shownVersion = () => (S.monitor.source === 'working' ? null : versionOf(S.monitor.rev));
const beatErrors = id => S.st.errors.filter(e => e.startsWith(`${id}:`) || e.includes(`${id} `));
const changedBeats = () => new Set([...(S.st.changes?.edited ?? []), ...(S.st.changes?.added ?? [])]);
const timecode = (s, fps = 30) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), sec = Math.floor(s % 60), fr = Math.floor((s - Math.floor(s)) * fps + 1e-6); return `${m}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`; };
const fpsOf = () => S.st.timing?.fps ?? S.st.storyboard.format?.fps ?? 30;

/** The clock the timeline and playhead use: the working copy's timing, or a rendered version's. */
function clockNow() {
  const v = shownVersion();
  if (v && v.scenes.length) return { kind: 'rendered', v, duration: v.seconds || v.scenes.at(-1).end, fps: v.look?.fps ?? 30, beats: v.scenes.map(s => ({ id: s.id, start: s.start, end: s.end })), label: `${versionName(v)} as rendered` };
  const t = S.st.timing;
  return { kind: 'working', duration: t?.duration || 1, fps: fpsOf(), beats: (t?.beats ?? []).map(b => ({ id: b.id, start: b.start, end: b.end })), estimated: t?.estimated, label: t ? `Working copy${t.estimated ? ' · narration timing estimated' : ''}` : 'Working copy · timing unavailable' };
}
const beatAt = (c, t) => c.beats.find(b => t >= b.start && t < b.end) ?? (t >= (c.beats.at(-1)?.end ?? 0) ? c.beats.at(-1) : c.beats[0]);

function status(text, tone = '') { S && (S.statusText = text, S.statusTone = tone); const el = document.getElementById('studio-status'); if (el) { el.textContent = text; el.dataset.tone = tone; } }

/** Run commands one after another, each against the hash the previous one produced. */
function cmd(body, { key, draft } = {}) {
  const session = S;
  const run = async () => {
    requireSession(session);
    session.saving++; status('Saving…');
    try {
      const r = await call('/api/studio/command', { film: S.id, hash: S.st.hash, ...body });
      requireSession(session);
      if (key) { delete S.fieldErrors[key]; delete S.drafts[key]; }
      acceptState(r);
      status(body.command === 'undo' ? `Undone: ${S.lastLabel ?? 'last change'}` : body.command === 'redo' ? `Redone: ${r.undoLabel ?? ''}` : `Saved · ${r.undoLabel ?? 'no change'}`);
      S.lastLabel = r.undoLabel;
      return r;
    } catch (e) {
      if (!currentSession(session)) throw e;
      if (key) { S.fieldErrors[key] = e.message.replace(/^Not saved — the engine would refuse this:\n/, 'Not saved: '); if (draft != null) S.drafts[key] = draft; }
      status(e.message.replace(/^Not saved — the engine would refuse this:\n/, 'Not saved: ').split('\n')[0], 'error');
      if (e.status === 409 && /changed elsewhere/.test(e.message)) await reloadState('The working copy changed outside the studio; reloaded it.');
      throw e;
    } finally { session.saving--; if (currentSession(session)) invalidate(); }
  };
  const p = session.queue.then(run, run); session.queue = p.catch(() => {}); return p;
}
function acceptState(r) {
  S.st = r;
  if (!beatById(S.sel.beat)) S.sel = { ...S.sel, beat: r.created?.[0] ?? beatsOf()[0]?.id, element: null, words: null };
  if (r.created?.length) select(r.created[0]);
  if (S.sel.element && !elementAt(beatById(S.sel.beat), S.sel.element)) S.sel.element = null;
  invalidate();
  autoStill();
}
/** Edits from elsewhere (an agent's `clearframe studio` command, another tab) appear here without a reload. */
async function watchSource() {
  const session = S;
  if (!session || session.watching || session.saving || Date.now() - (session.lastWatch ?? 0) < 3000 || document.hidden) return;
  session.watching = true; session.lastWatch = Date.now();
  try {
    const r = await call(`/api/studio/state?film=${encodeURIComponent(S.id)}`);
    if (currentSession(session) && !S.saving && r.hash !== S.st.hash) { acceptState(r); status(r.externalChanges ? 'The working copy was changed outside the studio; reloaded it.' : `Updated by another editor: ${r.undoLabel ?? 'a change'}`, 'warn'); }
  } catch {} finally { session.watching = false; }
}
async function reloadState(message) {
  const session = S; if (!session) return;
  try { const r = await call(`/api/studio/state?film=${encodeURIComponent(S.id)}`); if (!currentSession(session)) return; acceptState(r); if (message) status(message, 'warn'); } catch (e) { if (currentSession(session)) status(e.message, 'error'); }
}
async function refreshFilm() {
  const session = S; if (!session) return;
  try {
    const f = await call(`/api/studio/film?film=${encodeURIComponent(S.id)}`);
    if (!currentSession(session)) return;
    const i = data.films.findIndex(x => x.id === S.id); if (i >= 0) data.films[i] = f;
    const newest = f.versions.at(-1)?.id;
    S.f = f;
    if (!f.versions.some(v => v.id === S.monitor.rev)) S.monitor.rev = newest;
    invalidate();
  } catch (e) { if (currentSession(session)) status(`Could not refresh the film: ${e.message}`, 'error'); }
}
async function refreshNotes() {
  const session = S; if (!session) return;
  try {
    const { notes } = await call(`/api/notes?film=${encodeURIComponent(S.id)}`);
    if (!currentSession(session)) return;
    for (const v of S.f.versions) v.notes = notes.filter(n => n.version === v.id);
    invalidate();
  } catch {}
}

// ------------------------------------------------------------------ selection

function select(id, { element = null, seek = true, words = null } = {}) {
  if (!beatById(id)) return;
  const changed = S.sel.beat !== id;
  S.sel = { ...S.sel, beat: id, element, words: changed ? words : words ?? (element ? null : S.sel.words) };
  store.set(`cf-studio-sel:${S.id}`, id);
  if (seek && changed) {
    const c = clockNow(), b = c.beats.find(x => x.id === id);
    if (b) seekTo(b.start + Math.min(0.6 * (b.end - b.start), b.end - b.start - 1 / c.fps));
  }
  invalidate(); autoStill();
  requestAnimationFrame(() => document.querySelector(`[data-scene-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }));
}
/** The authored object at a dotted element path inside a beat (props.elements.3, art.under.0). */
function elementAt(b, p) { if (!b || !p) return null; let o = b; for (const k of p.split('.')) { o = o?.[k]; if (o == null) return null; } return typeof o === 'object' ? o : null; }

// ------------------------------------------------------------------ jobs and previews

async function refreshJobs(first = false) {
  const session = S; if (!session) return;
  if (!first && Date.now() - (session.lastJobs ?? 0) < 1400) return;
  session.lastJobs = Date.now();
  let list;
  try { list = (await call(`/api/studio/jobs?film=${encodeURIComponent(S.id)}`)).jobs; } catch { return; }
  if (!currentSession(session)) return;
  const before = new Map(S.jobs.map(j => [j.id, j.status]));
  const sig = list.map(j => `${j.id}:${j.status}:${j.progress ?? ''}:${j.matches}`).join('|');
  if (sig === S.jobSig && !first) return;
  S.jobSig = sig;
  S.jobs = list;
  let film = false, state = false;
  for (const j of list) {
    const was = before.get(j.id);
    if (first || was === j.status || !['complete', 'failed', 'cancelled'].includes(j.status)) continue;
    if (j.status === 'complete' && ['draft', 'final', 'revise', 'reject'].includes(j.kind)) { film = true; state = true; }
    if (j.status === 'complete' && j.kind === 'reject') state = true;
    // New narration changes the timing; a new bed changes the mix.
    if (['voice', 'music'].includes(j.kind) && ['complete', 'failed'].includes(j.status)) { state = true; S.soundHash = null; S.soundFetch = null; }
    if (j.status === 'complete') status(`${j.label} · done${j.matches === false ? ' (you edited while it ran: it may not match)' : ''}`);
    if (j.status === 'failed') status(`${j.label} failed — open the job for details`, 'error');
    if (j.status === 'complete' && j.kind === 'draft' && j.revision) { S.monitor.rev = null; }
    if (j.status === 'complete' && j.kind === 'section' && S.pendingSection === j.id) { S.monitor.section = j.id; S.monitor.source = 'working'; }
  }
  if (film) await refreshFilm();
  if (!currentSession(session)) return;
  if (state) await reloadState();
  if (!currentSession(session)) return;
  if (film && S && !S.monitor.rev) S.monitor.rev = S.f.versions.at(-1)?.id ?? null;
  invalidate(['top', 'left', 'monitor', 'right', 'status']);
  autoStill();
}
const activeJobs = () => S.jobs.filter(j => ['queued', 'waiting', 'running'].includes(j.status));
/** Newest still of a beat (any version of the working copy), and whether it shows the current one. */
function stillFor(beat) {
  const list = S.jobs.filter(j => j.kind === 'still' && j.beat === beat && j.status === 'complete' && j.url).sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''));
  const current = list.find(j => j.hash === S.st.hash && j.matches !== false);
  const latest = list[0] ?? null;
  const previous = list.find(j => j.hash !== (current ?? latest)?.hash) ?? null;
  return { current, latest, previous, running: S.jobs.find(j => j.kind === 'still' && j.beat === beat && ['queued', 'waiting', 'running'].includes(j.status)) };
}
async function startJob(kind, extra = {}, { quiet = false } = {}) {
  const session = S;
  try {
    await session.queue;
    requireSession(session);
    const r = await call('/api/studio/jobs', { film: S.id, hash: S.st.hash, kind, ...extra });
    requireSession(session);
    if (!quiet) status(r.cached ? 'Up to date: already rendered from this version of the working copy' : `${{ still: 'Still', section: 'Section preview', check: 'Check', draft: 'Rough cut', final: 'Final render', captions: 'Captions', revise: 'Candidate', reject: 'Rejection' }[kind]} queued`);
    await refreshJobs();
    requireSession(session);
    return r;
  } catch (e) { if (currentSession(session)) status(e.message, 'error'); throw e; }
}
/** Keep the selected scene's still current: after a selection or an edit, render it if it is missing or stale. */
function autoStill() {
  if (!S || !S.auto || S.monitor.source !== 'working' || S.monitor.section) return;
  const session = S;
  clearTimeout(S.autoTimer);
  S.autoTimer = setTimeout(() => {
    if (!currentSession(session) || !S.sel.beat || S.st.errors.length) return;
    const s = stillFor(S.sel.beat);
    if (s.current || s.running || activeJobs().some(j => j.kind !== 'still')) return;
    // A still that failed for this exact working copy fails again: show the failure, retry only on request or after an edit.
    if (S.jobs.some(j => j.kind === 'still' && j.beat === S.sel.beat && j.hash === S.st.hash && j.status === 'failed')) return;
    // Unknown input provenance cannot become current by rendering it repeatedly. Manual retry remains available.
    if (s.latest?.hash === S.st.hash && !s.latest.print) return;
    startJob('still', { beat: S.sel.beat, pos: 0.6 }, { quiet: true }).catch(() => {});
  }, 450);
  S.timers.push(S.autoTimer);
}
async function cancelJob(id) { const session = S; try { await call('/api/studio/jobs/cancel', { id }); requireSession(session); status('Cancelling…'); refreshJobs(); } catch (e) { if (currentSession(session)) status(e.message, 'error'); } }

// ------------------------------------------------------------------ layout shell

function shell() {
  const w = k => { const d = { left: 260, right: 340, timeline: 220, chat: 400 }[k], v = store.get(`cf-studio-${k}`, d); return Number.isFinite(v) ? v : d; };
  app.innerHTML = `<div class="st ${S.agent.open ? 'chat-on' : ''}" id="st" style="--left:${w('left')}px;--right:${w('right')}px;--tl:${w('timeline')}px;--chat:${w('chat')}px">
    <header class="st-top" id="st-top"></header>
    <aside class="st-left" id="st-left" aria-label="Browser"></aside>
    <div class="st-gutter" data-resize="left" role="separator" aria-orientation="vertical" aria-label="Resize browser" tabindex="0"></div>
    <section class="st-center" id="st-monitor" aria-label="Monitor"></section>
    <div class="st-gutter" data-resize="right" role="separator" aria-orientation="vertical" aria-label="Resize inspector" tabindex="0"></div>
    <aside class="st-right" id="st-right" aria-label="Inspector"></aside>
    <div class="st-gutter" data-resize="chat" role="separator" aria-orientation="vertical" aria-label="Resize the agent" tabindex="0"></div>
    <section class="st-chat" id="st-chat" aria-label="Agent conversation"></section>
    <div class="st-hgutter" data-resize="timeline" role="separator" aria-orientation="horizontal" aria-label="Resize timeline" tabindex="0"></div>
    <section class="st-timeline" id="st-timeline" aria-label="Timeline"></section>
    <footer class="st-status" id="st-status"></footer>
    <div class="st-overlay" id="st-overlay" hidden></div>
  </div>`;
}
const REGIONS = { top: () => topHTML(), left: () => leftHTML(), monitor: () => monitorHTML(), right: () => rightHTML(), timeline: () => timelineHTML(), status: () => statusHTML(), chat: () => chatHTML() };
let pending = new Set(), frame = 0;
function invalidate(which = Object.keys(REGIONS)) {
  for (const k of which) pending.add(k);
  if (!frame) frame = requestAnimationFrame(() => { frame = 0; render([...pending]); pending.clear(); });
}
function render(which = Object.keys(REGIONS)) {
  if (!S || S.disposed || !document.getElementById('st')) return;
  for (const k of which) { const el = document.getElementById(`st-${k}`); if (el) morph(el, REGIONS[k]()); }
  afterRender();
}

function topHTML() {
  const sb = S.st.storyboard, ch = S.st.changes;
  const edits = ch ? (ch.edited.length + ch.added.length + ch.removed.length + (ch.film ? 1 : 0) + (ch.reordered ? 1 : 0)) : null;
  const pausing = activeJobs().find(j => ['draft', 'final', 'revise', 'reject'].includes(j.kind));
  return `<a href="#/films" class="st-back" aria-label="Back to all films" title="All films">‹</a><button class="st-btn small st-drawer-btn" data-act="drawer" aria-label="Show the browser: scenes, script, library, assets">☰</button>
    <div class="st-title"><strong>${esc(sb.title || S.f.title)}</strong><span>${pausing ? `<b class="st-chip warn">Editing paused · ${esc(pausing.label)}</b>` : `Working copy${ch ? edits ? ` · <span class="st-chip">${plural(edits, 'change')} since ${esc(versionName(versionOf(ch.revision) ?? { number: '?' }))}</span>` : ' · <span class="st-chip ok">matches the latest render</span>' : ' · not rendered yet'}`}</span></div>
    <nav class="st-layouts" aria-label="Workspace">${Object.entries(LAYOUTS).map(([k, l], i) => `<button data-act="layout" data-layout="${k}" aria-pressed="${S.layout === k}" title="${esc(l.hint)} (${i + 1})">${l.name}</button>`).join('')}</nav>
    <div class="st-actions">
      <button class="st-btn ghost" data-act="palette" title="Command palette (⌘K)" aria-label="Command palette">⌘K</button>
      <button class="st-btn" data-act="undo" ${S.st.canUndo ? '' : 'disabled'} title="${esc(S.st.undoLabel ? `Undo: ${S.st.undoLabel}` : 'Nothing to undo')} (⌘Z)" aria-label="Undo">↶</button>
      <button class="st-btn" data-act="redo" ${S.st.canRedo ? '' : 'disabled'} title="${esc(S.st.redoLabel ? `Redo: ${S.st.redoLabel}` : 'Nothing to redo')} (⇧⌘Z)" aria-label="Redo">↷</button>
      <button class="st-btn" data-act="still" title="Native still of the selected scene (⌘↩)">Still</button>
      <button class="st-btn" data-act="section" title="Render the selected scenes with their neighbours' handles and the film's sound (⇧⌘↩)">Preview section</button>
      <button class="st-btn primary" data-act="draft" title="Full-length rough cut at half size with free draft narration; saves a revision">Rough cut</button>
      <button class="st-btn ${S.agent?.open ? 'on' : ''}" data-act="chat" aria-pressed="${!!S.agent?.open}" title="Talk to the agent (⌘J)">Agent${S.agent?.conv?.running ? ' <i class="st-spinner small" aria-label="working"></i>' : S.agent?.conv?.permissions?.length ? ' <span class="st-count">!</span>' : ''}</button>
    </div>`;
}

function statusHTML() {
  const act = activeJobs(), run = act.find(j => ['running', 'waiting'].includes(j.status));
  const errs = S.st.errors.length, warns = S.st.warnings.length;
  return `<span id="studio-status" role="status" data-tone="${esc(S.statusTone ?? '')}">${esc(S.statusText ?? (S.st.externalChanges ? 'The working copy changed outside the studio; undo history restarts with your next edit.' : 'All changes saved'))}</span>
    <button class="st-pill ${errs ? 'bad' : warns ? 'warn' : 'ok'}" data-act="right" data-tab="deliver" title="${esc([...S.st.errors, ...S.st.warnings].slice(0, 6).join('\n') || 'The engine accepts this working copy')}">${errs ? `${plural(errs, 'error')}` : warns ? `${plural(warns, 'warning')}` : 'Engine checks pass'}</button>
    ${run ? `<button class="st-pill busy" data-act="jobs" title="${esc(run.label)}">${run.status === 'waiting' ? 'Waiting for the heavy-work gate' : esc(run.label)}${run.progress != null ? ` · ${Math.round(run.progress * 100)}%` : ''}${act.length > 1 ? ` · +${act.length - 1} queued` : ''}</button>` : `<button class="st-pill" data-act="jobs">Jobs</button>`}
    <label class="st-auto" title="Re-render the selected scene's still after every edit"><input type="checkbox" data-act="auto" ${S.auto ? 'checked' : ''}> Live stills</label>
    <span class="st-hint">? shortcuts</span>`;
}

function afterRender() {
  bindMonitor(); chatAfterRender();
  const tl = document.getElementById('st-tl-scroll');
  if (tl && S.followPlayhead) { const ph = tl.querySelector('.st-playhead'); if (ph) { const x = ph.offsetLeft; if (x < tl.scrollLeft || x > tl.scrollLeft + tl.clientWidth - 40) tl.scrollLeft = x - tl.clientWidth / 3; } }
}

// ------------------------------------------------------------------ events: one delegated set for the whole workspace

function bindStudio() {
  const root = document.getElementById('st');
  root.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el || el.disabled || !root.contains(el)) return;
    const fn = ACTIONS[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href')?.startsWith('#/')) return;
    if (el.type !== 'checkbox') e.preventDefault();
    fn(el, e);
  });
  root.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.act === 'auto') { S.auto = el.checked; store.set('cf-studio-auto', S.auto); autoStill(); return; }
    if (el.matches('[data-path]') && (el.tagName === 'SELECT' || ['checkbox', 'range', 'color'].includes(el.type))) commitField(el);
    if (el.dataset.onchange) ACTIONS[el.dataset.onchange]?.(el, e);
  });
  root.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-path]')) { el.dataset.dirty = '1'; const out = el.parentElement.querySelector('output'); if (out) out.textContent = el.value; }
    if (el.dataset.oninput) ACTIONS[el.dataset.oninput]?.(el, e);
  });
  root.addEventListener('focusout', e => { const el = e.target; if (el.matches?.('[data-path]') && el.dataset.dirty && !['checkbox', 'range'].includes(el.type) && el.tagName !== 'SELECT') commitField(el); });
  root.addEventListener('keydown', e => {
    const el = e.target;
    if (!el.matches?.('[data-path]')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const k = fieldKey(el.dataset.scope, el.dataset.beat, el.dataset.path); delete S.drafts[k]; delete S.fieldErrors[k]; delete el.dataset.dirty; el.blur(); render(['right', 'left']); return; }
    if (e.key === 'Enter' && (el.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) { e.preventDefault(); commitField(el); }
  });
  root.addEventListener('toggle', e => { const d = e.target; if (d.tagName === 'DETAILS' && d.dataset.section) { S.open[d.dataset.section] = d.open; store.set('cf-studio-open', S.open); } }, true);
  // Gutters: drag or arrow keys.
  root.querySelectorAll('[data-resize]').forEach(g => {
    const k = g.dataset.resize, axis = k === 'timeline' ? 'y' : 'x', sign = ['right', 'timeline', 'chat'].includes(k) ? -1 : 1, lim = { left: [180, 520], right: [260, 560], timeline: [120, 520], chat: [320, 760] }[k];
    const set = v => { v = Math.max(lim[0], Math.min(lim[1], v)); root.style.setProperty(`--${k === 'timeline' ? 'tl' : k}`, `${v}px`); store.set(`cf-studio-${k}`, v); };
    const now = () => parseFloat(getComputedStyle(root).getPropertyValue(`--${k === 'timeline' ? 'tl' : k}`));
    g.onpointerdown = e => { e.preventDefault(); g.setPointerCapture(e.pointerId); const p0 = axis === 'x' ? e.clientX : e.clientY, v0 = now(); g.onpointermove = ev => set(v0 + ((axis === 'x' ? ev.clientX : ev.clientY) - p0) * sign); g.onpointerup = () => { g.onpointermove = null; }; };
    g.onkeydown = e => { const d = { ArrowLeft: -16, ArrowRight: 16, ArrowUp: -16, ArrowDown: 16 }[e.key]; if (d) { e.preventDefault(); set(now() + d * sign * (axis === 'y' ? 1 : 1)); } };
  });
  bindTimeline(root); bindDrops(root); bindChat(root);
}

/** Commit one inspector field as a command (its key carries any refusal back to the field). */
function commitField(el) {
  delete el.dataset.dirty;
  const scope = el.dataset.scope, path = el.dataset.path, beat = el.dataset.beat, type = el.dataset.type;
  let value;
  try { value = readField(el, type); } catch (e) { S.fieldErrors[fieldKey(scope, beat, path)] = e.message; invalidate(['right', 'left']); return; }
  const current = scope === 'film' ? getPath(S.st.storyboard, path) : getPath(beatById(beat), path);
  if (JSON.stringify(current ?? null) === JSON.stringify(value ?? null)) { delete S.fieldErrors[fieldKey(scope, beat, path)]; invalidate(['right']); return; }
  cmd({ command: 'set', target: scope, beat, path, value }, { key: fieldKey(scope, beat, path), draft: el.type === 'checkbox' ? null : el.value }).catch(() => {});
}
const fieldKey = (scope, beat, path) => `${scope}:${beat ?? ''}:${path}`;
function readField(el, type) {
  const v = el.type === 'checkbox' ? el.checked : el.value;
  if (type === 'bool') return !!v;
  if (type === 'number') { if (String(v).trim() === '') return null; const n = Number(v); if (!Number.isFinite(n)) throw new Error('Enter a number.'); return n; }
  if (type === 'numbers') { const list = String(v).split(/[,\s]+/).filter(Boolean).map(Number); if (list.some(n => !Number.isFinite(n))) throw new Error('Enter numbers separated by commas.'); return list.length ? list : null; }
  if (type === 'list') { const list = String(v).split(/\n|,(?![^"]*")/).map(s => s.trim()).filter(Boolean); return list.length ? list : null; }
  if (type === 'json') { if (!String(v).trim()) return null; try { return JSON.parse(v); } catch { throw new Error('That is not valid JSON.'); } }
  if (type === 'enum') { if (v === '') return null; if (v === 'true') return true; if (v === 'false') return false; return /^-?\d+(\.\d+)?$/.test(v) && el.dataset.numeric ? Number(v) : v; }
  return v === '' ? null : v;
}
function getPath(o, p) { for (const k of String(p).split('.')) { if (o == null) return undefined; o = o[k]; } return o; }

// ------------------------------------------------------------------ actions (buttons, menus, palette)

const ACTIONS = {
  layout: el => setLayout(el.dataset.layout),
  left: el => { S.left = el.dataset.tab; invalidate(['left']); },
  right: el => { S.right = el.dataset.tab; if (['review', 'deliver'].includes(S.right)) loadReview(); if (S.right === 'sound') { S.soundHash = null; S.soundFetch = null; } invalidate(['right']); },
  undo: () => cmd({ command: 'undo' }).catch(() => {}),
  redo: () => cmd({ command: 'redo' }).catch(() => {}),
  select: el => { select(el.dataset.beat, { element: el.dataset.element ?? null }); if (el.closest('.st-left')) document.getElementById('st')?.classList.remove('show-left'); },
  element: el => { S.sel.element = el.dataset.element || null; if (el.dataset.beat && el.dataset.beat !== S.sel.beat) select(el.dataset.beat, { element: S.sel.element }); else invalidate(['right', 'monitor']); },
  still: () => S.sel.beat && startJob('still', { beat: S.sel.beat, pos: S.monitor.pos ?? 0.6 }).catch(() => {}),
  stillAt: () => startJob('still', { at: Number(S.t.toFixed(3)) }).then(r => { S.monitor.atJob = r.id; S.monitor.section = null; invalidate(['monitor']); }).catch(() => {}),
  section: () => previewSection(),
  draft: () => confirmJob('draft'),
  check: () => startJob('check').catch(() => {}),
  final: () => confirmJob('final'),
  captions: el => startJob('captions', { draft: el.dataset.draft !== 'false' }).catch(() => {}),
  cancel: el => cancelJob(el.dataset.job),
  jobs: () => openJobs(),
  palette: () => openPalette(),
  help: () => openHelp(),
  auto: () => {},
  close: () => closeOverlay(),
  source: el => setSource(el.dataset.source),
  rev: el => { S.monitor.rev = el.dataset.rev; if (S.monitor.source === 'working') S.monitor.source = 'rendered'; invalidate(); },
  move: el => cmd({ command: 'move', beat: el.dataset.beat, to: beatsOf().findIndex(b => b.id === el.dataset.beat) + Number(el.dataset.dir) }).catch(() => {}),
  duplicate: el => cmd({ command: 'duplicate', beat: el.dataset.beat }).catch(() => {}),
  remove: el => cmd({ command: 'delete', beat: el.dataset.beat }).then(() => status('Scene deleted — ⌘Z brings it back')).catch(() => {}),
  insert: el => cmd({ command: 'insert', block: el.dataset.block || undefined, sketch: el.dataset.sketch || undefined, after: S.sel.beat ?? undefined }).catch(() => {}),
  art: el => S.sel.beat && cmd({ command: 'set', target: 'beat', beat: S.sel.beat, path: 'art', value: { sketch: el.dataset.sketch, opacity: 0.6 } }).catch(() => {}),
  apply: el => applyPreset(el.dataset),
  libtab: el => { S.lib = el.dataset.lib; store.set('cf-studio-lib', S.lib); invalidate(['left']); },
  addprop: el => { const sel = el.parentElement.querySelector('select'); if (sel?.value) addProp(sel.value); },
  addel: el => addElement(el.dataset.type, el.dataset.list),
  elmove: el => moveElement(el.dataset.element, Number(el.dataset.dir)),
  elremove: el => removeElement(el.dataset.element),
  elcopy: el => copyElement(el.dataset.element),
  row: el => editRow(el.dataset),
  clear: el => { const k = fieldKey(el.dataset.scope, el.dataset.beat, el.dataset.path); delete S.drafts[k]; cmd({ command: 'set', target: el.dataset.scope, beat: el.dataset.beat, path: el.dataset.path, value: null }, { key: k }).catch(() => {}); },
  setv: el => cmd({ command: 'set', target: el.dataset.scope, beat: el.dataset.beat, path: el.dataset.path, value: JSON.parse(el.dataset.value) }, { key: fieldKey(el.dataset.scope, el.dataset.beat, el.dataset.path) }).catch(() => {}),
  word: (el, e) => pickWord(el, e),
  cut: () => recordingEdit('recording.cut'),
  split: () => recordingEdit('recording.split'),
  merge: el => recordingEdit('recording.merge', el.dataset.beat),
  play: () => togglePlay(),
  stepf: el => stepFrame(Number(el.dataset.dir)),
  scene: el => stepScene(Number(el.dataset.dir)),
  loop: () => { S.loop = !S.loop; invalidate(['monitor']); },
  zoom: el => setZoom(el.dataset.zoom === 'fit' ? 1 : S.zoom * Number(el.dataset.zoom)),
  follow: () => { S.followPlayhead = !S.followPlayhead; invalidate(['timeline']); },
  note: () => toggleNoting(),
  wholeNote: () => composeNote(null),
  compareMode: el => { S.monitor.compare = el.dataset.mode; invalidate(['monitor']); },
  side: () => { S.monitor.side = !S.monitor.side; invalidate(['monitor']); },
  seek: el => { seekTo(Number(el.dataset.t)); if (el.dataset.beat) select(el.dataset.beat, { seek: false }); },
  filter: el => { S.filter = el.dataset.filter; invalidate(['right']); },
  thread: (el, e) => threadAction(el, e),
  revise: el => startJob('revise', { note: el.dataset.note }).catch(() => {}),
  accept: el => decide('accept', el.dataset),
  reject: el => decide('reject', el.dataset),
  passage: el => { S.monitor.passage = { before: el.dataset.before, after: el.dataset.after }; S.monitor.source = 'compare'; S.monitor.compare = 'passage'; invalidate(); },
  openSection: el => { S.monitor.section = el.dataset.job; S.monitor.source = 'working'; invalidate(); },
  closeSection: () => { S.monitor.section = null; invalidate(); autoStill(); },
  treatment: el => cmd({ command: 'treatment', id: el.dataset.id }).catch(() => {}),
  goto: el => { location.hash = el.dataset.href; },
  drawer: () => document.getElementById('st')?.classList.toggle('show-left'),
};

function setLayout(k) {
  if (!LAYOUTS[k]) return;
  S.layout = k; store.set('cf-studio-layout', k);
  const L = LAYOUTS[k]; S.left = L.left; S.right = L.right;
  if (L.monitor === 'rendered' && S.f.versions.length) setSource('rendered'); else if (L.monitor === 'working' && S.monitor.source !== 'compare') setSource('working');
  if (['review', 'deliver'].includes(S.right)) loadReview();
  invalidate();
}
function setSource(src) {
  if (src !== 'working' && !S.f.versions.length) { status('Nothing rendered yet: make a rough cut to watch the film.', 'warn'); return; }
  pauseVideo();
  const before = clockNow(), b = beatAt(before, S.t), into = b ? (S.t - b.start) / Math.max(1e-6, b.end - b.start) : 0;
  S.monitor.source = src; if (src !== 'compare') S.monitor.passage = null;
  if (src !== 'working') S.monitor.rev ??= S.f.versions.at(-1)?.id;
  // Keep the same moment of the same scene when the clock changes.
  const after = clockNow(), nb = b && after.beats.find(x => x.id === b.id);
  if (nb) S.t = nb.start + into * (nb.end - nb.start);
  invalidate(); autoStill();
}
async function loadReview() { const session = S; if (!session) return; try { const r = await call(`/api/studio/review?film=${encodeURIComponent(S.id)}`); if (currentSession(session)) { S.review = r; invalidate(['right']); } } catch {} }
function confirmJob(kind) {
  const text = kind === 'draft'
    ? 'Render a full-length rough cut at half size? It records free local draft narration where none exists, runs the engine checks and saves a revision. Editing pauses until it finishes (or you cancel).'
    : 'Render the final film at full size? It uses the narration already prepared (no paid generation), refuses estimated timing where measured timing is required, and saves a revision. Editing pauses until it finishes.';
  overlay(`<div class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${kind === 'draft' ? 'Rough cut' : 'Final render'}</h2><p>${text}</p>
    <div class="st-dialog-actions"><button class="st-btn" data-act="close">Not now</button><button class="st-btn primary" data-act="go" autofocus>Render</button></div></div>`, {
    go: () => { closeOverlay(); startJob(kind).catch(() => {}); } });
}
function previewSection() {
  const ids = S.sel.range?.length ? S.sel.range : [S.sel.beat].filter(Boolean);
  if (!ids.length) return;
  startJob('section', { beats: ids, handles: 0.5 }).then(r => { S.pendingSection = r.id; if (r.cached) { S.monitor.section = r.id; S.monitor.source = 'working'; invalidate(); } }).catch(() => {});
}
function applyPreset(d) {
  const film = d.scope !== 'beat';
  if (d.kind === 'palette') return cmd({ command: 'set', target: film ? 'film' : 'beat', beat: S.sel.beat, path: film ? 'theme' : 'tone', value: d.value }).catch(() => {});
  if (d.kind === 'type') return cmd({ command: 'set', target: film ? 'film' : 'beat', beat: S.sel.beat, path: 'type', value: d.value }).catch(() => {});
  if (d.kind === 'motion') return cmd({ command: 'set', target: film ? 'film' : 'beat', beat: S.sel.beat, path: 'motion.preset', value: d.value }).catch(() => {});
  if (d.kind === 'transition') return cmd({ command: 'set', target: film ? 'film' : 'beat', beat: S.sel.beat, path: 'transition', value: d.value }).catch(() => {});
}

// ------------------------------------------------------------------ overlay (dialogs, palette, help, jobs)

let overlayActions = {};
function overlay(html, actions = {}) {
  const o = document.getElementById('st-overlay'); if (!o) return;
  S.returnFocus = document.activeElement;
  overlayActions = actions; o.innerHTML = html; o.hidden = false;
  o.onclick = e => { if (e.target === o) return closeOverlay(); const a = e.target.closest('[data-act]'); if (!a) return; if (overlayActions[a.dataset.act]) { e.preventDefault(); e.stopPropagation(); overlayActions[a.dataset.act](a, e); } else if (a.dataset.act === 'close') { e.stopPropagation(); closeOverlay(); } };
  (o.querySelector('[autofocus]') ?? o.querySelector('input,textarea,button'))?.focus();
}
function closeOverlay() { const o = document.getElementById('st-overlay'); if (!o || o.hidden) return false; o.hidden = true; o.innerHTML = ''; overlayActions = {}; S?.returnFocus?.focus?.(); return true; }
function openJobs() {
  const rows = [...S.jobs].reverse().slice(0, 30);
  overlay(`<div class="st-dialog wide" role="dialog" aria-modal="true" aria-labelledby="jobs-t"><h2 id="jobs-t">Render jobs</h2>
    <p class="st-muted">One heavy job runs at a time through the shared gate; the rest wait in order. Stills and section previews never block editing; rough cuts, finals and candidates pause it.</p>
    <div class="st-joblist">${rows.map(j => `<details class="st-job s-${esc(j.status)}"><summary><b>${esc(j.label)}</b><span class="st-chip ${j.status === 'complete' ? 'ok' : j.status === 'failed' ? 'bad' : ''}">${esc(j.status)}${j.progress != null && j.status === 'running' ? ` ${Math.round(j.progress * 100)}%` : ''}</span>
      <span class="st-muted">${when(j.createdAt)}${j.matches === false ? ' · edited while running' : ''}</span>${['queued', 'waiting', 'running'].includes(j.status) ? `<button class="st-btn small" data-act="cancelJob" data-job="${esc(j.id)}">Cancel</button>` : ''}
      ${j.url && j.kind === 'section' ? `<button class="st-btn small" data-act="openJob" data-job="${esc(j.id)}">Open</button>` : ''}</summary><pre>${esc(j.log || 'No output yet.')}</pre></details>`).join('') || '<p class="st-muted">No jobs yet.</p>'}</div>
    <div class="st-dialog-actions"><button class="st-btn" data-act="close">Close</button></div></div>`, {
    cancelJob: a => { cancelJob(a.dataset.job); closeOverlay(); },
    openJob: a => { closeOverlay(); S.monitor.section = a.dataset.job; S.monitor.source = 'working'; invalidate(); },
  });
}
