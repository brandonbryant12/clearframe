// The agent column: this film's one OpenCode conversation. Messages carry the scope the person
// pinned (film, scene, layer, range, moment, note, asset) snapshotted when they pinned it, plus
// the working-copy hash, revision and playhead at send time. Every send has a durable id kept in
// an outbox until the server confirms it, so a retry, a refresh or a lost reply never duplicates
// a prompt. The agent edits through the same validated command path as the panels.

const AGENT_POLL_BUSY = 1200, AGENT_POLL_IDLE = 5000;
const newSubmission = () => `msg_cf${Array.from(crypto.getRandomValues(new Uint8Array(24)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
const outboxKey = id => `cf-agent-outbox:${id}`;
const SCOPE_LABEL = { film: 'Whole film', scene: 'Scene', layer: 'Layer', range: 'Range', moment: 'Moment', note: 'Note', asset: 'File' };

function agentInit(session) {
  session.agent = { conv: null, draft: store.get(`cf-agent-draft:${session.id}`, ''), scope: store.get(`cf-agent-scope:${session.id}`, null), outbox: store.get(outboxKey(session.id), []),
    open: store.get('cf-agent-open', true), lastPoll: 0, polling: false, edits: null, error: null, scrolledUp: false, menu: false };
}
const agentBusy = a => !!a?.conv && (a.conv.running || a.conv.queued?.length || a.conv.pending?.some(p => p.state === 'sending') || a.conv.permissions?.length || a.conv.forms?.length || a.conv.runtime?.state === 'starting' || a.conv.runtime?.catalog === 'loading') || !!a?.outbox?.length;

/** Poll the persisted conversation: fast while something is in flight, slow when idle, never in a hidden tab. */
async function refreshAgent(force = false) {
  const session = S, a = session?.agent;
  if (!a || a.polling || (document.hidden && !force)) return;
  if (!force && Date.now() - a.lastPoll < (agentBusy(a) ? AGENT_POLL_BUSY : AGENT_POLL_IDLE)) return;
  a.polling = true; a.lastPoll = Date.now();
  try {
    const conv = await call(`/api/agent/conversation?film=${encodeURIComponent(session.id)}`);
    if (!currentSession(session)) return;
    a.error = null;
    // Agent edits land through the studio's commands: reload the working copy when a new one completes.
    const edits = conv.messages.flatMap(m => m.parts ?? []).filter(p => p.type === 'tool' && p.own && p.tool === 'edit' && p.status === 'completed').length;
    const jobsQueued = conv.messages.flatMap(m => m.parts ?? []).filter(p => p.type === 'tool' && p.job).length;
    const changed = a.edits != null && edits > a.edits, queued = a.jobs != null && jobsQueued > a.jobs;
    a.edits = edits; a.jobs = jobsQueued; a.conv = conv;
    // Anything the server now knows about leaves the outbox.
    const known = new Set([...conv.messages.filter(m => m.role === 'user').map(m => m.id), ...conv.queued.map(q => q.id), ...conv.pending.map(p => p.id)]);
    if (a.outbox.some(o => known.has(o.id))) { a.outbox = a.outbox.filter(o => !known.has(o.id)); store.set(outboxKey(session.id), a.outbox); }
    invalidate(['chat']);
    if (changed) { await reloadState(); if (currentSession(session)) status(`Agent: ${S.st.undoLabel ?? 'edited the film'}`); }
    if (queued && currentSession(session)) refreshJobs();
  } catch (e) {
    if (!currentSession(session)) return;
    a.error = e.message; invalidate(['chat']);
  } finally { a.polling = false; }
}

/** Resend whatever the outbox still holds (same ids: the runtime treats a repeat as the same message). */
async function flushOutbox() {
  const session = S, a = session?.agent; if (!a) return;
  for (const o of [...a.outbox]) {
    if (o.inflight) continue;
    o.inflight = true;
    try {
      await call('/api/agent/prompt', { film: session.id, ...o, inflight: undefined, failed: undefined });
      if (!currentSession(session)) return;
      a.outbox = a.outbox.filter(x => x.id !== o.id); store.set(outboxKey(session.id), a.outbox);
    } catch (e) {
      if (!currentSession(session)) return;
      o.failed = e.message; store.set(outboxKey(session.id), a.outbox);
      if (e.status && e.status < 500) { status(`Not sent: ${e.message}`, 'error'); }
    } finally { o.inflight = false; }
  }
  if (currentSession(session)) { invalidate(['chat']); refreshAgent(true); }
}

function sendMessage(delivery = 'queue') {
  const a = S.agent, text = a.draft.trim();
  if (!text) return;
  const working = S.monitor.source === 'working';
  const o = { id: newSubmission(), submission: undefined, text, scope: a.scope ?? { kind: 'film' }, delivery, hash: S.st.hash,
    revision: working ? S.st.changes?.revision ?? null : S.monitor.rev, t: Number(S.t.toFixed(2)), at: new Date().toISOString() };
  o.submission = o.id;
  a.outbox.push(o); store.set(outboxKey(S.id), a.outbox);
  a.draft = ''; store.set(`cf-agent-draft:${S.id}`, '');
  a.scrolledUp = false;
  const box = document.getElementById('st-chat-input'); if (box) box.value = '';
  invalidate(['chat']);
  flushOutbox();
}

// ------------------------------------------------------------------ scope

/** Pin what the next messages are about, from the selection as it is right now. */
function pinScope(kind, extra = {}) {
  const b = beatById(S.sel.beat), name = b ? sceneName(b) : '';
  let scope = null;
  if (kind === 'scene' && b) scope = { kind, beats: [b.id], label: `Scene: ${name}` };
  if (kind === 'layer' && b && S.sel.element) { const el = elementAt(b, S.sel.element); scope = { kind, beats: [b.id], element: S.sel.element, label: `Layer: ${elLabel(el ?? {}).slice(0, 40)} in ${name}` }; }
  if (kind === 'range' && S.sel.range?.length) { const c = clockNow(), r = S.sel.range.map(id => c.beats.find(x => x.id === id)).filter(Boolean); scope = { kind, beats: [...S.sel.range], from: r[0]?.start, to: r.at(-1)?.end, label: `Range: ${S.sel.range.length} scenes ${clock(r[0]?.start)}–${clock(r.at(-1)?.end)}` }; }
  if (kind === 'moment') { const c = clockNow(), at = beatAt(c, S.t); scope = { kind, t: Number(S.t.toFixed(2)), beats: at ? [at.id] : [], label: `Moment: ${timecode(S.t, c.fps)}${at ? ` in ${sceneName(beatById(at.id))}` : ''}` }; }
  if (kind === 'note' && extra.note) scope = { kind, note: extra.note.id, noteText: extra.note.text, beats: extra.beat ? [extra.beat] : [], t: extra.note.at ?? undefined, label: `Note ${extra.note.id}: ${extra.note.text.slice(0, 40)}` };
  if (kind === 'asset' && extra.file) scope = { kind, asset: extra.file, label: `File: ${extra.file.split('/').pop()}` };
  if (kind === 'film') scope = null;
  if (kind !== 'film' && !scope) { status(kind === 'layer' ? 'Select a layer in the inspector first.' : kind === 'range' ? 'Shift-click scenes on the timeline to select a range first.' : 'Select a scene first.', 'warn'); return; }
  S.agent.scope = scope; S.agent.menu = false; store.set(`cf-agent-scope:${S.id}`, scope);
  openChat(true);
}
function openChat(focus = false) {
  if (!S.agent.open) { S.agent.open = true; store.set('cf-agent-open', true); document.getElementById('st')?.classList.add('chat-on'); }
  invalidate(['chat', 'top']);
  if (focus) requestAnimationFrame(() => document.getElementById('st-chat-input')?.focus());
}
function toggleChat() { S.agent.open = !S.agent.open; store.set('cf-agent-open', S.agent.open); document.getElementById('st')?.classList.toggle('chat-on', S.agent.open); invalidate(['chat', 'top', 'timeline']); if (S.agent.open) requestAnimationFrame(() => document.getElementById('st-chat-input')?.focus()); }

// ------------------------------------------------------------------ rendering

const scopeChip = (s, cls = '') => `<span class="st-scope ${cls}" title="${esc(s?.label ?? 'Whole film')}"><b>${esc(SCOPE_LABEL[s?.kind ?? 'film'])}</b>${s?.label ? ` ${esc(s.label.replace(/^[^:]+:\s*/, ''))}` : ''}</span>`;
function chatText(md) {
  // Fenced code stays verbatim; the rest is the viewer's small Markdown reader.
  return String(md ?? '').split(/```[\w-]*\n?/).map((part, i) => (i % 2 ? `<pre class="st-code">${esc(part.replace(/\n$/, ''))}</pre>` : markdown(part))).join('');
}
const toolIcon = p => (p.status === 'completed' ? '<i class="st-ti ok" aria-label="done">✓</i>' : p.status === 'error' ? '<i class="st-ti bad" aria-label="failed">✕</i>' : '<i class="st-spinner small" aria-label="running"></i>');

