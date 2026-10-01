// The review loop without the renderer: revisions, notes that keep their place across edits,
// keeps, decisions, the impact report, safe undo, stored-object provenance, range math and
// the review page's escaping. (Rendering and the before/after previews are exercised end to
// end by scripts/review-e2e.mjs.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { recordedProject } from './fixtures.mjs';
import { snapshot, loadRevision, listRevisions, impact, lineageOf, workingTimeline, attachVideo, materialize } from '../engine/lib/revisions.mjs';
import { addNote, locate, parseStamp, parseTime, formatTime, importNotes, addKeep, checkKeeps, addDecision, acceptance, readNotes } from '../engine/lib/notes.mjs';
import { cutWords, splitBeat } from '../engine/lib/recording.mjs';
import { rejectRevision, restoreRevision } from '../engine/lib/edit-loop.mjs';
import { frameRange } from '../fframes/render.mjs';
import { writeReviewPage, inertJSON, esc } from '../engine/lib/review-page.mjs';
import { runlogReport } from '../engine/lib/runlog.mjs';
import { objectFile } from '../engine/lib/store.mjs';
import { checkpoints } from '../engine/lib/checkpoints.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const read = (root, f = 'storyboard.json') => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const write = (root, sb) => writeJSON(path.join(root, 'storyboard.json'), sb);
const edit = (root, fn) => {
  const sb = read(root);
  fn(sb);
  write(root, sb);
};
const human = { role: 'human', name: 'Ana' };
const now = async root => ({ id: null, timeline: (await workingTimeline(root)).timeline });

/** A generated-narration film: statements, a dissolve, a two-stop canvas world. */
function draftProject(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-review-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stop = (id, view, text) => ({
    id,
    block: 'canvas',
    vo: `${text} is where the work waits.`,
    props: {
      world: 'city',
      view,
      elements: [{ type: 'rect', id: `${id}-box`, x: view[0] + 200, y: view[1] + 200, w: 400, h: 200, fill: 'accent' }],
    },
  });
  write(root, {
    version: 2,
    title: 'Draft',
    format: { preset: 'landscape', fps: 30 },
    theme: 'ink',
    transition: 'cut',
    music: false,
    beats: [
      { id: 'open', block: 'statement', vo: 'Queues are everywhere.', props: { text: 'Queues are everywhere.' } },
      { id: 'turn', block: 'statement', transition: 'dissolve', vo: 'But nobody sees them.', props: { text: 'Nobody sees them.' } },
      stop('desk', [0, 0, 1920, 1080], 'The desk'),
      stop('door', [1920, 0, 1920, 1080], 'The door'),
      { id: 'end', block: 'statement', vo: 'Measure the wait.', props: { text: 'Measure the wait.' } },
    ],
  });
  return root;
}

test('a note is read against the revision the person watched, then followed by content', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  cutWords(root, { words: 'Short one.' }, { by: human });
  const { revision: r2, timeline: t2 } = await snapshot(root);
  // The same timestamp names different beats in the two cuts.
  const old = addNote(root, { text: 'the guest sounds rushed', revision: r1.id, at: 8.9, by: 'Ana' });
  const fresh = addNote(root, { text: 'what is this?', revision: r2.id, at: 8.9, by: 'Ana' });
  assert.equal(old.anchor.beat, 's003');
  assert.equal(old.anchor.words, 'Right.');
  assert.equal(fresh.anchor.beat, 's004');
  assert.ok(old.anchor.source.from > 9 && old.anchor.source.to < 9.5, 'the recording time of the quoted words');
  const where = locate(root, old, { id: r2.id, timeline: t2 });
  assert.equal(where.state, 'moved');
  assert.equal(where.beat, 's003');
  assert.ok(Math.abs(where.at - (8.9 - 1.7667) - (old.anchor.at - 8.9)) < 0.4, `found ${where.at}`);
});

test('notes on words that were cut are orphaned, partly cut are stale, cut for the note are addressed', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  const whole = addNote(root, { text: 'drop this', revision: r1.id, at: 8.95, by: 'Ana' }); // “Right.” (s003)
  const part = addNote(root, { text: 'odd phrasing', revision: r1.id, at: 5.3, by: 'Ana' }); // around “one. That”
  const own = addNote(root, { text: 'cut the filler', revision: r1.id, at: 13.0, by: 'Ana' });
  cutWords(root, { words: 'Right.' }, { by: human }); // removes s003 whole
  cutWords(root, { words: 'Short one.' }, { by: human });
  cutWords(root, { words: 'at first.' }, { by: human, note: own.id });
  const target = await now(root);
  assert.equal(locate(root, whole, target).state, 'orphaned', 'its beat is gone: never the beat now at that time');
  const p = locate(root, part, target);
  assert.equal(p.state, 'stale');
  assert.match(p.reason, /part of the quoted words was cut/);
  assert.equal(locate(root, own, target).state, 'addressed');
});

