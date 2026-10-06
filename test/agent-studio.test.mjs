// The browser studio's OpenCode integration: project links, uploads, scope and lifecycle. The
// OpenCode client is a stand-in here (no network, no model); docs/agent-studio.md records the
// real free-model runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { createAgent, resolveScope, cleanScope, contextBlock, transcript } from '../engine/lib/agent/agent.mjs';
import { scopeViolation, inside } from '../engine/lib/agent/tools.mjs';
import { readLink, updateLink } from '../engine/lib/agent/links.mjs';
import { uploadToProject, uploadToDraft, createProject, safeName, projectsRoot } from '../engine/lib/agent/projects.mjs';
import { createRuntime, runtimeConfig, agentPaths, PERMISSIONS } from '../engine/lib/agent/runtime.mjs';
import { studioState, studioCommand } from '../engine/lib/viewer/studio.mjs';

const SB = { version: 2, title: 'Film', music: false, beats: [
  { id: 'a', block: 'title', duration: 3, props: { text: 'First' } },
  { id: 'b', block: 'statement', duration: 4, props: { text: 'Second' } },
  { id: 'c', block: 'canvas', duration: 4, props: { elements: [{ type: 'text', text: 'One', x: 100, y: 100 }, { type: 'text', text: 'Two', x: 100, y: 300 }, { type: 'rect', x: 0, y: 0, w: 10, h: 10 }] } },
] };
const tmp = (t, prefix = 'cf-agent-') => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return fs.realpathSync(d); };
const project = (t, sb = SB) => { const d = tmp(t); fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify(sb)); return d; };
const tick = () => new Promise(r => setImmediate(r));

/** A stand-in OpenCode client: sessions, context and calls are recorded; `gate` holds creates open. */
function fakeClient({ gate } = {}) {
  const calls = { created: [], removed: [], prompts: [] }, contexts = new Map();
  let n = 0;
  const c = {
    calls, contexts,
    session: {
      get: async ({ sessionID }) => { if (calls.removed.includes(sessionID) || !calls.created.includes(sessionID)) throw new Error('Session not found (404)'); return { id: sessionID }; },
      create: async () => { const id = `ses_${++n}`; calls.created.push(id); if (gate) await gate; return { id }; },
      remove: async ({ sessionID }) => { calls.removed.push(sessionID); },
      prompt: async input => { calls.prompts.push(input); return { id: input.id }; },
      context: async ({ sessionID }) => { const ctx = contexts.get(sessionID); if (ctx instanceof Error) throw ctx; return ctx ?? []; },
      active: async () => ({}), inbox: { list: async () => [] }, form: { list: async () => [] },
    },
    permission: { list: async () => [] },
  };
  return c;
}
const runtimeOf = client => ({ client: async () => client, status: () => ({ state: 'ready' }), lost() {}, models: async () => [] });
function agentFor(dirs, client, extra = {}) {
  const jobs = { list: () => [], start: () => ({ id: 'job' }), pausing: () => null };
  return createAgent({ base: os.tmpdir(), runtime: runtimeOf(client), jobs, dirs: () => dirs, filmOf: d => ({ id: path.basename(d), title: 'Film', folder: d }), pauseOf: () => null, ...extra });
}

// ------------------------------------------------------------------ one conversation per project

test('concurrent first use of a project creates exactly one conversation, and projects stay separate', async t => {
  const a = project(t), b = project(t);
  let open; const gate = new Promise(r => { open = r; });
  const client = fakeClient({ gate }), agent = agentFor([a, b], client);
  const first = agent.session(a), second = agent.session(a), other = agent.session(b);
  await tick(); open();
  const [x, y, z] = await Promise.all([first, second, other]);
  assert.equal(x.sessionID, y.sessionID, 'both callers get the same conversation');
  assert.equal(readLink(a).sessionID, x.sessionID, 'and it is the one persisted');
  assert.notEqual(z.sessionID, x.sessionID, 'another project has its own conversation');
  assert.equal(client.calls.created.length, 2, 'one create per project');
});