function runFooter(run, msgs) {
  const tools = msgs.flatMap(m => m.parts ?? []).filter(p => p.type === 'tool' && p.own);
  const edits = tools.filter(p => p.tool === 'edit' && p.status === 'completed'), beats = [...new Set(edits.flatMap(p => p.beats ?? []))];
  const jobs = [...new Set(tools.filter(p => p.job).map(p => p.job))].map(id => S.jobs.find(j => j.id === id)).filter(Boolean);
  if (!edits.length && !jobs.length) return '';
  const applied = (S.st.history ?? []).filter(h => h.run === run && h.applied).length;
  return `<div class="st-run">
    ${edits.length ? `<div><b>${plural(edits.length, 'edit')}</b>${beats.length ? ` to ${beats.map(id => beatById(id) ? `<button class="st-link" data-act="select" data-beat="${esc(id)}">${esc(sceneName(beatById(id)))}</button>` : `<s>${esc(id)}</s>`).join(', ')}` : ' to film settings'}
      ${applied ? `<button class="st-btn small" data-act="undoRun" data-run="${esc(run)}" title="Undo every edit this reply made, as one step (only while they are the newest edits)">Undo these edits</button>` : '<span class="st-muted">· undone</span>'}</div>` : ''}
    ${jobs.map(j => `<div class="st-run-job"><span class="st-chip ${j.status === 'complete' ? (j.matches === false ? 'warn' : 'ok') : j.status === 'failed' ? 'bad' : ''}">${esc(j.label)} · ${esc(j.status)}${j.progress != null && j.status === 'running' ? ` ${Math.round(j.progress * 100)}%` : ''}</span>
      ${j.status === 'complete' && j.kind === 'still' && j.url ? `<button class="st-link" data-act="select" data-beat="${esc(j.beat ?? '')}">Show</button>` : ''}${j.status === 'complete' && j.kind === 'section' ? `<button class="st-link" data-act="openSection" data-job="${esc(j.id)}">Play</button>` : ''}
      ${['queued', 'waiting', 'running'].includes(j.status) ? `<button class="st-link" data-act="cancel" data-job="${esc(j.id)}">Cancel</button>` : ''}</div>`).join('')}
  </div>`;
}