test('a split beat keeps its notes: the quoted words are found in the part that has them', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  const n = addNote(root, { text: 'show the line getting shorter', revision: r1.id, at: 17.6, by: 'Ana' });
  assert.equal(n.anchor.beat, 's005');
  splitBeat(root, { beat: 's005', at: 'and the line' });
  const { revision: r2, timeline: t2 } = await snapshot(root);
  assert.deepEqual(r2.lineage.removed.s005, { into: ['s005a', 's005b'] });
  const where = locate(root, n, { id: r2.id, timeline: t2 });
  assert.equal(where.beat, 's005b');
  assert.equal(where.state, 'changed', 'the beat it was in no longer exists as it was');
});

test('keeps: the voice allows the person’s cuts only; words, picture, facts and look hold', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  addKeep(root, { what: 'voice', revision: r1.id, by: human, said: 'keep the voice' });
  cutWords(root, { words: 'Short one.' }, { by: { role: 'agent' } });
  let broken = checkKeeps(root, (await now(root)).timeline);
  assert.equal(broken.length, 1);
  assert.match(broken[0].message, /without the person asking/);
  const root2 = (await recordedProject(t)).root;
  const { revision: q1 } = await snapshot(root2);
  addKeep(root2, { what: 'voice', revision: q1.id, by: human });
  addKeep(root2, { what: 'picture', beats: ['s001'], revision: q1.id, by: human });
  addKeep(root2, { what: 'look', revision: q1.id, by: human });
  cutWords(root2, { words: 'Short one.' }, { by: human });
  assert.deepEqual(checkKeeps(root2, (await now(root2)).timeline), [], 'a cut the person asked for keeps the voice');
  addKeep(root2, { what: 'words', beats: ['s004'], revision: q1.id, by: human });
  cutWords(root2, { words: 'at first.' }, { by: human });
  edit(root2, sb => {
    sb.beats[0].props.mode = 'reveal';
    sb.theme = 'paper';
  });
  broken = checkKeeps(root2, (await now(root2)).timeline);
  assert.deepEqual(broken.map(b => b.what).sort(), ['look', 'picture', 'words']);
});

test('the impact report separates own changes, neighbours, worlds, timing and film-wide changes', async t => {
  const root = draftProject(t);
  const { timeline: A } = await snapshot(root);
  edit(root, sb => (sb.beats[0].props.text = 'Queues are everywhere, quietly.'));
  let r = impact(A, (await now(root)).timeline);
  const status = id => r.beats.find(b => b.id === id)?.status;
  assert.equal(status('open'), 'content');
  assert.equal(status('turn'), 'appearance', 'a dissolve draws the beat before it');
  assert.match(r.beats.find(b => b.id === 'turn').reasons[0], /dissolve entrance draws open/);
  assert.equal(status('desk'), 'unchanged');
  edit(root, sb => {
    sb.beats[0].props.text = 'Queues are everywhere.';
    sb.beats[2].props.elements[0].fill = 'accent2';
  });
  r = impact(A, (await now(root)).timeline);
  assert.equal(status('desk'), 'content');
  assert.equal(status('door'), 'appearance', 'later stops in a world draw what came before');
  assert.equal(status('end'), 'unchanged');
  edit(root, sb => {
    sb.beats[2].props.elements[0].fill = 'accent';
    sb.beats[1].vo = 'But almost nobody sees them.';
  });
  r = impact(A, (await now(root)).timeline);
  assert.equal(status('turn'), 'content');
  assert.equal(r.takes.length, 1, 'an edited line re-records its whole take');
  assert.deepEqual(r.takes[0].beats, ['open', 'turn', 'desk', 'door', 'end']);
  assert.ok(r.beats.filter(b => b.status === 'shifted').length >= 1, 'later beats move with the longer line');
  edit(root, sb => {
    sb.beats[1].vo = 'But nobody sees them.';
    sb.theme = 'paper';
  });
  r = impact(A, (await now(root)).timeline);
  assert.equal(r.film.look, 'changed');
  assert.ok(r.beats.every(b => b.status === 'appearance'));
  assert.match(r.summary[0], /Film-wide/);
});

