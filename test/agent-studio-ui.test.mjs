// The Agent column's outbox (66-studio-agent.js), run in a VM with browser storage cloned through
// JSON as localStorage would: durable ids survive failures and reloads, transient state never does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../engine/ui/viewer/js/66-studio-agent.js', import.meta.url), 'utf8').split('// ------------------------------------------------------------------ scope')[0];
const ID = 'msg_cfabcdefghijklmnopqrstuvwx', ID2 = 'msg_cfzyxwvutsrqponmlkjihgfedc';
const entry = (id, text) => ({ id, submission: id, text, scope: { kind: 'film' }, delivery: 'queue' });

function page(saved, send) {
  const c = vm.createContext({
    S: { id: 'film' }, document: { hidden: false, getElementById: () => null }, Date, crypto: globalThis.crypto,
    store: { get: (k, f) => (saved.has(k) ? JSON.parse(saved.get(k)) : f), set: (k, v) => saved.set(k, JSON.stringify(v)) },
    call: (url, body) => send(body), currentSession: x => x === c.S, invalidate: () => {}, status: () => {},
  });
  vm.runInContext(`${source}\nrefreshAgent = () => {};`, c);
  vm.runInContext('agentInit(S)', c);
  return c;
}

test('a send that fails is stored without transient state and retried with the same id after a reload', async () => {
  const saved = new Map([['cf-agent-outbox:film', JSON.stringify([entry(ID, 'Saved draft')])]]);
  const seen = [];
  let online = false;
  const send = async body => { seen.push(body.submission); if (!online) throw new Error('fetch failed'); return { state: 'sent' }; };
  const first = page(saved, send);
  await vm.runInContext('flushOutbox()', first);
  const stored = JSON.parse(saved.get('cf-agent-outbox:film'));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].failed, 'fetch failed');
  assert.ok(!('inflight' in stored[0]) && !('sending' in stored[0]), 'no in-flight flag is ever stored');
  online = true;
  const reloaded = page(saved, send);
  await vm.runInContext('flushOutbox()', reloaded);
  assert.deepEqual(seen, [ID, ID], 'the reload retried the same submission');
  assert.deepEqual(JSON.parse(saved.get('cf-agent-outbox:film')), []);
});

test('a stored outbox from an older page (with a stuck in-flight flag) is still sent', async () => {
  const saved = new Map([['cf-agent-outbox:film', JSON.stringify([{ ...entry(ID, 'Old'), inflight: true, failed: 'fetch failed' }])]]);
  const seen = [];
  const c = page(saved, async body => { seen.push(body.submission); return {}; });
  await vm.runInContext('flushOutbox()', c);
  assert.deepEqual(seen, [ID]);
});

test('a second message sent while the first is in flight: each goes once, and only durable fields are stored', async () => {
  const saved = new Map();
  const seen = [], pending = [];
  const c = page(saved, body => { seen.push(body.submission); return new Promise(r => pending.push(r)); });
  vm.runInContext(`S.agent.outbox.push(${JSON.stringify(entry(ID, 'One'))}); saveOutbox(S);`, c);
  const one = vm.runInContext('flushOutbox()', c);
  vm.runInContext(`S.agent.outbox.push(${JSON.stringify(entry(ID2, 'Two'))}); saveOutbox(S);`, c);
  const two = vm.runInContext('flushOutbox()', c);
  await new Promise(r => setImmediate(r));
  assert.deepEqual(seen, [ID, ID2], 'the second flush skips the one already in flight and sends the new one');
  for (const s of JSON.parse(saved.get('cf-agent-outbox:film'))) assert.deepEqual(Object.keys(s).sort(), ['delivery', 'id', 'scope', 'submission', 'text']);
  pending.forEach(r => r({}));
  await Promise.all([one, two]);
  assert.deepEqual(JSON.parse(saved.get('cf-agent-outbox:film')), []);
});

// ------------------------------------------------------------------ home: uploads belong to their draft (32-home.js)