function transcriptHTMLChat(conv) {
  const out = [];
  let run = null, runMsgs = [];
  const closeRun = () => { if (run) out.push(runFooter(run, runMsgs)); run = null; runMsgs = []; };
  for (const m of conv.messages) {
    if (m.role === 'user') {
      closeRun(); run = m.id;
      out.push(`<article class="st-msg user" data-key="m-${esc(m.id)}"><header>${m.scope && m.scope.kind !== 'film' ? scopeChip(m.scope) : scopeChip(null, 'quiet')}<time>${when(new Date(m.at).toISOString())}</time></header><div class="st-msg-body">${esc(m.text).replace(/\n/g, '<br>')}</div></article>`);
    } else if (m.role === 'assistant') {
      runMsgs.push(m);
      const parts = m.parts.map((p, i) => p.type === 'text' ? `<div class="st-msg-text">${chatText(p.text)}</div>`
        : p.type === 'reasoning' ? `<details class="st-reason" data-key="r-${esc(m.id)}-${i}"><summary>Thinking</summary><p>${esc(p.text)}</p></details>`
        : `<div class="st-step ${p.status}" data-key="t-${esc(p.id)}">${toolIcon(p)}<span><b>${esc(p.title)}</b>${p.summary && p.summary !== p.title ? `<em>${esc(p.summary)}</em>` : ''}${p.error ? `<em class="bad">${esc(p.error)}</em>` : ''}</span></div>`).join('');
      out.push(`<article class="st-msg agent" data-key="m-${esc(m.id)}">${parts || (m.done ? '' : '<div class="st-step"><i class="st-spinner small"></i><span>Working…</span></div>')}
        ${m.stopped ? '<p class="st-msg-sys">Stopped.</p>' : ''}${m.retry ? `<p class="st-msg-warn">Retrying (attempt ${m.retry.attempt}): ${esc(m.retry.message)}</p>` : ''}
        ${m.error ? `<div class="st-msg-error"><b>${esc(m.error.message)}</b>${m.error.hint ? `<p>${esc(m.error.hint)}</p>` : ''}<button class="st-btn small" data-act="agentRetry">Try again</button></div>` : ''}</article>`);
    } else if (m.role === 'idle') {
      if (m.outcome !== 'succeeded') out.push(`<p class="st-msg-sys" data-key="m-${esc(m.id)}">${m.outcome === 'interrupted' ? 'Stopped.' : 'This reply failed.'}</p>`);
      closeRun();
    } else if (m.role === 'note') out.push(`<p class="st-msg-sys" data-key="m-${esc(m.id)}">${esc(m.text)}</p>`);
  }
  closeRun();
  return out.join('');
}