test('reject undoes a candidate only where nothing changed since; restore is explicit and recoverable', async t => {
  const root = draftProject(t);
  const { revision: base } = await snapshot(root);
  const original = read(root);
  edit(root, sb => {
    sb.beats[0].props.text = 'Lines are everywhere.';
    sb.beats[4].props.text = 'Measure every wait.';
  });
  const { revision: cand } = await snapshot(root, { kind: 'candidate' });
  edit(root, sb => (sb.beats[4].props.text = 'Measure the wait, then act.')); // the person kept working
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'not this' });
  assert.deepEqual(r.restored, ['open']);
  assert.equal(r.conflicts.length, 1);
  assert.match(r.conflicts[0], /end was edited after/);
  const now1 = read(root);
  assert.equal(now1.beats[0].props.text, 'Queues are everywhere.');
  assert.equal(now1.beats[4].props.text, 'Measure the wait, then act.', 'later work survives');
  assert.ok(listRevisions(root).some(x => x.id === r.restorePoint && x.kind === 'restore-point'));
  const back = await restoreRevision(root, { revision: base.id, by: 'Ana', said: 'start over' });
  assert.deepEqual(read(root), original);
  await restoreRevision(root, { revision: back.restorePoint, by: 'Ana', said: 'no, undo that' });
  assert.equal(read(root).beats[4].props.text, 'Measure the wait, then act.');
});

