import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import * as Effect from 'effect/Effect';
import { createJobHarness, jobHarness } from '../engine/harness.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) {
  for (let i = 0; i < 400; i++) { const value = fn(); if (value) return value; await wait(25); }
  throw new Error('Timed out waiting for local fixture.');
}
function fixture(t, { delay = 0 } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-harness-')));
  const dir = path.join(base, 'film'), out = path.join(base, 'build/viewer');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ title: 'Test', beats: [{ id: 'a', block: 'title', duration: 1, props: { text: 'Test' } }] }));
  const cli = path.join(base, 'fixture.mjs');
  fs.writeFileSync(cli, `import fs from 'node:fs';
fs.appendFileSync(${JSON.stringify(path.join(base, 'calls'))}, process.argv[2] + '\\n');
await new Promise(r => setTimeout(r, ${delay}));
console.log('done');
`);
  const options = { base, out, cli, gate: null };
  const harnesses = [];
  const open = (overrides = {}) => { const h = createJobHarness({ ...options, ...overrides }); harnesses.push(h); return h; };
  t.after(async () => { for (const h of harnesses) await h.stopAll(); fs.rmSync(base, { recursive: true, force: true }); });
  return { base, dir, out, options, open, file: path.join(out, 'studio/.harness/jobs.sqlite') };
}
const terminal = (h, id) => until(() => h.list().find(j => j.id === id && !['queued', 'waiting', 'running'].includes(j.status)));

test('public harness persists non-preview request identity across restart and refuses mismatched reuse', async t => {
  const { open, dir, base } = fixture(t);
  const h = open(), body = { film: 'film', kind: 'captions', requestKey: 'turn:captions' };
  const first = h.start(dir, body);
  assert.equal(h.start(dir, body).id, first.id);
  assert.equal((await terminal(h, first.id)).status, 'complete');
  await h.stopAll();
  const reopened = open();
  assert.equal(reopened.start(dir, body).id, first.id);
  assert.throws(() => reopened.start(dir, { ...body, draft: false }), /different job request/);
  assert.equal(fs.readFileSync(path.join(base, 'calls'), 'utf8'), 'captions\n');
  const events = reopened.events({ jobId: first.id });
  assert.deepEqual(events.map(e => e.data.to?.status ?? e.data.status), ['queued', 'running', 'complete']);
  assert.deepEqual(reopened.events({ after: events.at(-1).seq }), []);
});

test('cancel is durable before signalling; queued work never runs and a second owner is refused', async t => {
  const { open, dir, base, options } = fixture(t, { delay: 10000 });
  const h = open();
  assert.throws(() => createJobHarness(options), /already owns/);
  const a = h.start(dir, { film: 'film', kind: 'captions', requestKey: 'a' });
  await until(() => fs.existsSync(path.join(base, 'calls')));
  const b = h.start(dir, { film: 'film', kind: 'captions', requestKey: 'b' });
  h.cancel(b.id); h.cancel(a.id);
  assert.equal(h.events({ jobId: a.id }).at(-1).data.to.cancelled, true);
  assert.equal((await terminal(h, a.id)).status, 'cancelled');
  assert.equal((await terminal(h, b.id)).status, 'cancelled');
  assert.equal(fs.readFileSync(path.join(base, 'calls'), 'utf8'), 'captions\n');
});

test('a failed admission transaction launches no child and surfaces a failed harness', async t => {
  const { open, dir, base, file } = fixture(t);
  const h = open(), db = new DatabaseSync(file);
  db.exec("CREATE TRIGGER refuse_job BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT, 'test disk refusal'); END;");
  assert.throws(() => h.start(dir, { film: 'film', kind: 'captions' }), /test disk refusal/);
  await wait(100);
  assert.equal(fs.existsSync(path.join(base, 'calls')), false);
  assert.equal(h.health().state, 'failed');
  assert.equal(db.prepare('SELECT count(*) AS n FROM jobs').get().n, 0);
  db.close();
});

