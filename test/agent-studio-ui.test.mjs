// The agent pane's outbox (40-agent.js), run in a VM with browser storage cloned through
// JSON as localStorage would: durable ids survive failures and reloads, transient state never does.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../engine/ui/viewer/js/40-agent.js', import.meta.url), 'utf8').split('// ------------------------------------------------------------------ the conversation on the page')[0];
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

// ------------------------------------------------------------------ home: uploads belong to their draft (20-home.js)

const home = fs.readFileSync(new URL('../engine/ui/viewer/js/20-home.js', import.meta.url), 'utf8');
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

// ------------------------------------------------------------------ the conversation on the page (40-agent.js)

function agentUI(S) {
  const c = vm.createContext({ S, store: { get: (k, f) => f, set() {} }, crypto: globalThis.crypto, Date, toast() {},
    esc: s => String(s), plural: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`, clock: s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`,
    markdown: s => `<p>${s}</p>`, when: () => '' });
  vm.runInContext(fs.readFileSync(new URL('../engine/ui/viewer/js/40-agent.js', import.meta.url), 'utf8'), c);
  return c;
}

test('before the first word, the conversation says it is waiting, timed from when the message was sent (a reload keeps the clock)', () => {
  const sent = Date.now() - 125000, conv = { running: true, messages: [{ role: 'user', id: 'msg_a', at: sent }] };
  for (let reload = 0; reload < 2; reload++) {
    const html = vm.runInContext('firstResponse', agentUI({ id: 'film' }))(conv);
    assert.match(html, /Waiting for the model’s first response/);
    assert.match(html, /2:0[5-6]/, 'elapsed since the send, not since the page opened');
    assert.match(html, /Stop, then Send now/, 'past 90 s it says how to recover');
  }
  assert.equal(vm.runInContext('firstResponse', agentUI({ id: 'film' }))({ running: false, messages: conv.messages }), '');
});

test('a request reads as one block: every step folded into one line, then what the agent said', () => {
  const tool = (title, extra = {}) => ({ type: 'tool', title, status: 'completed', ...extra });
  const msgs = [{ role: 'assistant', parts: [tool('Read the film'), { type: 'text', text: 'Looking at scene 2.' }] }, { role: 'assistant', parts: [tool('Changed the kicker', { own: true, tool: 'edit' })] },
    { role: 'assistant', parts: [tool('Answered note n003', { own: true, tool: 'notes' }), { type: 'text', text: 'Done: the kicker reads INFLATION, PAST YEAR.' }] }];
  const html = vm.runInContext('runHTML', agentUI({ id: 'film' }))(msgs, { running: false, messages: msgs }, false);
  assert.equal((html.match(/<details class="steps">/g) ?? []).length, 1, 'one line of steps for the whole request');
  assert.match(html, /3 steps · 1 change to the film/);
  assert.match(html, /Looking at scene 2\.[\s\S]*Done: the kicker reads/, 'the replies follow, in order');
  const live = vm.runInContext('runHTML', agentUI({ id: 'film' }))([{ role: 'assistant', parts: [tool('Read the film'), { type: 'tool', title: 'Queued draft', status: 'running' }] }], { running: true }, true);
  assert.match(live, /spin[\s\S]*Queued draft/, 'while it works, the line says what it is doing now');
});
