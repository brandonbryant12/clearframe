// Preview cache and input provenance for studio jobs, with a stand-in CLI (no render, no gate).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createStudioJobs, inputPrint } from '../engine/lib/viewer/studio-jobs.mjs';

const BOARD = { version: 2, title: 'Same', music: false, beats: [{ id: 'a', block: 'title', duration: 3, props: { text: 'Hello' } }, { id: 'b', block: 'statement', duration: 3, props: { text: 'World' } }] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function setup(t, { keepJobs } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-jobs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  // The stand-in CLI waits FAKE_DELAY ms, then writes its output (and a section's receipt).
  const cli = path.join(root, 'fake-cli.mjs');
  fs.writeFileSync(cli, `import fs from 'node:fs';
const a = process.argv.slice(2), out = a[a.indexOf('--out') + 1];
await new Promise(r => setTimeout(r, Number(process.env.FAKE_DELAY ?? 0)));
fs.writeFileSync(out, a.join(' '));
if (a[0] === 'preview') fs.writeFileSync(out + '.json', JSON.stringify({ range: { seconds: [0, 1] }, verified: [{}], audio: null }));
`);
  const film = name => { const d = path.join(root, name); fs.mkdirSync(path.join(d, 'assets', 'img'), { recursive: true }); fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify(BOARD)); return d; };
  const jobs = createStudioJobs({ base: root, out: path.join(root, 'viewer'), cli, gate: null, ...(keepJobs ? { keepJobs } : {}) });
  t.after(() => jobs.stopAll());
  const get = id => jobs.list().find(j => j.id === id);
  const done = async id => { for (let i = 0; i < 400; i++) { const j = get(id); if (j && !['queued', 'waiting', 'running'].includes(j.status)) return j; await sleep(25); } throw new Error(`job ${id} did not finish`); };
  return { root, film, jobs, get, done };
}

test('identical storyboards in two films never share a preview or a queued job', async t => {
  const { film, jobs, done, get } = setup(t);
  const A = film('a'), B = film('b');
  process.env.FAKE_DELAY = '150';
  const a1 = jobs.start(A, { film: 'A', kind: 'still', beat: 'a' });
  const b1 = jobs.start(B, { film: 'B', kind: 'still', beat: 'a' });
  assert.notEqual(b1.id, a1.id, 'a queued twin in another film is not followed');
  const b2 = jobs.start(B, { film: 'B', kind: 'still', beat: 'a' });
  assert.equal(b2.id, b1.id, 'the same request in the same film follows the queued job');
  await done(a1.id); await done(b1.id);
  const again = jobs.start(B, { film: 'B', kind: 'still', beat: 'a' });
  assert.equal(again.id, b1.id); assert.equal(again.cached, true);
  assert.equal(get(again.id).film, 'B');
  for (const kind of ['still', 'section']) {
    const body = kind === 'still' ? { kind, beat: 'b' } : { kind, beats: ['a', 'b'] };
    const x = jobs.start(A, { film: 'A', ...body }); await done(x.id);
    const y = jobs.start(B, { film: 'B', ...body });
    assert.notEqual(y.id, x.id); assert.ok(!y.cached);
    assert.ok(jobs.list('B').some(j => j.id === y.id), 'the answer is a job of this film');
    await done(y.id);
  }
  delete process.env.FAKE_DELAY;
});

test('changing media or narration with the storyboard unchanged makes the old preview stale', async t => {
  const { film, jobs, done } = setup(t);
  const A = film('a');
  const first = jobs.start(A, { film: 'A', kind: 'still', beat: 'a' });
  assert.equal((await done(first.id)).cached, true);
  assert.equal(jobs.start(A, { film: 'A', kind: 'still', beat: 'a' }).id, first.id, 'unchanged inputs reuse the preview');
  fs.writeFileSync(path.join(A, 'assets', 'img', 'plate.png'), 'new picture');
  assert.equal(jobs.list('A').find(j => j.id === first.id).matches, false, 'the UI sees a stale still without requesting another render');
  const second = jobs.start(A, { film: 'A', kind: 'still', beat: 'a' });
  assert.notEqual(second.id, first.id); await done(second.id);
  fs.mkdirSync(path.join(A, 'assets', 'vo'), { recursive: true });
  fs.writeFileSync(path.join(A, 'assets', 'vo', 'a.json'), JSON.stringify({ provider: 'local' }));
  const third = jobs.start(A, { film: 'A', kind: 'still', beat: 'a' });
  assert.notEqual(third.id, second.id); await done(third.id);
  // What a render writes (build/, review/) is not an input.
  const print = inputPrint(A);
  fs.mkdirSync(path.join(A, 'build'), { recursive: true }); fs.writeFileSync(path.join(A, 'build', 'timing.json'), '{}');
  fs.mkdirSync(path.join(A, 'review'), { recursive: true }); fs.writeFileSync(path.join(A, 'review', 'runlog.jsonl'), '{}\n');
  assert.equal(inputPrint(A), print);
  assert.equal(jobs.start(A, { film: 'A', kind: 'still', beat: 'a' }).id, third.id);
});