test('file-descriptor exhaustion fails a job without signalling an invalid child or hanging shutdown', async t => {
  const { base, dir, options } = fixture(t);
  const probe = path.join(base, 'fd-probe.mjs');
  fs.writeFileSync(probe, `
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import { createJobHarness } from ${JSON.stringify(new URL('../engine/harness.mjs', import.meta.url).href)};
const options = ${JSON.stringify(options)};
const h = createJobHarness(options);
const fds = [];
try { while (true) fds.push(fs.openSync('/dev/null', 'r')); }
catch (e) { assert.equal(e.code, 'EMFILE'); }
for (let i = 0; i < 2; i++) fs.closeSync(fds.pop());
const { id } = h.start(${JSON.stringify(dir)}, { film: 'film', kind: 'captions' });
for (const fd of fds) fs.closeSync(fd);
await wait(100);
assert.equal(h.get(id).status, 'failed');
assert.match(h.get(id).errors.join(' '), /EMFILE/);
assert.equal(fs.existsSync(${JSON.stringify(path.join(base, 'calls'))}), false);
await h.stopAll();
const reopened = createJobHarness(options);
assert.equal(reopened.get(id).status, 'failed');
await reopened.stopAll();
console.log('failed job retained; shutdown complete');
`);
  // Restrict only this subprocess, and isolate its group even if a regression signals PID 0.
  const child = spawn('python3', ['-c', `
import os, resource, sys
soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
resource.setrlimit(resource.RLIMIT_NOFILE, (64, hard))
os.execv(sys.argv[1], sys.argv[1:])
`, process.execPath, probe], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', c => { output += c; }); child.stderr.on('data', c => { output += c; });
  const timer = setTimeout(() => child.kill('SIGKILL'), 8000);
  try {
    const [code, signal] = await once(child, 'close');
    assert.equal(signal, null, output);
    assert.equal(code, 0, output);
    assert.match(output, /failed job retained; shutdown complete/);
  } finally { clearTimeout(timer); }
});

test('a gate in another session cannot leave a TERM-resistant renderer behind', async t => {
  const { open, dir, base, options } = fixture(t);
  const gate = path.join(base, 'gate');
  fs.writeFileSync(gate, `#!/usr/bin/env python3
import os, signal, subprocess, sys
child = subprocess.Popen(sys.argv[2:], start_new_session=True)
def stop(sig, frame):
    try: os.killpg(child.pid, sig)
    except ProcessLookupError: pass
signal.signal(signal.SIGTERM, stop)
sys.exit(child.wait())
`, { mode: 0o755 });
  fs.writeFileSync(options.cli, `import fs from 'node:fs';
process.on('SIGTERM', () => {});
fs.writeFileSync(${JSON.stringify(path.join(base, 'renderer-pid'))}, String(process.pid));
setInterval(() => {}, 1000);`);
  const h = open({ gate });
  const { id } = h.start(dir, { film: 'film', kind: 'check', requestKey: 'gated' });
  await until(() => fs.existsSync(path.join(base, 'renderer-pid')));
  const pid = Number(fs.readFileSync(path.join(base, 'renderer-pid'), 'utf8'));
  const workerPid = h.list().find(j => j.id === id).workerPid;
  t.after(() => { try { process.kill(pid, 'SIGKILL'); } catch {} });
  assert.ok(workerPid > 0);
  h.cancel(id);
  assert.equal((await terminal(h, id)).status, 'cancelled');
  await until(() => { try { process.kill(pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } });
  assert.throws(() => process.kill(-workerPid, 0), e => e.code === 'ESRCH');
});

test('running work can still be stopped when recording cancellation fails', async t => {
  const { open, dir, base, file } = fixture(t, { delay: 10000 });
  const h = open(), { id } = h.start(dir, { film: 'film', kind: 'captions' });
  await until(() => fs.existsSync(path.join(base, 'calls')));
  const { workerPid } = h.get(id);
  const db = new DatabaseSync(file);
  db.exec("CREATE TRIGGER refuse_update BEFORE UPDATE ON jobs BEGIN SELECT RAISE(ABORT, 'test disk refusal'); END;");
  const result = h.cancel(id);
  assert.match(result.persistenceError, /test disk refusal/);
  assert.equal(h.health().state, 'failed');
  await until(() => { try { process.kill(-workerPid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } });
  db.exec('DROP TRIGGER refuse_update');
  db.close();
  await h.stopAll();
});

test('the same request still resolves after the storyboard changes, and evicted failures stay durable', async t => {
  const { open, dir, base, options } = fixture(t);
  const board = path.join(dir, 'storyboard.json');
  const h = open(), hash = crypto.createHash('sha256').update(fs.readFileSync(board)).digest('hex');
  const body = { film: 'film', kind: 'captions', hash, requestKey: 'before-edit' };
  const first = h.start(dir, body);
  await terminal(h, first.id);
  fs.writeFileSync(board, JSON.stringify({ beats: [{ id: 'changed', block: 'title', props: { text: 'Changed' } }] }));
  assert.equal(h.start(dir, body).id, first.id);
  await h.stopAll();
  fs.writeFileSync(options.cli, "console.error('intentional fixture failure'); process.exitCode = 1;");
  const failed = createJobHarness({ ...options, keepJobs: 0 });
  const request = { film: 'film', kind: 'captions', requestKey: 'failure' };
  const { id } = failed.start(dir, request);
  await until(() => failed.events({ jobId: id }).some(e => e.data.to?.status === 'failed'));
  assert.deepEqual(failed.list(), []);
  await failed.stopAll();
  const reopened = open();
  assert.equal(reopened.start(dir, request).id, id);
  assert.equal(reopened.list().find(j => j.id === id).status, 'failed');
  assert.equal(fs.readFileSync(path.join(base, 'calls'), 'utf8'), 'captions\n');
});

test('looking up an evicted request does not reorder or grow the recent-job view', async t => {
  const { open, dir } = fixture(t);
  const h = open({ keepJobs: 1 });
  const body = { film: 'film', kind: 'captions', requestKey: 'old' };
  const old = h.start(dir, body); await terminal(h, old.id);
  const current = h.start(dir, { ...body, requestKey: 'new' }); await terminal(h, current.id);
  assert.equal(h.start(dir, body).job.id, old.id);
  assert.equal(h.get(old.id).status, 'complete');
  assert.deepEqual(h.list().map(j => j.id), [current.id]);
});

test('Effect scope finalization releases the same public harness', async t => {
  const { options, dir } = fixture(t);
  await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const h = yield* jobHarness(options);
    const { id } = h.start(dir, { film: 'film', kind: 'captions' });
    const result = yield* Effect.promise(() => terminal(h, id));
    assert.equal(result.status, 'complete');
  })));
  const next = createJobHarness(options);
  await next.stopAll();
});