test('concurrent first prompts share one conversation; a repeated submission id is sent once', async t => {
  const a = project(t), client = fakeClient(), agent = agentFor([a], client);
  const id = 'msg_cfaaaaaaaaaaaaaaaaaaaaaaaa', other = 'msg_cfbbbbbbbbbbbbbbbbbbbbbbbb';
  const r = await Promise.all([agent.prompt(a, { submission: id, text: 'One' }), agent.prompt(a, { submission: other, text: 'Two' })]);
  assert.deepEqual(r.map(x => x.state), ['sent', 'sent']);
  assert.equal(new Set(client.calls.prompts.map(p => p.sessionID)).size, 1);
  assert.equal(client.calls.created.length, 1);
  const again = await agent.prompt(a, { submission: id, text: 'One' });
  assert.equal(again.duplicate, true);
  assert.equal(client.calls.prompts.filter(p => p.id === id).length, 1, 'a retried send is not prompted twice');
  // What the agent reads carries the scope; what the person sees is their own words.
  assert.match(client.calls.prompts[0].text, /<clearframe-context>[\s\S]*scope: the whole film/);
  assert.equal(client.calls.prompts[0].metadata.clearframe.text, 'One');
});

test('a link written by another studio process wins; the duplicate session made here is removed', async t => {
  const a = project(t);
  let open; const gate = new Promise(r => { open = r; });
  const client = fakeClient({ gate }), agent = agentFor([a], client);
  const pending = agent.session(a);
  await tick();
  updateLink(a, l => ({ ...l, sessionID: 'ses_elsewhere' })); client.calls.created.push('ses_elsewhere');
  open();
  const l = await pending;
  assert.equal(l.sessionID, 'ses_elsewhere');
  assert.deepEqual(client.calls.removed, ['ses_1']);
});

test('a failed create releases the project for the next attempt', async t => {
  const a = project(t), client = fakeClient(), agent = agentFor([a], client);
  const create = client.session.create; let fails = 1;
  client.session.create = async x => { if (fails-- > 0) throw new Error('boom'); return create(x); };
  await assert.rejects(agent.session(a), /boom/);
  const l = await agent.session(a);
  assert.ok(l.sessionID);
});

// ------------------------------------------------------------------ uploads

const stream = (text, { fail = false } = {}) => { const s = new PassThrough(); s.headers = {}; setImmediate(() => { s.write(text); fail ? s.destroy(new Error('reset')) : s.end(); }); return s; };

test('concurrent same-name uploads keep both files under distinct names (project and draft)', async t => {
  const a = project(t);
  const r = await Promise.all([uploadToProject(a, stream('first'), 'notes.txt'), uploadToProject(a, stream('second'), 'notes.txt'), uploadToProject(a, stream('third'), 'notes.txt')]);
  const names = r.map(x => x.file);
  assert.equal(new Set(names).size, 3);
  assert.deepEqual(names.map(n => fs.readFileSync(path.join(a, n), 'utf8')).sort(), ['first', 'second', 'third']);
  const uploads = tmp(t);
  const d = await Promise.all([uploadToDraft(uploads, 'draft-12345678', stream('x'), 'brief.md'), uploadToDraft(uploads, 'draft-12345678', stream('y'), 'brief.md')]);
  assert.notEqual(d[0].file, d[1].file);
  assert.deepEqual(fs.readdirSync(path.join(uploads, 'draft-12345678')).sort(), ['brief-2.md', 'brief.md']);
});

test('an existing file is never replaced; interrupted and oversized uploads leave nothing behind', async t => {
  const a = project(t);
  fs.mkdirSync(path.join(a, 'source')); fs.writeFileSync(path.join(a, 'source/notes.txt'), 'original');
  const r = await uploadToProject(a, stream('new'), 'notes.txt');
  assert.equal(r.file, 'source/notes-2.txt');
  assert.equal(fs.readFileSync(path.join(a, 'source/notes.txt'), 'utf8'), 'original');
  await assert.rejects(uploadToProject(a, stream('partial', { fail: true }), 'cut.txt'), /interrupted/);
  const big = new PassThrough(); big.headers = { 'content-length': String(30e6) };
  await assert.rejects(uploadToProject(a, big, 'big.pdf'), /larger than/);
  assert.deepEqual(fs.readdirSync(path.join(a, 'source')).sort(), ['notes-2.txt', 'notes.txt'], 'no temporary or partial files');
});

