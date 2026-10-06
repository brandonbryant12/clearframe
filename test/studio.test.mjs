import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { studioState, studioCommand, studioSchema } from '../engine/lib/viewer/studio.mjs';
import { createStudioJobs } from '../engine/lib/viewer/studio-jobs.mjs';
import { serveViewer } from '../engine/lib/viewer/server.mjs';
import { recordedProject } from './fixtures.mjs';

const fixture = (t, sb) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-studio-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb ?? { version: 2, title: 'Film', music: false, beats: [{ id: 'a', block: 'title', duration: 3, props: { text: 'First' } }, { id: 'b', block: 'statement', duration: 4, props: { text: 'Second' } }] }));
  return dir;
};
const run = (d, body) => studioCommand(d, { hash: studioState(d).hash, ...body });

test('studio edits survive reload, undo and redo; stale clients cannot overwrite newer edits', t => {
  const d = fixture(t), a = studioState(d);
  const b = studioCommand(d, { hash: a.hash, command: 'beat.set', beat: 'a', field: 'props.text', value: 'Changed' });
  assert.equal(studioState(d).storyboard.beats[0].props.text, 'Changed'); assert.ok(b.canUndo);
  assert.throws(() => studioCommand(d, { hash: a.hash, command: 'beat.set', beat: 'a', field: 'props.text', value: 'Stale' }), /changed elsewhere/);
  const c = studioCommand(d, { hash: b.hash, command: 'undo' }); assert.equal(c.storyboard.beats[0].props.text, 'First'); assert.ok(c.canRedo);
  const e = studioCommand(d, { hash: c.hash, command: 'redo' }); assert.equal(e.storyboard.beats[0].props.text, 'Changed');
});

test('new edit after undo drops redo; reorder preserves scene identity', t => {
  const d = fixture(t);
  let s = run(d, { command: 'beat.move', beat: 'b', direction: -1 });
  assert.deepEqual(s.storyboard.beats.map(x => x.id), ['b', 'a']);
  s = run(d, { command: 'undo' });
  s = run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'Opening' });
  assert.equal(s.canRedo, false);
  s = run(d, { command: 'move', beat: 'a', to: 1 });
  assert.deepEqual(s.storyboard.beats.map(x => x.id), ['b', 'a']);
});

test('external file changes cannot be undone through stale studio history; reformatting alone is not a change', t => {
  const d = fixture(t);
  let s = run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'Old' });
  // The same content written differently (indentation, key order) keeps the history.
  const same = s.storyboard; fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify({ beats: same.beats, ...same }));
  assert.equal(studioState(d).externalChanges, false);
  const sb = studioState(d).storyboard; sb.title = 'External';
  fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify(sb));
  s = studioState(d); assert.equal(s.externalChanges, true); assert.equal(s.canUndo, false);
  assert.throws(() => run(d, { command: 'undo' }), /outside the studio/);
  s = run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'New' });
  s = run(d, { command: 'undo' }); assert.equal(s.storyboard.title, 'External');
});

test('studio rejects invalid durations, unsafe paths and props a block does not have, without touching source', t => {
  const d = fixture(t), s = studioState(d);
  for (const [path, value] of [['duration', -5], ['__proto__.x', 'unsafe'], ['props.text', {}], ['props.nonsense', 'x'], ['id', 'renamed'], ['constructor.prototype', 1]])
    assert.throws(() => studioCommand(d, { hash: s.hash, command: 'set', target: 'beat', beat: 'a', path, value }), Error, path);
  assert.throws(() => studioCommand(d, { hash: s.hash, command: 'set', target: 'film', path: 'beats', value: [] }), /does not edit/);
  assert.equal(studioState(d).hash, s.hash);
});

test('the engine refuses an edit that would break the film, names why, and saves nothing; existing problems do not block other edits', t => {
  const d = fixture(t, { version: 2, title: 'Film', music: false, beats: [
    { id: 'a', block: 'title', duration: 3, props: { text: 'This film is drawn in code.', emphasis: ['drawn'] } },
    { id: 'b', block: 'statement', duration: 4, props: { text: 'Second' } }] });
  const s = studioState(d);
  assert.deepEqual(s.errors, []);
  assert.ok(s.timing.beats.every(b => b.dur > 0), 'engine timing is reported');
  const e = (() => { try { run(d, { command: 'set', target: 'beat', beat: 'a', path: 'props.text', value: 'This film is made in code.' }); } catch (x) { return x; } })();
  assert.match(e.message, /emphasis "drawn" must be whole words/);
  assert.equal(studioState(d).hash, s.hash);
  // A problem already in the file (written by hand) does not stop an unrelated edit.
  const sb = JSON.parse(fs.readFileSync(path.join(d, 'storyboard.json'), 'utf8')); sb.beats[1].props.text = 'x'.repeat(300);
  fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify(sb));
  assert.ok(studioState(d).errors.length);
  const ok = run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'Opening' });
  assert.equal(ok.storyboard.beats[0].label, 'Opening');
});