function chatHTML() {
  const a = S.agent; if (!a) return '';
  if (!a.open) return '';
  const conv = a.conv, rt = conv?.runtime, running = !!conv?.running;
  const model = conv?.model ?? 'opencode/big-pickle';
  const state = !conv ? (a.error ? 'error' : 'loading') : rt?.state === 'error' ? 'error' : running ? 'running' : rt?.state === 'ready' ? 'ready' : conv.linked ? 'starting' : 'idle';
  const head = `<header class="st-chat-head"><h2>Agent</h2><span class="st-chat-state s-${state}" role="status">${{ loading: 'Connecting…', error: 'Needs attention', running: 'Working', ready: 'Ready', starting: 'Starting OpenCode…', idle: 'Not started' }[state]}</span>
    <button class="st-chip-btn" data-act="agentSettings" title="Model, providers and runtime">${esc(model.split('/').pop())}</button>
    <button class="st-btn ghost small" data-act="chat" aria-label="Hide the agent (⌘J)" title="Hide (⌘J)">✕</button></header>`;
  let body = '';
  if (a.error && !conv) body += `<div class="st-msg-error"><b>${esc(a.error)}</b><p>The studio server may have stopped. Start it with <code>clearframe viewer --serve</code>, then retry.</p><button class="st-btn small" data-act="agentRefresh">Retry</button></div>`;
  if (rt?.state === 'error') body += `<div class="st-msg-error"><b>OpenCode did not start: ${esc(rt.error)}</b>${rt.hint ? `<p>${esc(rt.hint)}</p>` : ''}<button class="st-btn small" data-act="agentStart">Retry</button> <button class="st-link" data-act="agentSettings">Setup</button></div>`;
  if (rt && rt.state === 'ready' && ['empty', 'missing-model'].includes(rt.catalog)) body += `<div class="st-msg-warn"><b>${esc(rt.hint ?? 'The model catalog is not ready.')}</b> <button class="st-link" data-act="agentSettings">Choose a model</button></div>`;
  if (conv?.lost) body += `<p class="st-msg-sys">The earlier conversation for this film is not in this runtime any more (${esc(conv.lost.sessionID)}); a new one starts with your next message.</p>`;
  if (conv) body += transcriptHTMLChat(conv);
  if (conv && !conv.messages.length && !a.outbox.length && !conv.pending.length) body += `<div class="st-chat-empty"><p>Talk to the agent to build this film. It reads the storyboard, edits through the same undoable steps as the panels, and renders native previews you can watch here.</p>
    <div class="st-suggest">${['Turn the brief into a first cut: rewrite every scene for this idea', 'Make the opening hook stronger', 'Suggest a palette and treatment that fit the story', 'What would make this feel less like slides?'].map(t => `<button class="st-btn small" data-act="suggest" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  // Not yet confirmed by the server: sending, or failed with a reason.
  const unsent = [...a.outbox.map(o => ({ ...o, state: o.failed ? 'failed' : 'sending', error: o.failed })), ...(conv?.pending ?? []).filter(p => !a.outbox.some(o => o.id === p.id))];
  body += unsent.map(o => `<article class="st-msg user pending" data-key="o-${esc(o.id)}"><header>${scopeChip(o.scope?.kind === 'film' ? null : o.scope, o.scope?.kind === 'film' ? 'quiet' : '')}<span class="st-chip ${o.state === 'failed' ? 'bad' : ''}">${o.state === 'failed' ? 'Not sent' : 'Sending…'}</span></header><div class="st-msg-body">${esc(o.text).replace(/\n/g, '<br>')}</div>
    ${o.state === 'failed' ? `<p class="st-msg-warn">${esc(o.error ?? '')}</p><div class="st-addrow"><button class="st-btn small" data-act="resend" data-id="${esc(o.id)}">Retry</button><button class="st-btn small ghost" data-act="discard" data-id="${esc(o.id)}">Discard</button></div>` : ''}</article>`).join('');
  if (running && !conv.messages.at(-1)?.parts?.length && conv.messages.at(-1)?.role === 'user') body += '<div class="st-step"><i class="st-spinner small"></i><span>Thinking…</span></div>';
  // Waiting on the person: approvals and questions.
  body += (conv?.permissions ?? []).map(p => `<div class="st-ask" data-key="p-${esc(p.id)}" role="group" aria-label="Approval needed"><b>The agent asks to ${esc({ shell: 'run a shell command', webfetch: 'fetch a web page', websearch: 'search the web' }[p.action] ?? `use ${p.action}`)}</b>
    ${p.resources.map(r => `<pre class="st-code">${esc(r)}</pre>`).join('')}${p.message ? `<p>${esc(p.message)}</p>` : ''}
    <p class="st-hint-text">Shell commands can change files outside the studio's undo history and can spend money (paid generation). Allow only what you understand.</p>
    <div class="st-addrow"><button class="st-btn small" data-act="permit" data-id="${esc(p.id)}" data-decision="once">Allow once</button>${p.save?.length ? `<button class="st-btn small" data-act="permit" data-id="${esc(p.id)}" data-decision="always">Always allow</button>` : ''}<button class="st-btn small danger" data-act="permit" data-id="${esc(p.id)}" data-decision="reject">Deny</button></div></div>`).join('');
  body += (conv?.forms ?? []).map(f => formHTML(f)).join('');
  if (conv?.queued?.length) body += `<div class="st-queue"><h3 class="st-h3">Queued after this reply</h3>${conv.queued.map(q => `<div class="st-queued" data-key="q-${esc(q.id)}">${q.scope && q.scope.kind !== 'film' ? scopeChip(q.scope) : ''}<p>${esc(q.text)}</p><div class="st-addrow"><button class="st-btn small" data-act="steer" data-id="${esc(q.id)}" title="Deliver now: the agent reads it at its next step">Send now</button><button class="st-btn small ghost" data-act="unqueue" data-id="${esc(q.id)}">Remove</button></div></div>`).join('')}</div>`;
  const s = a.scope;
  const menu = a.menu ? `<div class="st-scope-menu" role="menu">${[['film', 'Whole film'], ['scene', `This scene${beatById(S.sel.beat) ? `: ${sceneName(beatById(S.sel.beat))}` : ''}`], ['layer', S.sel.element ? 'Selected layer' : 'Selected layer (select one first)'], ['range', S.sel.range?.length ? `Selected range (${S.sel.range.length} scenes)` : 'Range (shift-click scenes first)'], ['moment', `Moment at ${timecode(S.t, fpsOf())}`]]
    .map(([k, t]) => `<button role="menuitem" data-act="scope" data-kind="${k}">${esc(t)}</button>`).join('')}<p class="st-hint-text">Notes and files: use “Ask the agent” on a review note or an asset.</p></div>` : '';
  const foot = `<form class="st-compose" data-act-form="send" aria-label="Message the agent">
    <div class="st-compose-scope"><button type="button" class="st-scope-btn" data-act="scopeMenu" aria-haspopup="menu" aria-expanded="${a.menu}" title="What this message is about">${scopeChip(s)}<span aria-hidden="true">▾</span></button>${s ? '<button type="button" class="st-link" data-act="scope" data-kind="film" aria-label="Whole film instead">Clear</button>' : ''}${menu}</div>
    <textarea id="st-chat-input" rows="3" placeholder="${running ? 'Add a follow-up (queued), or send now to steer…' : 'Describe what to make or change…'}" aria-label="Message">${esc(a.draft)}</textarea>
    <div class="st-compose-actions"><span class="st-hint-text">${running ? '↩ queue · ⇧↩ new line' : '↩ send · ⇧↩ new line'}</span>
      ${running ? '<button type="button" class="st-btn small danger" data-act="stop" title="Stop the current reply">Stop</button><button type="button" class="st-btn small" data-act="sendSteer" title="Deliver now: the agent reads it at its next step">Send now</button><button type="submit" class="st-btn small primary">Queue</button>' : '<button type="submit" class="st-btn small primary">Send</button>'}</div></form>`;
  return `${head}<div class="st-chat-log" id="st-chat-log" aria-live="polite" aria-label="Conversation">${body}</div>${foot}`;
}