test('a job that waited in the queue renders and is labelled with the inputs at its start', async t => {
  const { film, jobs, done } = setup(t);
  const A = film('a'), board = path.join(A, 'storyboard.json'), requested = sha(board);
  process.env.FAKE_DELAY = '250';
  const ahead = jobs.start(A, { film: 'A', kind: 'still', beat: 'a', pos: 0.2 });
  const queued = jobs.start(A, { film: 'A', kind: 'still', beat: 'b', hash: requested });
  // An edit lands while the second job is still queued.
  fs.writeFileSync(board, JSON.stringify({ ...BOARD, title: 'Edited' }));
  const edited = sha(board);
  await done(ahead.id);
  const j = await done(queued.id);
  delete process.env.FAKE_DELAY;
  assert.equal(j.status, 'complete');
  assert.equal(j.hash, edited, 'labelled with what it rendered'); assert.equal(j.requestedHash, requested); assert.equal(j.repinned, true);
  assert.equal(j.matches, true); assert.equal(j.cached, true);
  // The job ahead was running when the edit landed: its result is not known to show either version.
  const a = await done(ahead.id);
  assert.equal(a.matches, false); assert.equal(a.cached, false);
  assert.equal(jobs.start(A, { film: 'A', kind: 'still', beat: 'b', hash: edited }).id, queued.id);
});

test('an edit and its undo while a preview renders leave it uncached and not current', async t => {
  const { film, jobs, done } = setup(t);
  const A = film('a'), board = path.join(A, 'storyboard.json'), original = fs.readFileSync(board, 'utf8');
  process.env.FAKE_DELAY = '400';
  const run = jobs.start(A, { film: 'A', kind: 'section', beats: ['a'] });
  await sleep(120); fs.writeFileSync(board, JSON.stringify({ ...BOARD, title: 'Edited' }));
  await sleep(120); fs.writeFileSync(board, original);
  const j = await done(run.id);
  delete process.env.FAKE_DELAY;
  assert.equal(sha(board), j.hash, 'the content is back where it started');
  assert.equal(j.matches, false); assert.equal(j.cached, false);
  const next = jobs.start(A, { film: 'A', kind: 'section', beats: ['a'] });
  assert.notEqual(next.id, run.id); assert.ok(!next.cached);
  assert.equal((await done(next.id)).cached, true);
});

test('a cached preview whose job was evicted is not returned; a new job is listed instead', async t => {
  const { film, jobs, done, get } = setup(t, { keepJobs: 2 });
  const A = film('a');
  const first = jobs.start(A, { film: 'A', kind: 'still', beat: 'a', pos: 0.1 });
  await done(first.id);
  for (const pos of [0.3, 0.5]) await done(jobs.start(A, { film: 'A', kind: 'still', beat: 'a', pos }).id);
  assert.equal(get(first.id), undefined, 'the oldest job was evicted');
  const again = jobs.start(A, { film: 'A', kind: 'still', beat: 'a', pos: 0.1 });
  assert.notEqual(again.id, first.id); assert.ok(!again.cached);
  assert.ok(get(again.id), 'the answer is a job the list shows');
  await done(again.id);
});

test('a final knows its revision from its receipt and reports the video as it came out', async t => {
  const { spawnSync } = await import('node:child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-jobs-final-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const d = path.join(root, 'film'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify(BOARD));
  const video = path.join(d, 'review/objects/ab', `${'ab'.repeat(32)}.mp4`); fs.mkdirSync(path.dirname(video), { recursive: true });
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=navy:s=64x36:d=1', '-pix_fmt', 'yuv420p', video]).status, 0);
  fs.mkdirSync(path.join(d, 'review/revisions/r002'), { recursive: true });
  fs.writeFileSync(path.join(d, 'review/revisions/r002/revision.json'), JSON.stringify({ id: 'r002', duration: 0.97, videos: [{ profile: 'final', object: path.relative(d, video) }] }));
  // The real final prints its receipt as JSON, with "revision": "r002", not "revision r002".
  const cli = path.join(root, 'final-cli.mjs');
  fs.writeFileSync(cli, `import fs from 'node:fs'; fs.mkdirSync(${JSON.stringify(path.join(d, 'build'))}, { recursive: true }); fs.writeFileSync(${JSON.stringify(path.join(d, 'build/video.mp4'))}, 'x'); console.log(JSON.stringify({ profile: 'final', revision: 'r002' }, null, 2));`);
  const jobs = createStudioJobs({ base: root, out: path.join(root, 'viewer'), cli, gate: null });
  t.after(() => jobs.stopAll());
  const { id } = jobs.start(d, { film: 'film', kind: 'final' });
  let j; for (let i = 0; i < 400 && !['complete', 'failed'].includes((j = jobs.list().find(x => x.id === id))?.status); i++) await sleep(25);
  assert.equal(j.status, 'complete', j.log);
  assert.equal(j.revision, 'r002');
  assert.deepEqual([j.media?.width, j.media?.height, j.media?.authored], [64, 36, 0.97]);
});