test('upload names are sanitised and typed; a symlinked folder cannot lead uploads outside the project', async t => {
  assert.equal(safeName('../../etc/My Notes!.MD').name, 'My-Notes.md');
  assert.equal(safeName('.hidden.txt').name, 'hidden.txt');
  assert.throws(() => safeName('run.sh'), /does not take/);
  const a = project(t), outside = tmp(t);
  fs.symlinkSync(outside, path.join(a, 'source'));
  await assert.rejects(uploadToProject(a, stream('x'), 'notes.txt'), /outside the project/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('tool file reads resolve real paths: links out of the project are refused', t => {
  const a = project(t), outside = tmp(t);
  fs.writeFileSync(path.join(outside, 'secret.md'), 'secret');
  fs.mkdirSync(path.join(a, 'source'));
  fs.symlinkSync(path.join(outside, 'secret.md'), path.join(a, 'source/link.md'));
  fs.writeFileSync(path.join(a, 'source/ok.md'), 'ok');
  assert.equal(fs.readFileSync(inside(a, 'source/ok.md'), 'utf8'), 'ok');
  assert.throws(() => inside(a, 'source/link.md'), /outside the project/);
  assert.throws(() => inside(a, '../x.md'), /outside the project/);
  assert.throws(() => inside(a, '.clearframe/x'), /outside the project/);
});

// ------------------------------------------------------------------ scope

const clone = x => structuredClone(x);
test('scene, range and moment scopes limit edits to their scenes, without film settings or reordering', () => {
  const scene = { kind: 'scene', beats: ['a'] };
  const ok = clone(SB); ok.beats[0].props.text = 'Changed';
  assert.equal(scopeViolation(scene, SB, ok), null);
  const other = clone(ok); other.beats[1].props.text = 'Also';
  assert.match(scopeViolation(scene, SB, other), /scenes b/);
  const film = clone(ok); film.title = 'New';
  assert.match(scopeViolation({ kind: 'moment', beats: ['a'] }, SB, film), /film-wide/);
  const order = clone(SB); order.beats.reverse();
  assert.match(scopeViolation({ kind: 'range', beats: ['a', 'b', 'c'] }, SB, order), /order/);
  assert.equal(scopeViolation({ kind: 'film' }, SB, other), null);
  assert.equal(scopeViolation({ kind: 'note', note: 'n001', beats: [] }, SB, other), null, 'a whole-cut note limits nothing');
  assert.equal(scopeViolation({ kind: 'asset', asset: 'source/a.md' }, SB, other), null, 'a file is context, not a limit');
});

test('a layer scope holds edits to that one element, by identity, and refuses a re-ordered or changed layer', t => {
  const d = project(t);
  const scope = resolveScope(d, cleanScope({ kind: 'layer', beats: ['c'], element: 'props.elements.1' }));
  assert.deepEqual({ ...scope.layer, sig: undefined }, { list: 'props.elements', index: 1, id: null, type: 'text', length: 3, sig: undefined });
  const mine = clone(SB); mine.beats[2].props.elements[1].text = 'Changed';
  assert.equal(scopeViolation(scope, SB, mine), null);
  const removed = clone(SB); removed.beats[2].props.elements.splice(1, 1);
  assert.equal(scopeViolation(scope, SB, removed), null, 'removing the pinned layer is inside its scope');
  const sibling = clone(SB); sibling.beats[2].props.elements[0].text = 'Nope';
  assert.match(scopeViolation(scope, SB, sibling), /other layers/);
  const prop = clone(mine); prop.beats[2].duration = 9;
  assert.match(scopeViolation(scope, SB, prop), /other properties/);
  // The person reorders the layers after pinning: index 1 now holds another element.
  const moved = clone(SB); const els = moved.beats[2].props.elements; [els[0], els[1]] = [els[1], els[0]];
  const after = clone(moved); after.beats[2].props.elements[1].text = 'Wrong target';
  assert.match(scopeViolation(scope, moved, after), /moved or changed/);
  // A pinned layer that no longer exists is refused at send time.
  assert.throws(() => resolveScope(d, cleanScope({ kind: 'layer', beats: ['c'], element: 'props.elements.9' })), /not in that scene/);
  assert.throws(() => resolveScope(d, cleanScope({ kind: 'scene', beats: ['gone'] })), /no longer exist/);
  assert.throws(() => cleanScope({ kind: 'layer', beats: ['c'], element: '__proto__.x' }), /names its element/);
});

test('an element with its own id is followed through a reorder', t => {
  const sb = clone(SB); sb.beats[2].props.elements[1].id = 'two';
  const d = project(t, sb);
  const scope = resolveScope(d, cleanScope({ kind: 'layer', beats: ['c'], element: 'props.elements.1' }));
  const moved = clone(sb); const els = moved.beats[2].props.elements; [els[0], els[1]] = [els[1], els[0]];
  const after = clone(moved); after.beats[2].props.elements.find(e => e.id === 'two').text = 'Followed';
  assert.equal(scopeViolation(scope, moved, after, { runEdited: true }), null);
});

// ------------------------------------------------------------------ the bridge: edits answer their own request, fail closed

function bridged(t, ctx) {
  const d = project(t), client = fakeClient(), agent = agentFor([d], client);
  updateLink(d, l => ({ ...l, sessionID: 'ses_1' })); client.calls.created.push('ses_1');
  client.contexts.set('ses_1', ctx);
  agent.reindex();
  const edit = (messageID, ops) => agent.bridge({ tool: 'edit', sessionID: 'ses_1', messageID, input: { hash: studioState(d).hash, label: 'Agent change', ops } });
  return { d, client, edit };
}
const user = (id, scope) => ({ id, type: 'user', text: 'x', metadata: { clearframe: { text: 'x', scope } } });
const asst = id => ({ id, type: 'assistant', content: [] });
const setText = (beat, text) => [{ command: 'set', target: 'beat', beat, path: 'props.text', value: text }];

test('an edit is held to the scope of the request it answers, even after a later message is queued or steered in', async t => {
  const { d, edit } = bridged(t, [user('msg_A', { kind: 'scene', beats: ['a'], label: 'Scene: First' }), asst('msg_M1'), user('msg_B', { kind: 'film' }), asst('msg_M2')]);
  await assert.rejects(edit('msg_M1', setText('b', 'Out of scope')), e => e.status === 409 && /limited this request/.test(e.message));
  assert.equal(studioState(d).storyboard.beats[1].props.text, 'Second', 'nothing written');
  await edit('msg_M1', setText('a', 'In scope'));
  await edit('msg_M2', setText('b', 'Film-wide request'));
  const h = studioState(d).history;
  assert.deepEqual(h.map(x => [x.by, x.run]), [['agent', 'msg_A'], ['agent', 'msg_B']], 'each edit is grouped under the request it answers');
});

test('if the request cannot be identified, nothing is changed', async t => {
  const { d, client, edit } = bridged(t, [user('msg_A', { kind: 'scene', beats: ['a'] }), asst('msg_M1')]);
  await assert.rejects(edit('msg_unknown', setText('a', 'x')), e => e.status === 409);
  await assert.rejects(edit(null, setText('a', 'x')), e => e.status === 409);
  client.contexts.set('ses_1', new Error('socket hang up'));
  await assert.rejects(edit('msg_M1', setText('a', 'x')), e => e.status === 503);
  assert.equal(studioState(d).storyboard.beats[0].props.text, 'First');
  assert.equal(studioState(d).history.length, 0);
});

test('a tool call from a session no project links to is refused', async t => {
  const { edit } = bridged(t, []);
  const d = project(t), agent = agentFor([d], fakeClient());
  await assert.rejects(agent.bridge({ tool: 'state', sessionID: 'ses_nobody', input: {} }), e => e.status === 403);
  assert.ok(edit);
});

test('one request\'s edits undo together, only while they are the newest', t => {
  const d = project(t);
  const step = (beat, text, run) => studioCommand(d, { hash: studioState(d).hash, command: 'set', target: 'beat', beat, path: 'props.text', value: text }, { actor: { by: 'agent', run } });
  step('a', 'A1', 'msg_run'); step('b', 'B1', 'msg_run');
  let s = studioCommand(d, { hash: studioState(d).hash, command: 'undoRun', run: 'msg_run' });
  assert.deepEqual(s.storyboard.beats.slice(0, 2).map(b => b.props.text), ['First', 'Second']);
  s = studioCommand(d, { hash: s.hash, command: 'redo' });
  assert.equal(s.storyboard.beats[0].props.text, 'A1');
  step('b', 'B1', 'msg_run');
  studioCommand(d, { hash: studioState(d).hash, command: 'set', target: 'beat', beat: 'a', path: 'props.text', value: 'Person' });
  assert.throws(() => studioCommand(d, { hash: studioState(d).hash, command: 'undoRun', run: 'msg_run' }), /Later edits/);
});

// ------------------------------------------------------------------ transcript, context, projects, runtime

test('the transcript shows the person\'s own words and tool titles, never raw tool output', () => {
  const m = transcript([
    { id: 'msg_u', type: 'user', time: { created: 1 }, text: 'Do it\n\n<clearframe-context>\nsecret\n</clearframe-context>', metadata: {} },
    { id: 'msg_a', type: 'assistant', time: { created: 2, completed: 3 }, content: [{ type: 'tool', id: 't', name: 'read', state: { status: 'completed', input: { filePath: '/p/source/a.md' }, content: [{ type: 'text', text: 'FILE CONTENTS' }] } }] },
  ], '/p');
  assert.equal(m[0].text, 'Do it');
  assert.equal(m[1].parts[0].title, 'Read source/a.md');
  assert.ok(!JSON.stringify(m).includes('FILE CONTENTS'));
  assert.match(contextBlock({ film: { title: 'T', folder: 'f' }, scope: { kind: 'layer', beats: ['c'], element: 'props.elements.1' }, hash: 'h', t: 2 }), /layer props\.elements\.1 in scene c/);
});

test('new films are created once per request, live in the projects folder and are found again after a restart', async t => {
  const base = tmp(t), root = projectsRoot(base, 'projects'), uploads = path.join(base, '.clearframe/uploads');
  assert.throws(() => projectsRoot(base, '/elsewhere'), /must be inside/);
  const body = { request: 'req-12345678', idea: 'Why tides happen, for teenagers.', title: 'Tides', playbook: 'concept-explainer' };
  const dir = createProject(root, uploads, body);
  assert.equal(createProject(root, uploads, body), dir, 'a retried create returns the same film');
  assert.equal(readLink(dir).createdBy, 'req-12345678');
  const twin = createProject(root, uploads, { ...body, request: 'req-abcdefgh' });
  assert.notEqual(twin, dir, 'the same title twice gets two folders');
  const { buildViewer } = await import('../engine/lib/viewer/build.mjs');
  const cwd = process.cwd(); process.chdir(base);
  try {
    const built = await buildViewer({ root: [root], out: path.join(base, 'build/viewer'), render: false });
    assert.equal(built.data.films.filter(f => f.kind === 'clearframe').length, 2);
  } finally { process.chdir(cwd); }
});

test('the runtime is isolated, keeps the shell behind approval (the free tier refuses a denied shell) and denies direct edits', () => {
  const p = agentPaths('/work');
  assert.equal(p.state, path.resolve(process.env.CLEARFRAME_STATE ?? '/work/.clearframe'));
  for (const k of ['XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME', 'OPENCODE_CONFIG_DIR']) assert.ok(p.env[k].startsWith(p.state));
  assert.equal(p.registration, path.join(p.env.XDG_STATE_HOME, 'opencode', 'service.json'), 'the CLI registers under XDG state, not the config folder');
  const c = runtimeConfig(p);
  assert.equal(c.model, 'opencode/big-pickle');
  const rule = a => PERMISSIONS.filter(r => r.action === a && r.resource === '*').at(-1)?.effect;
  assert.equal(rule('shell'), 'ask'); assert.equal(rule('edit'), 'deny'); assert.equal(rule('external_directory'), 'deny');
  assert.ok(!PERMISSIONS.some(r => r.action === '*'), 'no blanket deny: the free tier refuses it');
});

test('a slow start that is superseded by a stop cannot overwrite the newer state', async t => {
  process.env.CLEARFRAME_STATE = tmp(t);
  t.after(() => { delete process.env.CLEARFRAME_STATE; });
  let finish;
  const service = { discover: async () => null, stop: async () => {}, headers: () => ({}), ensure: () => new Promise(r => { finish = r; }) };
  const rt = createRuntime({ base: process.env.CLEARFRAME_STATE, service, client: () => ({ server: { info: async () => ({ version: '2.0.24', pid: 1 }) }, model: { list: async () => ({ data: [] }) } }) });
  const starting = rt.client().catch(e => e);
  await tick(); await tick();
  await rt.stop();
  finish({ url: 'http://127.0.0.1:1' });
  assert.match(String((await starting).message), /superseded/);
  assert.equal(rt.status().state, 'stopped');
});