test('batches, inserts, duplicates, deletes and treatments are single undoable steps', t => {
  const d = fixture(t), before = studioState(d).storyboard;
  let s = run(d, { command: 'batch', label: 'Two changes', ops: [{ command: 'set', target: 'beat', beat: 'a', path: 'props.text', value: 'One' }, { command: 'set', target: 'film', path: 'motion.preset', value: 'snappy' }] });
  assert.equal(s.undoLabel, 'Two changes');
  s = run(d, { command: 'undo' }); assert.deepEqual(s.storyboard, before);
  s = run(d, { command: 'insert', block: 'bars', after: 'a' });
  assert.deepEqual(s.created, ['bars']); assert.deepEqual(s.storyboard.beats.map(b => b.id), ['a', 'bars', 'b']);
  assert.ok(s.storyboard.sources.some(x => /sample/i.test(x.title)), 'sample content is labelled and cited');
  s = run(d, { command: 'duplicate', beat: 'bars' }); assert.deepEqual(s.created, ['bars-copy']);
  s = run(d, { command: 'delete', beat: 'a' }); assert.deepEqual(s.storyboard.beats.map(b => b.id), ['bars', 'bars-copy', 'b']);
  s = run(d, { command: 'treatment', id: 'editorial' }); assert.equal(s.storyboard.treatment, 'editorial');
  for (let i = 0; i < 4; i++) s = run(d, { command: 'undo' });
  assert.deepEqual(s.storyboard.beats.map(b => b.id), ['a', 'b']);
  assert.ok(studioSchema().blocks.length > 30 && studioSchema().palettes.length > 10);
});

test('a write interrupted between the history and the storyboard leaves no phantom undo step', t => {
  const d = fixture(t);
  run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'Kept' });
  const file = path.join(d, 'review', 'studio-history.json'), h = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Simulate a crash: the history recorded a step whose storyboard write never landed.
  const raw = fs.readFileSync(path.join(d, 'storyboard.json'), 'utf8'), lost = JSON.parse(raw); lost.title = 'Lost';
  h.entries.push({ before: raw, after: JSON.stringify(lost), label: 'Lost edit', at: new Date().toISOString() }); h.cursor++;
  fs.writeFileSync(file, JSON.stringify(h));
  const s = studioState(d);
  assert.equal(s.externalChanges, false); assert.equal(s.undoLabel, 'Change label in First');
});

test('commands fail fast while another process holds the review lock', t => {
  const d = fixture(t), s = studioState(d);
  fs.mkdirSync(path.join(d, 'review'), { recursive: true });
  fs.writeFileSync(path.join(d, 'review', '.lock'), String(process.ppid));
  const t0 = Date.now();
  assert.throws(() => studioCommand(d, { hash: s.hash, command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'x' }), /Another ClearFrame command/);
  assert.ok(Date.now() - t0 < 2000);
  fs.rmSync(path.join(d, 'review', '.lock'));
});

test('recorded narration is edited only by source cuts: exact undo, redo by word identity, no hand edits or deletes', async t => {
  const { root } = await recordedProject(t);
  const wav = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/vo', f))).digest('hex');
  let s = studioState(root);
  const first = s.storyboard.beats[0], words = s.timing.beats[0].vo.words;
  assert.equal(s.narration[first.id].kind, 'recording');
  const before = { audio: wav(`${first.id}.wav`), vo: first.vo };
  assert.throws(() => run(root, { command: 'set', target: 'beat', beat: first.id, path: 'vo', value: 'New words' }), /is the recording itself/);
  assert.throws(() => run(root, { command: 'delete', beat: first.id }), /cut its words/);
  assert.throws(() => run(root, { command: 'recording.cut', beat: first.id, from: { k: 2 }, to: { k: 3 } }), /enter your name/);
  const plan = run(root, { command: 'recording.cut', beat: first.id, from: { k: 2 }, to: { k: 3 }, by: 'Ana', dryRun: true });
  assert.equal(plan.plan.words, `${words[2].w} ${words[3].w}`);
  s = run(root, { command: 'recording.cut', beat: first.id, from: { k: 2 }, to: { k: 3 }, by: 'Ana' });
  assert.ok(!s.storyboard.beats[0].vo.includes(words[2].w)); assert.match(s.undoLabel, /^Cut/);
  assert.notEqual(wav(`${first.id}.wav`), before.audio);
  s = run(root, { command: 'undo' });
  assert.equal(s.storyboard.beats[0].vo, before.vo); assert.equal(wav(`${first.id}.wav`), before.audio);
  s = run(root, { command: 'redo' });
  assert.ok(!s.storyboard.beats[0].vo.includes(words[2].w));
  // A per-beat imported take (provider imported, no source span) is not editable as text either.
  const meta = path.join(root, 'assets/vo', `${s.storyboard.beats[1].id}.json`), m = JSON.parse(fs.readFileSync(meta, 'utf8'));
  delete m.source; fs.writeFileSync(meta, JSON.stringify(m));
  assert.throws(() => run(root, { command: 'set', target: 'beat', beat: s.storyboard.beats[1].id, path: 'vo', value: 'x' }), /re-import/);
});

