import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openJobStore, JobStoreError } from '../engine/lib/harness/job-store.mjs';

const storeUrl = new URL('../engine/lib/harness/job-store.mjs', import.meta.url).href;
const tmp = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-job-store-'));
  return { root, file: path.join(root, 'studio', '.harness', 'jobs.sqlite'), legacyFile: path.join(root, 'studio', 'jobs.json') };
};
const job = (id, extra = {}) => ({ id, dir: 'films/a', kind: 'render', status: 'queued', createdAt: `2026-10-20T00:00:${String(id).padStart(2, '0')}.000Z`, log: '', ...extra });
const deadPid = () => spawnSync(process.execPath, ['-e', '0']).pid;
const refuses = (fn, reason) => assert.throws(fn, e => e instanceof JobStoreError && e._tag === 'JobStoreError' && e.reason === reason);

// A studio that saves its jobs and dies without closing the ledger.
const crash = (file, jobs) => {
  const script = `import { openJobStore } from ${JSON.stringify(storeUrl)}; const s = openJobStore({ file: ${JSON.stringify(file)} }); s.saveAll(${JSON.stringify(jobs)}); process.exit(0);`;
  const r = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
};

test('persists jobs and transition events, and finds request keys beyond the list limit', () => {
  const { file } = tmp();
  const store = openJobStore({ file, keepJobs: 2 });
  assert.equal(fs.statSync(path.dirname(file)).mode & 0o777, 0o700);
  const jobs = [1, 2, 3, 4].map(n => job(String(n), { requestKey: `k${n}`, extraField: { n } }));
  store.saveAll(jobs);
  for (const j of jobs) j.status = 'complete';
  store.saveAll(jobs);
  store.saveAll(jobs); // nothing changed: no events
  store.saveAll([{ ...jobs[3], cancelled: true }]);
  store.saveAll([job('5', { status: 'running' })]);
  assert.deepEqual(store.list().map(j => j.id), ['3', '4', '5']);
  assert.deepEqual(store.list()[0].extraField, { n: 3 });
  assert.equal(store.findByKey('films/a', 'k1').id, '1');
  assert.equal(store.findByKey('films/b', 'k1'), null);
  const events = store.events();
  assert.deepEqual(events.map(e => e.type), [...Array(4).fill('created'), ...Array(4).fill('transition'), 'transition', 'created']);
  assert.deepEqual(events[4].data, { from: { status: 'queued', cancelled: false }, to: { status: 'complete', cancelled: false } });
  assert.deepEqual(store.events({ jobId: '4', after: events[3].seq }).map(e => e.data.to.cancelled), [false, true]);
  refuses(() => store.saveAll([job('6', { requestKey: 'k1' })]), 'duplicate-key');
  store.close();
  store.close();
  refuses(() => store.list(), 'closed');
  const again = openJobStore({ file, keepJobs: 10 });
  assert.deepEqual(again.list().map(j => j.id), ['1', '2', '3', '4', '5']);
  again.close();
});

test('a malformed job rolls back the whole save', () => {
  const { file } = tmp();
  const store = openJobStore({ file });
  store.saveAll([job('1')]);
  refuses(() => store.saveAll([{ ...job('1'), status: 'running' }, job('2'), { ...job('3'), kind: 7 }]), 'invalid-job');
  assert.deepEqual(store.list().map(j => [j.id, j.status]), [['1', 'queued']]);
  assert.equal(store.events().length, 1);
  store.saveAll([{ ...job('1'), status: 'running' }]);
  assert.equal(store.events().length, 2);
  store.close();
});

test('one owner at a time, including this process', () => {
  const { file } = tmp();
  const store = openJobStore({ file });
  refuses(() => openJobStore({ file }), 'owned');
  store.saveAll([job('1')]); // the refused open did not disturb the owner
  store.close();
  openJobStore({ file }).close();
});

test('a restart after a crash marks unfinished jobs interrupted and never replays them', () => {
  const { file } = tmp();
  crash(file, [job('1', { status: 'running', paid: true, childPid: deadPid() }), job('2'), job('3', { status: 'complete' })]);
  const store = openJobStore({ file });
  const [paid, queued, done] = store.list();
  assert.equal(paid.status, 'interrupted');
  assert.deepEqual([paid.recovery.from, paid.recovery.outcome], ['running', 'unknown']);
  assert.equal(queued.status, 'interrupted');
  assert.equal(queued.recovery.outcome, undefined);
  assert.equal(done.status, 'complete');
  assert.deepEqual(store.events({ jobId: '1' }).map(e => e.data.to?.status ?? e.data.status), ['running', 'interrupted']);
  store.close();
});

test('refuses to start while a stale owner\'s child is still alive, without touching it', async () => {
  const { file } = tmp();
  const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
  try {
    crash(file, [job('1', { status: 'running', childPid: child.pid })]);
    refuses(() => openJobStore({ file }), 'living-child');
    assert.doesNotThrow(() => process.kill(child.pid, 0));
    const db = new DatabaseSync(file);
    assert.equal(db.prepare("SELECT status FROM jobs WHERE id = '1'").get().status, 'running');
    db.close();
  } finally {
    process.kill(-child.pid, 'SIGKILL');
    await new Promise(r => child.once('exit', r));
  }
  const store = openJobStore({ file });
  assert.equal(store.list()[0].status, 'interrupted');
  store.close();
});

test('imports legacy jobs.json exactly once and refuses a corrupt one until it is fixed', () => {
  const { file, legacyFile } = tmp();
  fs.mkdirSync(path.dirname(legacyFile), { recursive: true });
  fs.writeFileSync(legacyFile, '[{"id":"1"');
  refuses(() => openJobStore({ file, legacyFile }), 'legacy');
  fs.writeFileSync(legacyFile, JSON.stringify([job('1', { status: 'complete' }), { id: '2', status: 'queued' }]));
  refuses(() => openJobStore({ file, legacyFile }), 'invalid-job');
  const legacy = JSON.stringify([job('1', { status: 'complete' }), job('2', { status: 'running' })]);
  fs.writeFileSync(legacyFile, legacy);
  let store = openJobStore({ file, legacyFile });
  assert.deepEqual(store.list().map(j => [j.id, j.status]), [['1', 'complete'], ['2', 'interrupted']]);
  assert.deepEqual(store.events().map(e => e.type), ['migrated', 'migrated']);
  store.close();
  assert.equal(fs.readFileSync(legacyFile, 'utf8'), legacy);
  store = openJobStore({ file, legacyFile });
  assert.equal(store.list().length, 2);
  assert.equal(store.events().length, 2);
  store.close();
});

test('refuses a ledger from a newer schema', () => {
  const { file } = tmp();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA user_version = 99');
  db.close();
  refuses(() => openJobStore({ file }), 'future-schema');
  const after = new DatabaseSync(file);
  assert.equal(after.prepare('PRAGMA user_version').get().user_version, 99);
  after.close();
});