const home = fs.readFileSync(new URL('../engine/ui/viewer/js/32-home.js', import.meta.url), 'utf8');
function homePage(saved, { upload, create = async () => ({ id: 'projects-x', film: { title: 'X', files: [] } }) } = {}) {
  const calls = [];
  const el = () => ({ value: '', textContent: '', disabled: false, dataset: {}, focus() {}, insertAdjacentHTML() {}, querySelectorAll: () => [], querySelector: () => null });
  const nodes = {};
  const c = vm.createContext({
    data: { films: [] }, location: { hash: '' }, crypto: globalThis.crypto, Promise, Map, Set, Date, encodeURIComponent, JSON, structuredClone,
    store: { get: (k, f) => (saved.has(k) ? JSON.parse(saved.get(k)) : f), set: (k, v) => saved.set(k, JSON.stringify(v)) },
    document: { getElementById: id => (nodes[id] ??= el()), querySelector: () => null },
    esc: s => String(s), plural: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`, newSubmission: () => 'msg_cfaaaaaaaaaaaaaaaaaaaaaaaa',
    fetch: async (url) => { calls.push(url); if (url.startsWith('/api/upload')) return upload(url); return { ok: true, json: async () => ({ films: [] }) }; },
    call: async (url, body) => { calls.push(url); if (url === '/api/projects') return create(body); return {}; },
  });
  vm.runInContext(home, c);
  return { c, calls, nodes };
}

test('a home upload is recorded only in the draft it started in, and Create waits for it', async () => {
  const saved = new Map([['cf-new-film', JSON.stringify({ request: 'req-aaaaaaaa', idea: 'An idea' })]]);
  let finish;
  const upload = () => new Promise(r => { finish = () => r({ ok: true, json: async () => ({ file: 'notes.md' }) }); });
  const created = [];
  const { c } = homePage(saved, { upload, create: async body => { created.push(body.documents); return { id: 'projects-x', film: { title: 'X', files: [] } }; } });
  const up = vm.runInContext(`addSources([{ name: 'notes.md' }])`, c);
  assert.equal(vm.runInContext(`pendingUploads('req-aaaaaaaa')`, c), 1);
  const make = vm.runInContext('createFilm(true)', c);
  await new Promise(r => setImmediate(r));
  assert.deepEqual(created, [], 'Create waits while its draft is uploading');
  finish(); await up; await make;
  assert.deepEqual(created, [['notes.md']], 'and then includes the source');
  assert.equal(saved.get('cf-new-film'), 'null', 'the finished draft is cleared');
});

test('an upload that finishes after its draft was replaced never writes into the new draft', async () => {
  const saved = new Map([['cf-new-film', JSON.stringify({ request: 'req-aaaaaaaa', idea: 'First' })]]);
  let finish;
  const { c } = homePage(saved, { upload: () => new Promise(r => { finish = () => r({ ok: true, json: async () => ({ file: 'late.md' }) }); }) });
  const up = vm.runInContext(`addSources([{ name: 'late.md' }])`, c);
  saved.set('cf-new-film', JSON.stringify({ request: 'req-bbbbbbbb', idea: 'Second', documents: [] }));
  finish(); await up;
  assert.deepEqual(JSON.parse(saved.get('cf-new-film')).documents, []);
  assert.equal(JSON.parse(saved.get('cf-new-film')).request, 'req-bbbbbbbb');
});

// ------------------------------------------------------------------ Sound tab: one request per working copy (67-studio-sound.js)

function soundPage(respond) {
  const calls = [];
  const c = vm.createContext({ RIGHT_TABS: [], ACTIONS: {}, S: { id: 'film', st: { hash: 'A' } }, Promise, crypto: globalThis.crypto,
    esc: s => String(s), currentSession: x => x === c.S, invalidate: () => { c.renders = (c.renders ?? 0) + 1; },
    call: url => { calls.push(c.S.st.hash); return respond(calls.length); } });
  vm.runInContext(fs.readFileSync(new URL('../engine/ui/viewer/js/67-studio-sound.js', import.meta.url), 'utf8'), c);
  return { c, calls };
}
const flush = () => new Promise(r => setImmediate(r));

test('a failing sound read is held for that working copy: rendering again does not refetch; retry or an edit does', async () => {
  const { c, calls } = soundPage(() => Promise.reject(Object.assign(new Error('plan failed'), { status: 500 })));
  for (let i = 0; i < 5; i++) { vm.runInContext('soundPanel()', c); await flush(); }
  assert.equal(calls.length, 1, 'one request, however often the panel renders');
  assert.match(vm.runInContext('soundPanel()', c), /Could not read the film’s sound: plan failed[\s\S]*Try again/);
  vm.runInContext('loadSound({ retry: true })', c); await flush();
  assert.equal(calls.length, 2);
  c.S.st.hash = 'B'; vm.runInContext('soundPanel()', c); await flush();
  assert.equal(calls.length, 3, 'a new working copy is read once');
});

test('a sound reply is labelled with the working copy it was asked for, not the one current when it lands', async () => {
  let answer;
  const { c, calls } = soundPage(() => new Promise(r => { answer = r; }));
  vm.runInContext('soundPanel()', c);
  vm.runInContext('soundPanel()', c);
  assert.equal(calls.length, 1, 'one request in flight at a time');
  c.S.st.hash = 'B';
  answer({ narration: {}, music: {} }); await flush(); await flush();
  assert.equal(c.S.soundHash, 'A');
  assert.match(vm.runInContext("S.sound = null; soundPanel()", c), /Reading/, 'the stale reply is not shown as current; the panel reads again');
  await flush();
  assert.deepEqual(calls, ['A', 'B'], 'the newer working copy is then read');
});
