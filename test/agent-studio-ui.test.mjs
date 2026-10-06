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