function formHTML(f) {
  const fields = (f.fields ?? []).map(x => {
    const id = `f-${esc(f.id)}-${esc(x.key)}`, label = `<label for="${id}">${esc(x.label ?? x.key)}</label>`;
    if (x.type === 'boolean') return `<div class="st-field"><label><input type="checkbox" id="${id}" data-key="${esc(x.key)}" data-type="bool"> ${esc(x.label ?? x.key)}</label></div>`;
    if (x.options?.length) return `<div class="st-field">${label}<select id="${id}" data-key="${esc(x.key)}" ${x.type === 'multiselect' ? 'multiple' : ''}>${x.options.map(o => `<option value="${esc(o.value ?? o)}">${esc(o.label ?? o.value ?? o)}</option>`).join('')}</select></div>`;
    return `<div class="st-field">${label}<input id="${id}" data-key="${esc(x.key)}" data-type="${x.type === 'number' || x.type === 'integer' ? 'number' : 'text'}"></div>`;
  }).join('');
  return `<form class="st-ask" data-form="${esc(f.id)}" data-key="f-${esc(f.id)}"><b>${esc(f.title)}</b>${fields}<div class="st-addrow"><button type="button" class="st-btn small primary" data-act="answer" data-id="${esc(f.id)}">Answer</button><button type="button" class="st-btn small ghost" data-act="answer" data-id="${esc(f.id)}" data-cancel="1">Skip</button></div></form>`;
}

