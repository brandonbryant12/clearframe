// The agent: this film's one OpenCode conversation. You talk; the agent edits the film through the
// studio's validated, undoable commands and renders cuts you watch. Every send has a durable id kept
// in an outbox until the server confirms it, so a retry, a refresh or a lost reply never duplicates
// a message. Messages carry what they are about (the whole film, or a note) and the playhead.

const AGENT_POLL_BUSY = 1200, AGENT_POLL_IDLE = 5000;
const newSubmission = () => `msg_cf${Array.from(crypto.getRandomValues(new Uint8Array(24)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;
const outboxKey = id => `cf-agent-outbox:${id}`;
// Only durable fields are stored: whether a send is in flight is this page's state, never saved,
// so a reload (or a crash mid-send) always retries with the same id.
const DURABLE = ['id', 'submission', 'text', 'scope', 'delivery', 'hash', 'revision', 't', 'at', 'failed'];
const durable = o => Object.fromEntries(DURABLE.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
const saveOutbox = session => store.set(outboxKey(session.id), session.agent.outbox.map(durable));
const loadOutbox = id => (Array.isArray(store.get(outboxKey(id), [])) ? store.get(outboxKey(id), []) : []).filter(o => o && typeof o.id === 'string' && typeof o.text === 'string').map(durable);

function agentInit(session) {
  session.agent = { conv: null, draft: store.get(`cf-agent-draft:${session.id}`, ''), outbox: loadOutbox(session.id), sending: new Set(), lastPoll: 0, polling: false, error: null, scrolledUp: false, unseen: false };
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
    const said = c => (c?.messages ?? []).filter(m => m.role === 'assistant').length;
    if (a.conv && said(conv) > said(a.conv) && document.getElementById('agent')?.hidden) a.unseen = true;
    a.conv = conv;
    // Anything the server now knows about leaves the outbox.
    const known = new Set([...conv.messages.filter(m => m.role === 'user').map(m => m.id), ...conv.queued.map(q => q.id), ...conv.pending.map(p => p.id)]);
    if (a.outbox.some(o => known.has(o.id))) { a.outbox = a.outbox.filter(o => !known.has(o.id)); saveOutbox(session); }
    invalidate();
  } catch (e) {
    if (!currentSession(session)) return;
    a.error = e.message; invalidate();
  } finally { a.polling = false; }
}

/** Resend whatever the outbox still holds (same ids: the runtime treats a repeat as the same message). */
async function flushOutbox() {
  const session = S, a = session?.agent; if (!a) return;
  for (const o of [...a.outbox]) {
    if (a.sending.has(o.id)) continue;
    a.sending.add(o.id);
    try {
      const { failed, ...body } = durable(o);
      await call('/api/agent/prompt', { film: session.id, ...body });
      if (!currentSession(session)) return;
      a.outbox = a.outbox.filter(x => x.id !== o.id); saveOutbox(session);
    } catch (e) {
      if (!currentSession(session)) return;
      const kept = a.outbox.find(x => x.id === o.id); if (kept) { kept.failed = e.message; saveOutbox(session); }
      if (e.status && e.status < 500) status(`Not sent: ${e.message}`, 'error');
    } finally { a.sending.delete(o.id); }
  }
  if (currentSession(session)) { invalidate(); refreshAgent(true); }
}

/** Send words to the agent about this film (a scope narrows it to a note), with the version and playhead on screen. */
function say(text, scope = { kind: 'film' }, delivery = 'queue') {
  const a = S?.agent; text = String(text ?? '').trim();
  if (!a || !text) return;
  const o = { id: newSubmission(), text, scope, delivery, hash: null, revision: S.v?.id && S.v.id !== 'latest' ? S.v.id : null, t: Number((S.time?.() ?? 0).toFixed(2)), at: new Date().toISOString() };
  o.submission = o.id;
  a.outbox.push(o); saveOutbox(S);
  a.scrolledUp = false;
  invalidate();
  flushOutbox();
}

// ------------------------------------------------------------------ the conversation on the page

const currentSession = session => !!session && S === session && !session.disposed;
const invalidate = () => drawAgent();
const status = (msg, tone) => toast(esc(msg), tone === 'error' ? 6000 : 3000);

/** The pane: a status line, the conversation, and a composer that is never redrawn under your typing. */
function agentPane(el) {
  el.innerHTML = `<div class="cstate" id="cstate" role="status"></div><div class="log" id="clog" aria-live="polite" aria-label="Conversation"></div>
    <form class="ccompose" id="ccompose" aria-label="Message the agent"><textarea id="cin" rows="2" placeholder="Ask the agent to change anything…" aria-label="Message">${esc(S.agent.draft)}</textarea>
      <div class="crow"><span class="muted small" id="chint">↩ send · ⇧↩ new line</span><span class="grow"></span><button type="button" class="btn small danger" id="cstop" hidden>Stop</button><button type="submit" class="btn small primary" id="csend">Send</button></div></form>`;
  const input = el.querySelector('#cin'), log = el.querySelector('#clog');
  const send = () => { const t = input.value; input.value = ''; S.agent.draft = ''; store.set(`cf-agent-draft:${S.id}`, ''); say(t); };
  el.querySelector('#ccompose').addEventListener('submit', e => { e.preventDefault(); send(); });
  input.addEventListener('input', () => { S.agent.draft = input.value; store.set(`cf-agent-draft:${S.id}`, input.value); });
  input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
  el.querySelector('#cstop').onclick = () => agentPost('/api/agent/interrupt', {}, () => status('Stopping…'));
  log.addEventListener('scroll', () => { if (S?.agent) S.agent.scrolledUp = log.scrollHeight - log.scrollTop - log.clientHeight > 40; }, { passive: true });
  log.addEventListener('click', onLogClick);
  el.querySelector('#cstate').addEventListener('click', e => { if (e.target.closest('[data-act=settings]')) agentSettings(); });
  const timer = setInterval(() => { refreshAgent(); if (S?.agent?.conv?.running) drawAgent(); }, 1000);
  const stop = stopPage; stopPage = () => { clearInterval(timer); stop?.(); };
  drawAgent();
}

let lastLog = '';
function drawAgent() {
  const a = S?.agent, log = document.getElementById('clog'); if (!a || !log) return;
  const conv = a.conv, rt = conv?.runtime, running = !!conv?.running, waitingOnYou = (conv?.permissions?.length ?? 0) + (conv?.forms?.length ?? 0) + (conv?.spend ?? []).filter(x => x.state === 'pending').length;
  const job = S.jobs.find(j => ['draft', 'final'].includes(j.kind) && ['queued', 'waiting', 'running'].includes(j.status));
  const state = !conv ? (a.error ? 'Can’t reach the agent' : 'Connecting…') : rt?.state === 'error' ? 'Needs attention' : waitingOnYou ? 'Waiting for you' : running ? (job ? `Rendering the new cut${job.progress != null && job.status === 'running' ? ` · ${Math.round(job.progress * 100)}%` : '…'}` : 'Working…') : job ? `Rendering the new cut${job.progress != null ? ` · ${Math.round(job.progress * 100)}%` : '…'}` : 'Ready';
  const cs = document.getElementById('cstate');
  if (cs) cs.innerHTML = `<i class="sdot s-${running || job ? 'busy' : waitingOnYou ? 'ask' : rt?.state === 'error' || a.error ? 'bad' : 'ok'}"></i>${esc(state)}<span class="grow"></span><button class="link small muted" data-act="settings">Settings</button>`;
  const dot = document.getElementById('agentdot');
  if (dot) dot.className = `dot ${waitingOnYou ? 'd-ask' : running || job ? 'd-busy' : a.unseen ? 'd-new' : ''}`;
  const stop = document.getElementById('cstop'); if (stop) stop.hidden = !running;
  const sendBtn = document.getElementById('csend'); if (sendBtn) sendBtn.textContent = running ? 'Queue' : 'Send';
  const html = logHTML(a, conv);
  if (html === lastLog && log.childElementCount) return;
  lastLog = html; log.innerHTML = html;
  if (!a.scrolledUp) log.scrollTop = log.scrollHeight;
}

function logHTML(a, conv) {
  let body = '';
  if (a.error && !conv) body += `<div class="ask bad"><b>${esc(a.error)}</b><p>The studio server may have stopped. Start it with <code>clearframe viewer --serve</code>.</p></div>`;
  const rt = conv?.runtime;
  if (rt?.state === 'error') body += `<div class="ask bad"><b>The agent did not start: ${esc(rt.error)}</b>${rt.hint ? `<p>${esc(rt.hint)}</p>` : ''}<p class="muted small">Run <code>clearframe agent doctor</code> in a terminal for details.</p><button class="btn small" data-act="start">Try again</button></div>`;
  if (conv?.lost) body += '<p class="sys">The earlier conversation for this film is no longer available; a new one starts with your next message.</p>';
  // A request's replies read as one block: its steps folded into one line, then what the agent said.
  if (conv) {
    let run = [];
    const flush = live => { if (run.length) body += runHTML(run, conv, live); run = []; };
    conv.messages.forEach((m, i) => { if (m.role === 'assistant') return run.push(m); flush(false); body += messageHTML(m); });
    flush(conv.running);
  }
  // The newest finished request that changed the film can be taken back in one step.
  const lastUser = conv ? conv.messages.map(m => m.role).lastIndexOf('user') : -1;
  const runEdits = lastUser < 0 ? [] : conv.messages.slice(lastUser + 1).flatMap(m => m.parts ?? []).filter(p => p.type === 'tool' && p.own && p.tool === 'edit' && p.status === 'completed');
  if (!conv?.running && runEdits.length) body += `<button class="link small undo" data-act="undo" data-run="${esc(conv.messages[lastUser].id)}">Undo the agent's last changes</button>`;
  if (conv && !conv.messages.length && !a.outbox.length && !conv.pending.length)
    body += `<div class="hello"><p>Tell the agent what to change, or leave notes on the picture and send them. It edits the film and makes a new version for you to watch.</p>
      <div class="suggest">${['Make the opening more gripping', 'Tighten it to under a minute', 'Make it feel less like slides'].map(t => `<button class="chip" data-act="suggest" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>`;
  // Not yet confirmed by the server: sending, or failed with a reason.
  const unsent = [...a.outbox.map(o => ({ ...o, state: a.sending.has(o.id) || !o.failed ? 'sending' : 'failed', error: o.failed })), ...(conv?.pending ?? []).filter(p => !a.outbox.some(o => o.id === p.id))];
  body += unsent.map(o => `<article class="msg you pending"><div class="bubble">${esc(o.text).replace(/\n/g, '<br>')}</div><div class="meta">${o.state === 'failed' ? `Not sent: ${esc(o.error ?? '')} <button class="link" data-act="resend" data-id="${esc(o.id)}">Try again</button> <button class="link" data-act="discard" data-id="${esc(o.id)}">Discard</button>` : 'Sending…'}</div></article>`).join('');
  if (conv) body += firstResponse(conv);
  // Waiting on you: approvals and questions.
  body += (conv?.permissions ?? []).map(p => `<div class="ask"><b>The agent asks to ${esc({ shell: 'run a command on this computer', bash: 'run a command on this computer', webfetch: 'open a web page', websearch: 'search the web' }[p.action] ?? `use ${p.action}`)}</b>
    ${p.resources.map(r => `<pre class="code">${esc(r)}</pre>`).join('')}${p.message ? `<p>${esc(p.message)}</p>` : ''}
    <p class="muted small">Commands can change files outside the film's undo history, or spend money. Allow only what you understand.</p>
    <div class="row left"><button class="btn small" data-act="permit" data-id="${esc(p.id)}" data-decision="once">Allow once</button><button class="btn small danger" data-act="permit" data-id="${esc(p.id)}" data-decision="reject">Don't allow</button></div></div>`).join('');
  body += (conv?.forms ?? []).map(formHTML).join('');
  body += (conv?.spend ?? []).filter(x => x.state === 'pending').map(x => `<div class="ask"><b>The agent asks to spend about ${money(x.estimate)} on Google ${x.kind === 'voice' ? 'narration' : 'music'}</b><p>${esc(x.detail ?? '')}${x.reason ? ` — “${esc(x.reason)}”` : ''}</p>
    <div class="row left"><button class="btn small primary" data-act="spend" data-id="${esc(x.id)}">Review and approve…</button><button class="btn small" data-act="decline" data-id="${esc(x.id)}">No thanks</button></div></div>`).join('');
  if (conv?.queued?.length) body += `<div class="queued"><p class="muted small">${conv.running ? 'Next, after this reply:' : 'Waiting (the agent is stopped):'}</p>${conv.queued.map(q => `<div class="msg you"><div class="bubble">${esc(q.text)}</div><div class="meta"><button class="link" data-act="steer" data-id="${esc(q.id)}">Send now</button> <button class="link" data-act="unqueue" data-id="${esc(q.id)}">Remove</button></div></div>`).join('')}</div>`;
  if (conv) body += quickReplies(conv);
  return body;
}