test('jobs run one at a time, can be cancelled while queued or running, and mark results made while the source changed', async t => {
  const d = fixture(t), out = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-jobs-'));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const jobs = createStudioJobs({ base: process.cwd(), out });
  t.after(() => jobs.stopAll());
  const wait = async (id, ms = 30000) => { const t0 = Date.now(); for (;;) { const j = jobs.list().find(x => x.id === id); if (!['queued', 'waiting', 'running'].includes(j.status)) return j; if (Date.now() - t0 > ms) throw new Error(`job ${j.status}`); await new Promise(r => setTimeout(r, 100)); } };
  assert.throws(() => jobs.start(d, { film: 'f', kind: 'nope' }), /Unknown studio job/);
  assert.throws(() => jobs.start(d, { film: 'f', kind: 'still', beat: 'missing' }), /Choose a scene/);
  assert.throws(() => jobs.start(d, { film: 'f', kind: 'still', beat: 'a', hash: 'old' }), /Reload/);
  const a = jobs.start(d, { film: 'f', kind: 'captions' }), b = jobs.start(d, { film: 'f', kind: 'captions', draft: true });
  assert.equal(jobs.list().find(x => x.id === b.id).status, 'queued');
  jobs.cancel(b.id);
  assert.equal(jobs.list().find(x => x.id === b.id).status, 'cancelled');
  const done = await wait(a.id);
  assert.equal(done.status, 'complete', done.log); assert.equal(done.matches, true);
  // An edit while a job runs marks its result as not known to match.
  const c = jobs.start(d, { film: 'f', kind: 'captions' });
  run(d, { command: 'set', target: 'beat', beat: 'a', path: 'label', value: 'Changed meanwhile' });
  assert.equal((await wait(c.id)).matches, false);
  // A running job is stopped through its process group.
  const r = jobs.start(d, { film: 'f', kind: 'captions' });
  jobs.cancel(r.id);
  assert.equal((await wait(r.id)).status, 'cancelled');
  assert.equal(jobs.pausing(d), null);
});

test('the studio server refuses malformed paths, dotfiles, bad ranges, unknown endpoints and cross-site writes', async t => {
  const root = fs.mkdtempSync(path.join(process.cwd(), 'build', 'cf-serve-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const film = path.join(root, 'film');
  fs.mkdirSync(film);
  fs.writeFileSync(path.join(film, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Served', music: false, beats: [{ id: 'a', block: 'title', duration: 3, props: { text: 'Hi' } }] }));
  fs.writeFileSync(path.join(film, '.env'), 'SECRET=1');
  fs.writeFileSync(path.join(film, 'clip.txt'), '0123456789');
  const s = await serveViewer({ root: [root], out: path.join(root, 'viewer'), port: 0, render: false });
  t.after(() => s.server.close());
  const base = `http://127.0.0.1:${s.server.address().port}`, rel = p => path.relative(process.cwd(), p).split(path.sep).join('/');
  const id = Object.keys(s.dirs)[0];
  const get = (p, headers) => fetch(base + p, { headers });
  assert.equal((await get('/%E0%A4%A')).status, 400);
  assert.equal((await get(`/${rel(film)}/.env`)).status, 404);
  assert.equal((await get(`/${rel(film)}/clip.txt`, { range: 'bytes=2-4' })).status, 206);
  assert.equal(await (await get(`/${rel(film)}/clip.txt`, { range: 'bytes=2-4' })).text(), '234');
  assert.equal((await get(`/${rel(film)}/clip.txt`, { range: 'bytes=50-60' })).status, 416);
  assert.equal((await get('/api/nothing')).status, 404);
  const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  assert.equal((await fetch(base + '/api/notes', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ film: id, text: 'x' }) })).status, 415);
  assert.equal((await post('/api/notes', { film: id, text: 'x' }, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await post('/api/studio/command', { film: id, command: 'set' }, { origin: 'http://evil.example' })).status, 403);
  const state = await (await get(`/api/studio/state?film=${id}`)).json();
  assert.equal(state.timing.beats.length, 1);
  const ok = await post('/api/studio/command', { film: id, hash: state.hash, command: 'set', target: 'beat', beat: 'a', path: 'props.text', value: 'Hello' });
  assert.equal(ok.status, 200);
  const stale = await post('/api/studio/command', { film: id, hash: state.hash, command: 'set', target: 'beat', beat: 'a', path: 'props.text', value: 'Again' });
  assert.equal(stale.status, 409);
  assert.equal((await post('/api/studio/accept', { film: id, revision: 'r001', by: 'Ana' })).status, 400);
});
