// The studio's conversation with OpenCode: one session per project, prompts with durable ids,
// a transcript the browser can show (no raw tool output, no credentials), approvals, and the
// bridge that runs OpenCode's ClearFrame tools through the studio's own validated paths.
import fs from 'node:fs';
import path from 'node:path';
import { readLink, updateLink, checkSubmission, sessionIndex } from './links.mjs';
import { parseModel, isFree, DEFAULT_MODEL } from './runtime.mjs';
import { canonical } from '../store.mjs';
import { createTools } from './tools.mjs';
import crypto from 'node:crypto';

const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const SCOPES = new Set(['film', 'scene', 'layer', 'range', 'moment', 'note', 'asset']);

/** A scope the browser snapshotted at send time, checked and bounded. */
export function cleanScope(s) {
  if (s == null) return { kind: 'film' };
  if (typeof s !== 'object' || !SCOPES.has(s.kind)) throw fail('Unknown message scope.');
  const id = v => (typeof v === 'string' && v.length <= 120 ? v : undefined), num = v => (Number.isFinite(v) && v >= 0 && v < 1e6 ? Math.round(v * 1000) / 1000 : undefined);
  const out = { kind: s.kind, label: id(s.label)?.slice(0, 120), beats: Array.isArray(s.beats) ? s.beats.filter(id).slice(0, 50) : undefined,
    element: typeof s.element === 'string' && /^[\w]+(\.[\w]+)*\.\d+$/.test(s.element) && s.element.length <= 120 ? s.element : undefined, from: num(s.from), to: num(s.to), t: num(s.t), note: id(s.note), noteText: typeof s.noteText === 'string' ? clip(s.noteText, 1200) : undefined, asset: id(s.asset) };
  if (['scene', 'layer', 'range', 'moment'].includes(out.kind) && !out.beats?.length) throw fail('That scope names no scenes.');
  if (out.kind === 'layer' && out.beats.length !== 1) throw fail('A layer scope names one scene.');
  if (out.kind === 'layer' && !out.element) throw fail('A layer scope names its element.');
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

const getAt = (o, p) => { for (const k of String(p).split('.')) { if (o == null) return undefined; o = o[k]; } return o; };
/**
 * Check a scope against the working copy at send time and give a layer a stable identity: its list,
 * index, own id (when it has one), type and the list's length. Edits are later held to exactly that
 * element (tools.mjs); a pinned layer that no longer resolves is refused rather than guessed.
 */
export function resolveScope(dir, scope) {
  if (!['scene', 'layer', 'range', 'moment', 'note'].includes(scope.kind) || !scope.beats?.length) return scope;
  const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
  const missing = scope.beats.filter(id => !sb.beats.some(b => b.id === id));
  if (missing.length) throw fail(`The scope names scenes that no longer exist (${missing.join(', ')}). Pin the scope again.`, 409);
  if (scope.kind !== 'layer') return scope;
  const beat = sb.beats.find(b => b.id === scope.beats[0]), parts = scope.element.split('.'), index = Number(parts.at(-1)), list = parts.slice(0, -1).join('.');
  const arr = getAt(beat, list), el = Array.isArray(arr) ? arr[index] : null;
  if (!Number.isInteger(index) || !el || typeof el !== 'object') throw fail('The pinned layer is not in that scene any more. Select it again and pin it.', 409);
  return { ...scope, layer: { list, index, id: typeof el.id === 'string' || typeof el.id === 'number' ? el.id : null, type: el.type ?? null, length: arr.length, sig: sha(canonical(el)) } };
}

/** The context block appended to what the person typed, so the agent works on what they meant. */
export const MODES = {
  oneshot: 'one-shot — carry the request through to a watchable result without stopping for approval at each step: plan briefly, edit in a few labelled batches, render the rough cut (clearframe_render draft) and follow it to the end, then report what is ready and what is a placeholder. Ask only when you are blocked.',
  together: 'together — the person is directing: work in small steps they can follow. Propose a short plan before large changes and wait for their answer; make one change at a time; show it with a still or a section preview; end your reply with one clear question when a decision is theirs.',
};
export const modeOf = l => (l.mode in MODES ? l.mode : 'together');

export function contextBlock({ film, scope, hash, revision, t, mode }) {
  const lines = [`film: ${film.title} (${film.folder})`];
  if (mode) lines.push(`working mode: ${MODES[mode] ?? mode}`);
  const s = scope ?? { kind: 'film' };
  const beats = s.beats?.length ? s.beats.join(', ') : null;
  lines.push(`scope: ${{ film: 'the whole film', scene: `scene ${beats}`, layer: `layer ${s.element} in scene ${beats}`, range: `time range ${s.from ?? '?'}s–${s.to ?? '?'}s (scenes ${beats})`,
    moment: `the moment at ${s.t ?? t ?? '?'}s${beats ? ` (scene ${beats})` : ''}`, note: `review note ${s.note}${beats ? ` on scene ${beats}` : ''}`, asset: `project file ${s.asset}` }[s.kind]}`);
  if (s.noteText) lines.push(`note text: ${s.noteText}`);
  if (t != null) lines.push(`playhead: ${t}s`);
  if (hash) lines.push(`working copy hash when sent: ${hash}`);
  if (revision) lines.push(`revision on screen: ${revision}`);
  return `\n\n<clearframe-context>\n${lines.join('\n')}\n</clearframe-context>`;
}

/** What one tool step looks like in the transcript: its name, a short title, status, never raw output. */
function toolView(part, dir) {
  const st = part.state ?? {}, input = typeof st.input === 'object' && st.input ? st.input : {};
  const relp = p => (typeof p === 'string' ? (path.isAbsolute(p) && p.startsWith(dir) ? path.relative(dir, p) || '.' : p) : '');
  const name = part.name.replace(/^clearframe_/, '');
  const titles = {
    state: () => input.beat ? `Read scene ${input.beat}` : 'Read the film', catalog: () => `Looked up ${input.topic}${input.name ? ` ${input.name}` : ''}`,
    edit: () => input.label ?? 'Edited the film', render: () => `Queued ${input.kind}${input.beat ? ` of ${input.beat}` : input.beats ? ` of ${input.beats.join(', ')}` : ''}`,
    job: () => 'Checked a render', notes: () => 'Read review notes', files: () => input.read ? `Read ${input.read}` : 'Listed project files', write: () => `Rewrote ${input.file === 'brief' ? 'the brief' : 'direction notes'}`,
    sound: () => input.action === 'request' ? `Asked to approve Google ${input.kind === 'music' ? 'music' : 'narration'}` : input.action?.startsWith('draft') ? `Queued a free ${input.action === 'draft-music' ? 'music bed' : 'draft voice'}` : 'Checked the sound',
    guide: () => `Read the ${input.topic} guide`,
  };
  const builtin = { read: () => `Read ${relp(input.filePath ?? input.path)}`, glob: () => `Searched files ${clip(input.pattern, 80)}`, grep: () => `Searched for ${clip(input.pattern, 80)}`,
    shell: () => `Shell: ${clip(input.command, 160)}`, bash: () => `Shell: ${clip(input.command, 160)}`, webfetch: () => `Fetched ${clip(input.url, 120)}`, websearch: () => `Searched the web: ${clip(input.query, 120)}`,
    skill: () => `Used skill ${input.name ?? input.id ?? ''}`, execute: () => 'Ran tool code', edit: () => `Edit ${relp(input.filePath)}`, write: () => `Write ${relp(input.filePath)}` };
  const own = part.name.startsWith('clearframe_');
  let title;
  try { title = (own ? titles[name] : builtin[part.name])?.() ?? part.name; } catch { title = part.name; }
  const meta = st.metadata ?? {};
  return { type: 'tool', id: part.id, tool: own ? name : part.name, own, title: clip(title, 200), status: st.status ?? 'streaming',
    summary: own && st.status === 'completed' && typeof meta.summary === 'string' ? clip(meta.summary, 400) : null,
    job: own && typeof meta.job === 'string' ? meta.job : null, beats: own && Array.isArray(meta.beats) ? meta.beats.slice(0, 50) : null,
    error: st.status === 'error' ? clip(st.error?.message ?? 'Failed', 600) : null };
}

const errorView = e => e && e.type !== 'aborted' && ({ type: e.type, message: clip(e.message, 600), status: e.status ?? null,
  hint: e.type === 'provider.auth' && /free tier/i.test(e.message) ? 'OpenCode\'s free tier refused this request. The studio keeps the shell tool behind approval because the free tier requires it; if this persists, choose another model in Agent settings.'
    : e.type?.startsWith('provider') ? 'The model provider refused or failed this request. Check the provider connection in Agent settings, or choose another model.' : null });

/** The persisted conversation as the browser shows it. */
export function transcript(messages, dir) {
  const out = [];
  for (const m of messages ?? []) {
    if (m.type === 'user') {
      const cf = m.metadata?.clearframe ?? {};
      out.push({ id: m.id, role: 'user', at: m.time?.created, text: typeof cf.text === 'string' ? cf.text : m.text.replace(/\n*<clearframe-context>[\s\S]*<\/clearframe-context>\s*$/, ''), scope: cf.scope ?? null, hash: cf.hash ?? null, revision: cf.revision ?? null, mode: cf.mode ?? null });
    } else if (m.type === 'assistant') {
      const parts = (m.content ?? []).map(p => p.type === 'text' ? { type: 'text', text: p.text } : p.type === 'reasoning' ? { type: 'reasoning', text: clip(p.text, 2000) } : p.type === 'tool' ? toolView(p, dir) : null).filter(Boolean);
      out.push({ id: m.id, role: 'assistant', at: m.time?.created, done: !!m.time?.completed, parts, error: errorView(m.error) || null, stopped: m.error?.type === 'aborted', model: m.model ? `${m.model.providerID}/${m.model.id}` : null, cost: m.cost ?? 0, retry: m.retry ? { attempt: m.retry.attempt, message: clip(m.retry.error?.message, 300) } : null });
    } else if (m.type === 'idle') out.push({ id: m.id, role: 'idle', at: m.time?.created, outcome: m.outcome });
    else if (m.type === 'synthetic' && m.description) out.push({ id: m.id, role: 'note', at: m.time?.created, text: clip(m.description, 300) });
    else if (m.type === 'compaction' || m.type?.startsWith?.('compaction')) out.push({ id: m.id, role: 'note', at: m.time?.created, text: 'Summarised earlier conversation to keep within the model\'s context.' });
  }
  return out;
}

/** Beats a candidate storyboard changes, adds or removes, and whether film-wide settings change. */
export function touched(before, after) {
  const was = new Map(before.beats.map(b => [b.id, canonical(b)])), now = new Map(after.beats.map(b => [b.id, canonical(b)]));
  const beats = new Set();
  for (const [id, c] of now) if (was.get(id) !== c) beats.add(id);
  for (const id of was.keys()) if (!now.has(id)) beats.add(id);
  const order = canonical(before.beats.map(b => b.id).filter(id => now.has(id))) !== canonical(after.beats.map(b => b.id).filter(id => was.has(id)));
  const film = canonical({ ...before, beats: undefined, sources: undefined }) !== canonical({ ...after, beats: undefined, sources: undefined });
  return { beats: [...beats], film, order, added: [...now.keys()].filter(id => !was.has(id)) };
}

export function createAgent({ base = process.cwd(), runtime, jobs, dirs, filmOf, pauseOf }) {
  let index = new Map();
  const verified = new Set();
  /**
   * The persisted conversation, oldest first. session.context is what the model sees and loses the
   * person's earlier messages when OpenCode compacts; message.list keeps everything.
   */
  async function history(c, sessionID, { until = null, limit = 300, pages = 10 } = {}) {
    const out = [];
    let cursor;
    for (let i = 0; i < pages; i++) {
      // The first page sets the order; OpenCode refuses an order alongside a cursor.
      const r = await c.message.list({ sessionID, limit: Math.min(limit, 200), ...(cursor ? { cursor } : { order: 'desc' }) });
      const page = Array.isArray(r) ? r : r?.data ?? [];
      out.push(...page);
      cursor = r?.cursor?.next;
      if (!cursor || !page.length || out.length >= limit || (until && until(out))) return { messages: out.reverse(), more: !!cursor };
    }
    return { messages: out.reverse(), more: !!cursor };
  }
  const reindex = () => { index = sessionIndex(dirs()); return index; };
  const client = () => runtime.client();
  const guard = async fn => { try { return await fn(await client()); } catch (e) { runtime.lost(e); throw e.status ? e : fail(e.message, 502); } };

  /** One promise chain per project: work that reads, then writes, a project's link never interleaves. */
  const chains = new Map();
  function serial(dir, fn) {
    let key; try { key = fs.realpathSync(dir); } catch { key = path.resolve(dir); }
    const run = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => {});
    chains.set(key, tail);
    tail.then(() => { if (chains.get(key) === tail) chains.delete(key); });
    return run;
  }

  /**
   * The project's one conversation, created on first use. Creation is serialised per project in this
   * server, and the link is written compare-and-set: if another studio process linked the project
   * meanwhile, its session wins and the one made here is removed, so a project never has two.
   */
  function session(dir, { create = true } = {}) {
    return serial(dir, async () => {
      const link = readLink(dir);
      const c = await client();
      if (link.sessionID && !verified.has(link.sessionID)) {
        const ok = await c.session.get({ sessionID: link.sessionID }).then(() => true, e => (/not found|404/i.test(e.message) ? false : Promise.reject(e)));
        if (ok) verified.add(link.sessionID);
        else updateLink(dir, l => (l.sessionID === link.sessionID ? { ...l, previous: [...(l.previous ?? []), { sessionID: l.sessionID, lostAt: new Date().toISOString() }], sessionID: null } : l));
      }
      const now = readLink(dir);
      if (now.sessionID || !create) return now;
      const film = filmOf(dir);
      const model = now.model ?? DEFAULT_MODEL;
      const s = await c.session.create({ location: { directory: dir }, title: clip(film?.title ?? path.basename(dir), 120), model: { providerID: model.providerID, id: model.id }, metadata: { clearframe: { folder: path.relative(base, dir) } } });
      let won = true;
      const l = updateLink(dir, x => { if (x.sessionID) { won = false; return x; } return { ...x, sessionID: s.id, model, createdAt: x.createdAt ?? new Date().toISOString() }; });
      if (!won) { await c.session.remove({ sessionID: s.id }).catch(() => {}); verified.add(l.sessionID); index.set(l.sessionID, dir); return l; }
      verified.add(s.id);
      index.set(s.id, dir);
      return l;
    });
  }

  async function conversation(dir) {
    const status = runtime.status();
    const link = readLink(dir);
    const pending = (link.submissions ?? []).filter(s => s.state !== 'sent').map(({ id, text, scope, state, error, at, delivery }) => ({ id, text, scope, state, error, at, delivery }));
    const base = { runtime: status, linked: !!link.sessionID, mode: modeOf(link), spend: (link.spend ?? []).slice(-10), model: link.model ? `${link.model.providerID}/${link.model.id}` : `${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}`, pending,
      lost: (link.previous ?? []).length ? link.previous.at(-1) : null };
    if (!link.sessionID) return { ...base, messages: [], running: false, queued: [], permissions: [], forms: [] };
    return guard(async c => {
      await session(dir, { create: false });
      const sid = readLink(dir).sessionID;
      if (!sid) return { ...base, linked: false, messages: [], running: false, queued: [], permissions: [], forms: [] };
      const [{ messages: ctx, more }, active, inbox, perms, forms, info] = await Promise.all([
        history(c, sid), c.session.active(), c.session.inbox.list({ sessionID: sid }).catch(() => []),
        c.permission.list({ sessionID: sid }).catch(() => []), c.session.form.list({ sessionID: sid }).catch(() => []), c.session.get({ sessionID: sid }).catch(() => null)]);
      const messages = transcript(ctx, dir);
      const seen = new Set(messages.filter(m => m.role === 'user').map(m => m.id));
      const queued = (inbox ?? []).filter(i => i.type === 'user').map(i => ({ id: i.id, text: i.payload?.metadata?.clearframe?.text ?? clip(i.payload?.text, 2000), scope: i.payload?.metadata?.clearframe?.scope ?? null, delivery: i.delivery }));
      const inQueue = new Set(queued.map(q => q.id));
      return { ...base, sessionID: sid, messages, earlier: more, running: !!active?.[sid], queued, cost: info?.cost ?? 0, outcome: info?.outcome ?? null,
        pending: base.pending.filter(p => !seen.has(p.id) && !inQueue.has(p.id)),
        permissions: (perms ?? []).map(p => ({ id: p.id, action: p.action, resources: (p.resources ?? []).slice(0, 8).map(r => clip(r, 300)), message: clip(p.message, 400), save: p.save ?? [] })),
        forms: (forms ?? []).map(f => ({ id: f.id, title: clip(f.title, 300), fields: f.fields })) };
    });
  }

  async function prompt(dir, body) {
    const id = checkSubmission(body.submission);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 20000) throw fail('Write a message (up to 20,000 characters).');
    const scope = resolveScope(dir, cleanScope(body.scope)), delivery = body.delivery === 'steer' ? 'steer' : 'queue';
    const hash = typeof body.hash === 'string' ? body.hash.slice(0, 64) : null, revision = typeof body.revision === 'string' ? body.revision.slice(0, 20) : null;
    const t = Number.isFinite(body.t) ? Math.round(body.t * 100) / 100 : null;
    const existing = readLink(dir).submissions.find(s => s.id === id);
    if (existing?.state === 'sent') return { submission: id, state: 'sent', duplicate: true };
    updateLink(dir, l => { l.submissions = [...l.submissions.filter(s => s.id !== id), { id, text, scope, delivery, hash, revision, t, at: existing?.at ?? new Date().toISOString(), state: 'sending' }]; });
    const film = filmOf(dir) ?? { title: path.basename(dir), folder: path.relative(base, dir) };
    try {
      return await guard(async c => {
        const { sessionID } = await session(dir);
        const mode = modeOf(readLink(dir));
        await c.session.prompt({ sessionID, id, text: text + contextBlock({ film, scope, hash, revision, t, mode }), delivery,
          metadata: { clearframe: { text, scope, hash, revision, t, mode, film: path.relative(base, dir) } } });
        updateLink(dir, l => { const s = l.submissions.find(x => x.id === id); if (s) { s.state = 'sent'; delete s.error; } });
        return { submission: id, state: 'sent' };
      });
    } catch (e) {
      updateLink(dir, l => { const s = l.submissions.find(x => x.id === id); if (s) { s.state = 'failed'; s.error = clip(e.message, 400); } });
      throw e;
    }
  }

  const tools = createTools({ base, jobs, filmOf, pauseOf, currentScope });
  const sid = dir => { const s = readLink(dir).sessionID; if (!s) throw fail('This film has no conversation yet.', 409); return s; };
  const ownsForm = async (c, sessionID, id) => (await c.session.form.list({ sessionID })).some(f => f.id === id);

  return {
    reindex, conversation, prompt, session,
    setMode(dir, mode) { if (!(mode in MODES)) throw fail('Choose one-shot or together.'); updateLink(dir, l => ({ ...l, mode })); return { mode }; },
    discard(dir, id) { checkSubmission(id); updateLink(dir, l => { l.submissions = l.submissions.filter(s => s.id !== id || s.state === 'sent'); }); return { ok: true }; },
    interrupt: dir => guard(c => c.session.interrupt({ sessionID: sid(dir), resume: false })),
    cancelQueued: (dir, inboxID) => guard(c => c.session.inbox.cancel({ sessionID: sid(dir), inboxID: String(inboxID) })).then(() => ({ ok: true })),
    steerQueued: (dir, inboxID) => guard(c => c.session.inbox.update({ sessionID: sid(dir), inboxID: String(inboxID), delivery: 'steer' })).then(() => ({ ok: true })),
    async permission(dir, { id, decision }) {
      if (!['once', 'always', 'reject'].includes(decision)) throw fail('Choose allow once, always, or reject.');
      return guard(async c => {
        const s = sid(dir), list = await c.permission.list({ sessionID: s });
        if (!list.some(p => p.id === id)) throw fail('That request was already answered.', 409);
        // A refusal says why, so the agent can carry on without the command instead of stopping.
        await c.permission.reply({ sessionID: s, requestID: id, decision, ...(decision === 'reject' ? { message: 'The person declined this. Do not retry it; continue with the ClearFrame tools (clearframe_guide has the docs), or explain what you need and why.' } : {}) });
        return { ok: true };
      });
    },
    async form(dir, { id, answer, cancel }) {
      return guard(async c => {
        const s = sid(dir);
        if (!(await ownsForm(c, s, id))) throw fail('That question was already answered.', 409);
        if (cancel) await c.session.form.cancel({ sessionID: s, formID: id });
        else await c.session.form.reply({ sessionID: s, formID: id, answer: answer ?? {} });
        return { ok: true };
      });
    },
    async models() {
      const list = await guard(() => runtime.models({ refresh: true }));
      return list.filter(m => m.enabled && m.capabilities?.tools !== false && (m.capabilities?.output ?? ['text']).includes('text'))
        .map(m => ({ id: `${m.providerID}/${m.id}`, name: m.name, provider: m.providerID, free: isFree(m), status: m.status, context: m.limit?.context ?? null }))
        .sort((a, b) => (b.free - a.free) || a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
    },
    async setModel(dir, value) {
      const model = parseModel(value);
      if (!model) throw fail('Choose a model.');
      const list = await guard(() => runtime.models());
      if (!list.some(m => m.providerID === model.providerID && m.id === model.id && m.enabled)) throw fail('That model is not available in this runtime.');
      const link = readLink(dir);
      if (link.sessionID) await guard(c => c.session.switchModel({ sessionID: link.sessionID, model: { providerID: model.providerID, id: model.id } }));
      updateLink(dir, l => ({ ...l, model }));
      return { model: `${model.providerID}/${model.id}` };
    },
    async integrations() {
      return guard(async c => {
        const r = await c.integration.list({ location: { directory: base } });
        return (Array.isArray(r) ? r : r.data ?? []).filter(i => (i.methods ?? []).some(m => m.type === 'key')).map(i => ({ id: i.id, name: i.name, connected: (i.connections ?? []).length > 0,
          via: (i.connections ?? []).map(x => (x.type === 'env' ? `environment ${x.name}` : `saved ${x.method}`)) }));
      });
    },
    async connectKey({ integrationID, key }) {
      if (typeof integrationID !== 'string' || !/^[\w.-]{1,60}$/.test(integrationID)) throw fail('Choose a provider.');
      if (typeof key !== 'string' || key.trim().length < 8 || key.length > 4000) throw fail('Paste the provider\'s API key.');
      // The key goes straight to OpenCode's own credential store in the studio runtime; ClearFrame keeps no copy.
      await guard(c => c.integration.connect.key({ integrationID, key: key.trim(), location: { directory: base } }));
      return { ok: true };
    },
    /** One ClearFrame tool call from the OpenCode plugin. */
    async bridge(body, { wait } = {}) {
      const sessionID = String(body.sessionID ?? '');
      const dir = index.get(sessionID) ?? reindex().get(sessionID);
      if (!dir) throw fail('This conversation is not linked to a ClearFrame film in this studio.', 403);
      const input = body.input && typeof body.input === 'object' ? body.input : {};
      const tool = tools[body.tool];
      if (!tool) throw fail('Unknown ClearFrame tool.', 404);
      return tool({ dir, input, sessionID, messageID: typeof body.messageID === 'string' ? body.messageID : null, wait });
    },
  };

  // ------------------------------------------------------------------ tools

  /**
   * The request an executing tool call answers: the person's message that precedes the assistant
   * message making the call. Fails closed: if OpenCode cannot be asked, or the call's message is not
   * in this conversation, nothing is changed (a narrow request must never become a film-wide edit).
   */
  async function currentScope(sessionID, messageID) {
    let ctx;
    // From the persisted history, not the model's (compactable) context: the request survives compaction.
    const answered = list => { const k = list.findIndex(m => m.id === messageID); return k >= 0 && list.slice(k + 1).some(m => m.type === 'user'); };
    try { ctx = (await history(await client(), sessionID, { limit: 2000, pages: 20, until: answered })).messages; }
    catch { throw fail('Could not confirm which request this edit answers (OpenCode did not respond), so nothing was changed. Try the edit again.', 503); }
    const i = typeof messageID === 'string' ? ctx.findIndex(m => m.id === messageID) : -1;
    if (i < 0) throw fail('This edit does not come from a reply in this film\'s conversation, so nothing was changed.', 409);
    const user = ctx.slice(0, i).reverse().find(m => m.type === 'user');
    if (!user) throw fail('This edit answers no request from the person, so nothing was changed.', 409);
    return { scope: user.metadata?.clearframe?.scope ?? { kind: 'film' }, run: user.id };
  }
}