test('the public harness runs the real captions CLI and retains its completed result', async t => {
  const { open, dir } = fixture(t);
  const file = path.join(dir, 'storyboard.json'), board = JSON.parse(fs.readFileSync(file));
  board.beats[0].vo = 'Hello from the local harness.';
  fs.writeFileSync(file, JSON.stringify(board));
  const h = open({ cli: undefined });
  const { id } = h.start(dir, { film: 'film', kind: 'captions', requestKey: 'real-cli' });
  const result = await terminal(h, id);
  assert.equal(result.status, 'complete', result.log);
  assert.match(fs.readFileSync(path.join(dir, 'build/captions.srt'), 'utf8'), /Hello from the local harness/);
  assert.ok(fs.existsSync(path.join(dir, 'build/captions.vtt')));
  await h.stopAll();
  assert.equal(open().list().find(j => j.id === id).status, 'complete');
});

test('abrupt owner death stops its supervised CLI; restart records interruption without replay', async t => {
  const { base, dir, options, open } = fixture(t, { delay: 10000 });
  const module = new URL('../engine/harness.mjs', import.meta.url).href;
  const owner = spawn(process.execPath, ['--input-type=module', '-e', `
import { createJobHarness } from ${JSON.stringify(module)};
const h = createJobHarness(${JSON.stringify(options)});
const {id} = h.start(${JSON.stringify(dir)}, {film:'film',kind:'captions',requestKey:'crash'});
process.send({id, childPid:h.list()[0].childPid});
setInterval(() => {}, 1000);
`], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  let pid;
  t.after(() => { if (owner.exitCode == null) owner.kill('SIGKILL'); });
  const [{ id, childPid }] = await once(owner, 'message'); pid = childPid;
  await until(() => fs.existsSync(path.join(base, 'calls')));
  owner.kill('SIGKILL'); await once(owner, 'exit');
  await until(() => { try { process.kill(-pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } });
  const h = open();
  assert.equal(h.list().find(j => j.id === id).status, 'interrupted');
  assert.equal(h.start(dir, { film: 'film', kind: 'captions', requestKey: 'crash' }).id, id);
  assert.equal(fs.readFileSync(path.join(base, 'calls'), 'utf8'), 'captions\n');
});