/** Keep the log pinned to the newest message unless the person scrolled up to read. */
function chatAfterRender() {
  const log = document.getElementById('st-chat-log'); if (!log || !S?.agent) return;
  if (!S.agent.scrolledUp) log.scrollTop = log.scrollHeight;
  if (!log.dataset.bound) { log.dataset.bound = '1'; log.addEventListener('scroll', () => { if (S?.agent) S.agent.scrolledUp = log.scrollHeight - log.scrollTop - log.clientHeight > 40; }, { passive: true }); }
}

// ------------------------------------------------------------------ actions

async function agentPost(path, body, done) {
  const session = S;
  try { const r = await call(path, { film: session.id, ...body }); if (currentSession(session)) { done?.(r); refreshAgent(true); } return r; }
  catch (e) { if (currentSession(session)) status(e.message, 'error'); refreshAgent(true); }
}
Object.assign(ACTIONS, {
  chat: () => toggleChat(),
  scopeMenu: () => { S.agent.menu = !S.agent.menu; invalidate(['chat']); },
  scope: el => pinScope(el.dataset.kind),
  askScene: () => pinScope('scene'), askLayer: () => pinScope('layer'), askRange: () => pinScope('range'), askMoment: () => pinScope('moment'),
  askNote: el => { const v = versionOf(S.monitor.rev) ?? S.f.versions.at(-1), n = v && notesFor(S.f, v).find(x => x.id === el.dataset.note); if (!n) return; const scene = n.at != null ? v.scenes.find(s => n.at >= s.start && n.at < s.end) : null; pinScope('note', { note: n, beat: scene && beatById(scene.id) ? scene.id : null }); },
  askAsset: el => pinScope('asset', { file: el.dataset.file }),
  suggest: el => { S.agent.draft = el.dataset.text; store.set(`cf-agent-draft:${S.id}`, S.agent.draft); invalidate(['chat']); requestAnimationFrame(() => { const t = document.getElementById('st-chat-input'); t?.focus(); t?.setSelectionRange(t.value.length, t.value.length); }); },
  sendSteer: () => sendMessage('steer'),
  stop: () => agentPost('/api/agent/interrupt', {}, () => status('Stopping the agent…')),
  steer: el => agentPost('/api/agent/queue/steer', { id: el.dataset.id }, () => status('Delivered now: the agent reads it at its next step.')),
  unqueue: el => agentPost('/api/agent/queue/cancel', { id: el.dataset.id }, () => status('Removed from the queue.')),
  permit: el => agentPost('/api/agent/permission', { id: el.dataset.id, decision: el.dataset.decision }, () => status(el.dataset.decision === 'reject' ? 'Denied.' : 'Allowed.')),
  answer: el => {
    const form = el.closest('form'), answer = {};
    if (!el.dataset.cancel) for (const i of form.querySelectorAll('[data-key]')) answer[i.dataset.key] = i.dataset.type === 'bool' ? i.checked : i.multiple ? [...i.selectedOptions].map(o => o.value) : i.dataset.type === 'number' ? Number(i.value) : i.value;
    agentPost('/api/agent/form', { id: el.dataset.id, answer, cancel: !!el.dataset.cancel });
  },
  resend: el => { const o = S.agent.outbox.find(x => x.id === el.dataset.id); if (o) { delete o.failed; invalidate(['chat']); flushOutbox(); } else { const p = S.agent.conv?.pending.find(x => x.id === el.dataset.id); if (p) { S.agent.outbox.push({ id: p.id, submission: p.id, text: p.text, scope: p.scope, delivery: p.delivery ?? 'queue', hash: S.st.hash }); store.set(outboxKey(S.id), S.agent.outbox); flushOutbox(); } } },
  discard: el => { S.agent.outbox = S.agent.outbox.filter(x => x.id !== el.dataset.id); store.set(outboxKey(S.id), S.agent.outbox); agentPost('/api/agent/discard', { submission: el.dataset.id }); invalidate(['chat']); },
  agentRetry: () => { S.agent.draft = S.agent.draft || 'Please try that again.'; invalidate(['chat']); requestAnimationFrame(() => document.getElementById('st-chat-input')?.focus()); },
  agentRefresh: () => refreshAgent(true),
  agentStart: () => { const session = S; call('/api/agent/start', {}).then(() => currentSession(session) && refreshAgent(true)).catch(e => currentSession(session) && status(e.message, 'error')); },
  undoRun: el => cmd({ command: 'undoRun', run: el.dataset.run }).then(() => status('Undid the edits from that reply.')).catch(() => {}),
  agentSettings: () => openAgentSettings(),
});

