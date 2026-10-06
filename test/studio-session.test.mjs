import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../engine/ui/viewer/js/60-studio.js', import.meta.url), 'utf8');
function harness() {
  const requests = [], accepted = [];
  const context = vm.createContext({ document: { hidden: false, getElementById: () => null }, data: { films: [] }, encodeURIComponent, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  Object.assign(context, { requests, accepted });
  vm.runInContext(`
    call = (url, body) => new Promise(resolve => requests.push({ url, body, resolve }));
    invalidate = () => {}; autoStill = () => {};
    acceptState = r => { accepted.push(r); S.st = r; };
    globalThis.activate = id => S = { id, queue: Promise.resolve(), saving: 0, disposed: false, st: { hash: id }, jobs: [], f: { versions: [] }, monitor: {}, fieldErrors: {}, drafts: {} };
    globalThis.run = cmd; globalThis.job = startJob;
    globalThis.reads = [reloadState, refreshFilm, refreshNotes, loadReview, refreshJobs, watchSource];
  `, context);
  return { context, requests, accepted };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('switching films abandons queued commands and ignores a save already in flight', async () => {
  const { context: c, requests, accepted } = harness();
  const old = c.activate('old');
  const first = c.run({ command: 'set', beat: 'shared' });
  const second = c.run({ command: 'delete', beat: 'shared' });
  const rejected = Promise.all([assert.rejects(first, { name: 'AbortError' }), assert.rejects(second, { name: 'AbortError' })]);
  await tick(); assert.equal(requests.length, 1); assert.equal(requests[0].body.film, 'old');
  const next = c.activate('new'); requests[0].resolve({ hash: 'old-edited' });
  await rejected;
  assert.equal(requests.length, 1); assert.equal(accepted.length, 0);
  assert.equal(old.saving, 0); assert.equal(next.saving, 0); assert.equal(next.st.hash, 'new');
});

test('late state, film, note, review and job replies do not overwrite the next workspace', async () => {
  const { context: c, requests, accepted } = harness();
  c.activate('old'); const reads = c.reads.map(read => read());
  const next = c.activate('new');
  for (const r of requests) r.resolve({ hash: 'old', versions: [], notes: [], jobs: [] });
  await Promise.all(reads);
  assert.equal(accepted.length, 0); assert.equal(next.st.hash, 'new');
  assert.equal(next.review, undefined); assert.equal(next.jobSig, undefined);
});

test('a preview waiting for a save never starts against the next film', async () => {
  const { context: c, requests } = harness();
  const old = c.activate('old'); let finish; old.queue = new Promise(resolve => { finish = resolve; });
  const job = c.job('still', { beat: 'shared' });
  const rejected = assert.rejects(job, { name: 'AbortError' });
  c.activate('new'); finish(); await rejected;
  assert.equal(requests.length, 0);
});

test('a late preview response cannot run its selection callback in another film', async () => {
  const { context: c, requests } = harness();
  c.activate('old'); let callback = false;
  const job = c.job('section').then(() => { callback = true; });
  const rejected = assert.rejects(job, { name: 'AbortError' });
  await tick(); c.activate('new'); requests[0].resolve({ id: 'old-preview' });
  await rejected; assert.equal(callback, false); assert.equal(requests.length, 1);
});