const money = n => (n < 0.01 ? `$${Number(n).toFixed(4)}` : `$${Number(n).toFixed(2)}`);
/** Your messages and the conversation's own notices. */
function messageHTML(m) {
  if (m.role === 'user') return `<article class="msg you"><div class="bubble">${esc(m.text).replace(/\n/g, '<br>')}</div><div class="meta">${m.at ? esc(when(new Date(m.at).toISOString())) : ''}</div></article>`;
  if (m.role === 'note') return `<p class="sys">${esc(m.text)}</p>`;
  if (m.role === 'idle') return m.outcome === 'succeeded' ? '' : `<p class="sys">${m.outcome === 'interrupted' ? 'Stopped.' : 'That reply did not finish.'}</p>`;
  return '';
}
/** One request's replies: every step folded into one line (open it to see them), then the words. */
function runHTML(msgs, conv, live) {
  const steps = msgs.flatMap(m => m.parts).filter(p => p.type === 'tool'), edits = steps.filter(p => p.own && p.tool === 'edit' && p.status === 'completed');
  const text = msgs.map(m => m.parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n')).filter(t => t.trim()).join('\n\n');
  const doing = steps.filter(p => p.status !== 'completed' && p.status !== 'error').at(-1), last = msgs.at(-1);
  const summary = live ? `<i class="spin"></i>${esc(doing?.title ?? 'Working…')}` : `${plural(steps.length, 'step')}${edits.length ? ` · ${plural(edits.length, 'change')} to the film` : ''}`;
  const stepList = steps.length ? `<details class="steps"><summary>${summary}</summary>
    <ul>${steps.map(p => `<li class="${p.status}">${p.status === 'completed' ? '✓' : p.status === 'error' ? '✕' : '…'} ${esc(p.title)}${p.error ? ` <span class="bad">${esc(p.error)}</span>` : ''}</li>`).join('')}</ul></details>` : live ? '<div class="steps"><i class="spin"></i>Thinking…</div>' : '';
  const errors = msgs.filter(m => m.error).map(m => `<div class="ask bad"><b>${esc(m.error.message)}</b>${m.error.hint ? `<p>${esc(m.error.hint)}</p>` : ''}</div>`).join('');
  return `<article class="msg agentmsg">${stepList}${text ? `<div class="reply">${markdown(text)}</div>` : ''}${errors}
    ${last.retry ? `<p class="sys">Retrying (attempt ${last.retry.attempt}): ${esc(last.retry.message)}</p>` : ''}</article>`;
}

/** A live step says how long it has been silent, and what to do if the provider stalls. */
function waiting(m, label) {
  const secs = Math.max(0, Math.round((Date.now() - (m.at ?? Date.now())) / 1000));
  return `<div class="steps"><i class="spin"></i>${label} <span class="muted">${clock(secs)}</span>${secs > 90 ? '<p class="muted small">No answer for a while: the model may be slow or stalled. Stop, then Send now (or write again) to retry.</p>' : ''}</div>`;
}
/** Before the model's first word: say so, timed from the server's send time (a reload keeps the clock). */
function firstResponse(conv) {
  const last = conv?.messages.at(-1);
  if (!conv?.running || last?.role !== 'user') return '';
  return waiting(last, 'Sent. Waiting for the model’s first response…');
}
/** When the agent ends on a question, answer in one click (the composer still takes anything). */
function quickReplies(conv) {
  if (conv.running || conv.queued.length || conv.permissions.length) return '';
  const last = conv.messages.filter(m => m.role === 'assistant').at(-1), text = last?.parts.filter(p => p.type === 'text').map(p => p.text).join(' ').trim() ?? '';
  if (!/\?[\s*_`"'”)\]]*$/.test(text) || conv.messages.at(-1)?.role === 'user') return '';
  return `<div class="suggest">${['Yes, go ahead.', 'Show me first.', 'Explain the options.'].map(t => `<button class="chip" data-act="quick" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
}

function formHTML(f) {
  const fields = (f.fields ?? []).map(x => {
    const id = `f-${esc(f.id)}-${esc(x.key)}`;
    if (x.type === 'boolean') return `<label class="check"><input type="checkbox" id="${id}" data-key="${esc(x.key)}" data-type="bool"> ${esc(x.label ?? x.key)}</label>`;
    if (x.options?.length) return `<label>${esc(x.label ?? x.key)}<select class="field" id="${id}" data-key="${esc(x.key)}" ${x.type === 'multiselect' ? 'multiple' : ''}>${x.options.map(o => `<option value="${esc(o.value ?? o)}">${esc(o.label ?? o.value ?? o)}</option>`).join('')}</select></label>`;
    return `<label>${esc(x.label ?? x.key)}<input class="field" id="${id}" data-key="${esc(x.key)}" data-type="${x.type === 'number' || x.type === 'integer' ? 'number' : 'text'}"></label>`;
  }).join('');
  return `<form class="ask" data-form="${esc(f.id)}"><b>${esc(f.title)}</b>${fields}<div class="row left"><button type="button" class="btn small primary" data-act="answer" data-id="${esc(f.id)}">Answer</button><button type="button" class="btn small" data-act="answer" data-id="${esc(f.id)}" data-cancel="1">Skip</button></div></form>`;
}

async function agentPost(path, body, done) {
  const session = S;
  try { const r = await call(path, { film: session.id, ...body }); if (currentSession(session)) { done?.(r); refreshAgent(true); } return r; }
  catch (e) { if (currentSession(session)) status(e.message, 'error'); refreshAgent(true); }
}

async function onLogClick(e) {
  const el = e.target.closest('[data-act]'); if (!el || !S) return;
  const act = el.dataset.act, id = el.dataset.id;
  if (act === 'suggest' || act === 'quick') return say(el.dataset.text);
  if (act === 'start') return call('/api/agent/start', {}).then(() => refreshAgent(true)).catch(x => status(x.message, 'error'));
  if (act === 'permit') return agentPost('/api/agent/permission', { id, decision: el.dataset.decision }, () => status(el.dataset.decision === 'reject' ? 'Not allowed.' : 'Allowed once.'));
  if (act === 'steer') return agentPost('/api/agent/queue/steer', { id });
  if (act === 'unqueue') return agentPost('/api/agent/queue/cancel', { id });
  if (act === 'answer') {
    const form = el.closest('form'), answer = {};
    if (!el.dataset.cancel) for (const i of form.querySelectorAll('[data-key]')) answer[i.dataset.key] = i.dataset.type === 'bool' ? i.checked : i.multiple ? [...i.selectedOptions].map(o => o.value) : i.dataset.type === 'number' ? Number(i.value) : i.value;
    return agentPost('/api/agent/form', { id, answer, cancel: !!el.dataset.cancel });
  }
  if (act === 'resend') { const o = S.agent.outbox.find(x => x.id === id); if (o) { delete o.failed; saveOutbox(S); invalidate(); flushOutbox(); } return; }
  if (act === 'discard') { S.agent.outbox = S.agent.outbox.filter(x => x.id !== id); saveOutbox(S); agentPost('/api/agent/discard', { submission: id }); return invalidate(); }
  if (act === 'decline') return agentPost('/api/agent/spend', { id, decision: 'decline', by: myName() || 'the person' }, () => status('Declined.'));
  if (act === 'spend') return spendSheet(S.agent.conv?.spend?.find(x => x.id === id));
  if (act === 'undo') {
    try {
      const st = await call(`/api/studio/state?film=${encodeURIComponent(S.id)}`);
      await call('/api/studio/command', { film: S.id, hash: st.hash, command: 'undoRun', run: el.dataset.run });
      status('Undid those changes. Ask the agent for a new cut when you are ready.');
    } catch (x) { status(x.message, 'error'); }
  }
}

/** Paid generation runs only after a person approves an amount, in their name; the server re-checks everything. */
async function spendSheet(request) {
  if (!request) return;
  const session = S;
  let sound;
  try { sound = await call(`/api/studio/sound?film=${encodeURIComponent(session.id)}`); } catch (e) { return status(e.message, 'error'); }
  if (!currentSession(session)) return;
  const est = request.estimate, cap = Math.ceil(est * 100 - 1e-9) / 100 || 0.01;
  const card = sheet(`<h2>Approve Google ${request.kind === 'voice' ? 'narration' : 'music'}</h2>
    <p>${esc(request.detail ?? '')}</p><p>Estimated cost <b>${money(est)}</b>. You approve up to <b>${money(cap)}</b>; nothing more can be spent.</p>
    ${request.reason ? `<p class="muted">The agent's reason: “${esc(request.reason)}”</p>` : ''}
    <input class="field" id="pay-by" placeholder="Your name (recorded with the approval)" value="${esc(myName())}" autocomplete="name">
    <label class="check"><input type="checkbox" id="pay-ok"> I approve spending up to ${money(cap)} on Google for this film</label>
    <p class="muted small" id="pay-msg" role="status"></p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pay-go">Approve</button></div>`);
  card.querySelector('#pay-go').onclick = async () => {
    const by = card.querySelector('#pay-by').value.trim(), msg = card.querySelector('#pay-msg');
    if (!by || !card.querySelector('#pay-ok').checked) { msg.textContent = 'Enter your name and tick the approval to continue.'; return; }
    store.set('cf-name', by);
    try { await call('/api/agent/spend', { film: session.id, id: request.id, decision: 'approve', by, approve: cap, basis: sound.basis?.[request.kind] }); closeSheet(); status('Approved. The agent can go ahead.'); refreshAgent(true); }
    catch (e) { msg.textContent = `${e.message}${!e.status || e.status >= 500 ? ' (trying again will not charge twice)' : ''}`; }
  };
}

/** How the agent works and which model it uses: the two choices worth keeping on the page. */
async function agentSettings() {
  const session = S, conv = S.agent.conv, mode = conv?.mode ?? 'together', current = conv?.model ?? 'opencode/big-pickle';
  const card = sheet(`<h2>Agent settings</h2>
    <fieldset class="choice"><legend>How it works</legend>
      <label><input type="radio" name="ag-mode" value="oneshot" ${mode === 'oneshot' ? 'checked' : ''}><span><b>Just do it</b> It makes the changes and a new cut, then tells you what it did.</span></label>
      <label><input type="radio" name="ag-mode" value="together" ${mode === 'together' ? 'checked' : ''}><span><b>Check with me first</b> It proposes a plan and asks before each step.</span></label></fieldset>
    <label class="muted small" for="ag-model">Model</label><select class="field" id="ag-model"><option>${esc(current)}</option></select>
    <label class="check" id="ag-paidrow" hidden><input type="checkbox" id="ag-paid"> I understand this model is billed by its provider</label>
    <p class="muted small" id="ag-msg" role="status">The default model is free. Paid models bill the provider account connected to the agent; nothing switches to one on its own.</p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ag-save">Save</button></div>`);
  const sel = card.querySelector('#ag-model'), paidRow = card.querySelector('#ag-paidrow'), msg = card.querySelector('#ag-msg');
  call('/api/agent/models').then(r => {
    if (!currentSession(session) || !r.models?.length) return;
    sel.innerHTML = [...r.models].sort((a, b) => b.free - a.free).map(m => `<option value="${esc(m.id)}" data-free="${m.free ? 1 : 0}" ${m.id === current ? 'selected' : ''}>${esc(m.name)}${m.free ? ' · free' : ' · paid'}</option>`).join('');
  }).catch(() => { msg.textContent = 'The model list appears once the agent has started.'; });
  sel.onchange = () => { paidRow.hidden = sel.selectedOptions[0]?.dataset.free !== '0'; };
  card.querySelector('#ag-save').onclick = async () => {
    const m = card.querySelector('input[name=ag-mode]:checked')?.value, opt = sel.selectedOptions[0];
    if (opt?.dataset.free === '0' && !card.querySelector('#ag-paid').checked) { msg.textContent = 'Tick the box to use a paid model.'; return; }
    try {
      if (m && m !== mode) await call('/api/agent/mode', { film: session.id, mode: m });
      if (opt?.value && opt.dataset.free != null && opt.value !== current) await call('/api/agent/model', { film: session.id, model: opt.value });
      closeSheet(); status('Saved.'); refreshAgent(true);
    } catch (e) { msg.textContent = e.message; }
  };
}