function bindChat(root) {
  root.addEventListener('submit', e => { if (e.target.matches('.st-compose')) { e.preventDefault(); sendMessage('queue'); } });
  root.addEventListener('input', e => { if (e.target.id === 'st-chat-input') { S.agent.draft = e.target.value; store.set(`cf-agent-draft:${S.id}`, S.agent.draft); } });
  root.addEventListener('keydown', e => {
    if (e.target.id !== 'st-chat-input') return;
    // The composer owns its keys: Enter sends (queues while the agent works), ⇧Enter is a new line, ⌘Enter steers.
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage((e.metaKey || e.ctrlKey) && S.agent.conv?.running ? 'steer' : 'queue'); }
    if (e.key === 'Escape') { e.preventDefault(); if (S.agent.menu) { S.agent.menu = false; invalidate(['chat']); } else e.target.blur(); }
  }, true);
}

// ------------------------------------------------------------------ settings: model, providers, runtime

async function openAgentSettings() {
  const session = S;
  overlay(`<div class="st-dialog wide" role="dialog" aria-modal="true" aria-labelledby="ag-t"><h2 id="ag-t">Agent</h2><div id="ag-body"><p class="st-muted">Loading the runtime and its models…</p></div>
    <div class="st-dialog-actions"><button class="st-btn" data-act="close">Close</button></div></div>`, {
    model: async el => {
      const sel = document.getElementById('ag-model'), opt = sel?.selectedOptions[0]; if (!sel) return;
      if (opt?.dataset.free !== '1' && !confirm(`${opt.textContent}\n\nThis model is billed by its provider to the account connected in this runtime. Use it for this film?`)) return;
      try { await call('/api/agent/model', { film: session.id, model: sel.value }); if (currentSession(session)) { status(`This film now talks to ${sel.value}.`); closeOverlay(); refreshAgent(true); } } catch (e) { if (currentSession(session)) document.getElementById('ag-msg').textContent = e.message; }
    },
    connect: async () => {
      const id = document.getElementById('ag-prov').value, key = document.getElementById('ag-key');
      try { await call('/api/agent/connect', { integrationID: id, key: key.value }); key.value = ''; if (currentSession(session)) { document.getElementById('ag-msg').textContent = `Connected ${id}. Its models appear in the list.`; openAgentSettings(); } }
      catch (e) { key.value = ''; if (currentSession(session)) document.getElementById('ag-msg').textContent = e.message; }
    },
    start: () => { ACTIONS.agentStart(); closeOverlay(); },
  });
  let status_, models = [], integrations = [], err = null;
  try {
    status_ = await call('/api/agent/status');
    if (status_.runtime?.state === 'ready') [models, integrations] = await Promise.all([call('/api/agent/models').then(r => r.models), call('/api/agent/integrations').then(r => r.integrations)]);
  } catch (e) { err = e.message; }
  if (!currentSession(session)) return;
  const el = document.getElementById('ag-body'); if (!el) return;
  const rt = status_?.runtime, current = S.agent.conv?.model ?? 'opencode/big-pickle';
  el.innerHTML = `${err ? `<p class="st-msg-error">${esc(err)}</p>` : ''}
    <h3 class="st-h3">Runtime</h3><p>OpenCode ${esc(rt?.version ?? '')} · <b>${esc(rt?.state ?? 'unknown')}</b>${rt?.catalog ? ` · catalog ${esc(rt.catalog)}` : ''}</p>${rt?.error ? `<p class="st-msg-warn">${esc(rt.error)}</p>` : ''}${rt?.hint ? `<p class="st-hint-text">${esc(rt.hint)}</p>` : ''}
    ${rt?.state !== 'ready' ? '<button class="st-btn small" data-act="start">Start OpenCode</button>' : ''}
    <p class="st-hint-text">An isolated OpenCode ${esc(rt?.version ?? '')} owned by this studio: its sessions and saved provider keys live in <code>.clearframe/opencode</code>. Setup and recovery: <code>docs/agent-studio.md</code>, or run <code>clearframe agent doctor</code>.</p>
    <h3 class="st-h3">Model for this film</h3>
    ${models.length ? `<div class="st-addrow"><select id="ag-model" class="st-select" aria-label="Model">${models.map(m => `<option value="${esc(m.id)}" data-free="${m.free ? 1 : 0}" ${m.id === current ? 'selected' : ''}>${esc(m.name)} — ${esc(m.provider)}${m.free ? ' · free' : ' · paid'}</option>`).join('')}</select><button class="st-btn small primary" data-act="model">Use</button></div>
      <p class="st-hint-text">Big Pickle (OpenCode Zen) is free and is the default. Paid models bill the provider account connected here; ClearFrame never switches to one on its own.</p>` : '<p class="st-muted">Models appear once OpenCode has started and loaded its catalog.</p>'}
    <h3 class="st-h3">Providers</h3>
    ${integrations.filter(i => i.connected).length ? `<ul class="st-decisions">${integrations.filter(i => i.connected).map(i => `<li><b>${esc(i.name)}</b> <span class="st-muted">${esc(i.via.join(', '))}</span></li>`).join('')}</ul>` : '<p class="st-muted">No provider keys connected; free OpenCode Zen models still work.</p>'}
    ${integrations.length ? `<div class="st-addrow"><select id="ag-prov" class="st-select" aria-label="Provider">${integrations.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</select><input id="ag-key" type="password" autocomplete="off" placeholder="API key" aria-label="API key" class="st-filter"><button class="st-btn small" data-act="connect">Connect</button></div>
      <p class="st-hint-text">The key goes to this runtime's own OpenCode credential store, not to the page or the project. Environment variables (for example GEMINI_API_KEY) are picked up automatically.</p>` : ''}
    <p id="ag-msg" class="st-hint-text" role="status"></p>`;
}