test('stored inputs are checked against their hashes before use', async t => {
  const { root } = await recordedProject(t);
  const { revision } = await snapshot(root);
  const rel = revision.inputs['assets/vo/s002.wav'];
  const file = path.join(root, ...rel.split('/'));
  assert.ok(objectFile(root, rel));
  fs.chmodSync(file, 0o644);
  fs.appendFileSync(file, Buffer.from([1, 2, 3]));
  assert.throws(() => objectFile(root, rel), /damaged/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-mat-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  assert.throws(() => materialize(root, revision.id, dir), /damaged/);
  assert.throws(() => objectFile(root, 'review/objects/../../storyboard.json'), /Invalid object/);
});

test('ranges keep transitions and handles, and stop at the film’s ends', () => {
  const job = {
    fps: 30,
    frames: 300,
    beats: [
      { id: 'a', start_frame: 0, frames: 100, transition: 'cut' },
      { id: 'b', start_frame: 100, frames: 100, transition: 'panel' },
      { id: 'c', start_frame: 200, frames: 100, transition: 'cut' },
    ],
  };
  // panel covers 0.42 s before and 0.5 s after its cut: half a second or more is kept.
  assert.deepEqual([frameRange(job, { beats: ['b'], handles: 0 }).a, frameRange(job, { beats: ['b'], handles: 0 }).b], [85, 200]);
  assert.deepEqual([frameRange(job, { beats: ['a'], handles: 0 }).a, frameRange(job, { beats: ['a'], handles: 0 }).b], [0, 115], 'the next entrance');
  const r = frameRange(job, { beats: ['c'], handles: 2 });
  assert.deepEqual([r.a, r.b], [140, 300]);
  assert.deepEqual(
    r.covered.map(x => [x.id, x.local]),
    [
      ['b', [0, 2]],
      ['c', [2, 160 / 30]],
    ],
  );
  assert.deepEqual([frameRange(job, { from: 1, to: 2, handles: 0 }).a, frameRange(job, { from: 1, to: 2, handles: 0 }).b], [30, 60]);
  assert.throws(() => frameRange(job, { beats: ['nope'] }), /No beat/);
});

test('the review page escapes everything a project or a person wrote', async t => {
  const { root } = await recordedProject(t);
  await snapshot(root);
  const evil = '</script><img src=x onerror=alert(1)> & "q"';
  addNote(root, { text: evil, at: 2, by: 'Ana' });
  const html = fs.readFileSync(writeReviewPage(root), 'utf8');
  assert.ok(!html.includes('<img src=x'));
  assert.ok(html.includes(esc(evil)));
  assert.equal((html.match(/<script/g) ?? []).length, 2);
  const json = inertJSON({ x: evil, y: ' ' });
  assert.ok(!json.includes('</script>') && !json.includes(' '));
  assert.deepEqual(JSON.parse(json), { x: evil, y: ' ' });
});

test('stamped notes from the page read back; imports are validated', async t => {
  const { root } = await recordedProject(t);
  const { revision } = await snapshot(root);
  const s = parseStamp(`[ClearFrame ${revision.id} @ 0:08.90 · s003 · “Right.”] the guest sounds rushed`);
  assert.deepEqual(s, { revision: revision.id, at: 8.9, beat: 's003', text: 'the guest sounds rushed' });
  assert.equal(parseStamp('just a note'), null);
  assert.equal(parseTime('1:02:03.5'), 3723.5);
  assert.equal(formatTime(133.4), '2:13.40');
  const [n] = importNotes(root, { notes: [{ revision: revision.id, at: 8.9, text: 'from the page' }] });
  assert.equal(n.anchor.beat, 's003');
  assert.throws(() => importNotes(root, { notes: [{ revision: '../r001', at: 1, text: 'x' }] }), /Invalid revision/);
  assert.throws(() => importNotes(root, { notes: [{ revision: revision.id, at: 1, text: '' }] }), /needs text/);
  assert.equal(readNotes(root).length, 1);
});

test('decisions: only a person accepts; an acceptance survives a shift but not an edit', async t => {
  const { root } = await recordedProject(t);
  const { revision } = await snapshot(root);
  assert.throws(() => addDecision(root, { action: 'accept', role: 'agent', revision: revision.id }), /person/);
  assert.throws(() => addDecision(root, { action: 'accept', role: 'human', by: 'Ana', revision: revision.id }), /--said/);
  addDecision(root, { action: 'decide', role: 'agent', reason: 'one-shot', revision: revision.id, scope: { checkpoint: 'rough' } });
  assert.deepEqual(acceptance(root, (await now(root)).timeline), {}, 'an agent decision is not acceptance');
  addDecision(root, { action: 'accept', role: 'human', by: 'Ana', said: 'yes', revision: revision.id, scope: { beats: ['s005'] } });
  cutWords(root, { words: 'Short one.' }, { by: human });
  assert.equal(acceptance(root, (await now(root)).timeline).s005.state, 'moved');
  cutWords(root, { words: 'and the line' }, { by: human });
  assert.equal(acceptance(root, (await now(root)).timeline).s005.state, 'changed');
});

test('the rough-cut checkpoint closes on the person’s notes or acceptance, not on a file', async t => {
  const { root } = await recordedProject(t);
  const { revision } = await snapshot(root);
  const video = path.join(root, 'fake.mp4');
  fs.writeFileSync(video, crypto.randomBytes(64));
  const sha = crypto.createHash('sha256').update(fs.readFileSync(video)).digest('hex');
  attachVideo(root, revision.id, { file: video, profile: 'rough', receipt: { outputSha256: sha, frames: 1, encoder: 'test' } });
  const rough = () => checkpoints(root, { mode: 'guided' }).find(c => c.id === 'rough');
  assert.equal(rough().done, false);
  addDecision(root, { action: 'decide', role: 'agent', reason: 'looks fine', revision: revision.id, scope: { checkpoint: 'rough' } });
  assert.equal(rough().done, false, 'guided: an agent decision does not close it');
  assert.equal(checkpoints(root, { mode: 'one-shot' }).find(c => c.id === 'rough').done, true);
  addNote(root, { text: 'the opening drags', at: 1, by: 'Ana' });
  assert.equal(rough().done, true);
});

test('the run log reports measured time and gaps separately', () => {
  const r = runlogReport([
    { cmd: 'ingest', startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T10:00:05.000Z', ms: 5000, phases: [{ name: 'ingest', ms: 4000 }] },
    { cmd: 'draft', startedAt: '2026-10-01T10:20:00.000Z', endedAt: '2026-10-01T10:21:00.000Z', ms: 60000, revision: 'r001', phases: [{ name: 'native-render', ms: 50000 }] },
  ]);
  assert.equal(r.measuredMs, 65000);
  assert.equal(r.gapMs, 20 * 60000 - 5000);
  assert.equal(r.wallMs, 21 * 60000);
  assert.equal(r.phases['native-render'].ms, 50000);
});

test('lineage records a beat removed by a cut, with the words that went', async t => {
  const { root } = await recordedProject(t);
  const { timeline: A } = await snapshot(root);
  cutWords(root, { words: 'Right.' }, { by: human });
  const { revision, timeline: B } = await snapshot(root);
  assert.equal(revision.lineage.removed.s003.deleted, true);
  assert.equal(revision.lineage.removed.s003.words, 'Right.');
  const r = impact(A, B, { lineage: lineageOf(A, B) });
  assert.equal(r.beats.find(b => b.id === 's003').status, 'removed');
  assert.equal(loadRevision(root, revision.id).meta.parent, listRevisions(root)[0].id);
});
