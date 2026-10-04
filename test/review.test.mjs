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
import { spawnSync } from 'node:child_process';
import { recordedProject } from './fixtures.mjs';
import { snapshot, loadRevision, listRevisions, impact, lineageOf, workingTimeline, attachVideo, materialize, affectedPassages } from '../engine/lib/revisions.mjs';
import { addNote, locate, parseStamp, parseTime, formatTime, importNotes, addKeep, checkKeeps, addDecision, acceptance, readNotes } from '../engine/lib/notes.mjs';
import { cutWords, splitBeat, uncut, mergeBeats } from '../engine/lib/recording.mjs';
import { useProject } from '../fframes/library.mjs';
import { rejectRevision, restoreRevision, revise } from '../engine/lib/edit-loop.mjs';
import { frameRange } from '../fframes/render.mjs';
import { writeReviewPage, inertJSON, esc } from '../engine/lib/review-page.mjs';
import { runlogReport } from '../engine/lib/runlog.mjs';
import { objectFile } from '../engine/lib/store.mjs';
import { checkpoints, coverage } from '../engine/lib/checkpoints.mjs';
import { writeJSON } from '../engine/lib/util.mjs';
import { classifyAudit, roughStandIns } from '../fframes/prepare.mjs';
import { createJob } from '../fframes/job.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';

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

test('a range note across beats keeps its place when an earlier cut moves it', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  const n = addNote(root, { text: 'this whole exchange drags', revision: r1.id, at: 7.2, to: 12.5, by: 'Ana' });
  assert.deepEqual(n.anchor.beats, ['s002', 's003', 's004']);
  assert.ok('Short one. That is the whole story.'.endsWith(n.anchor.words), `quoted from s002 only: ${n.anchor.words}`);
  cutWords(root, { words: 'Queues form' }, { by: human });
  const where = locate(root, n, await now(root));
  assert.deepEqual([where.state, where.beat], ['moved', 's002']);
  assert.ok(where.at < 7.2, `now at ${where.at}`);
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

test('a note returns with its beat when the cut that removed it is undone', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  const n = addNote(root, { text: 'the guest sounds rushed', revision: r1.id, at: 8.95, by: 'Ana' });
  const c = cutWords(root, { words: 'Right.' }, { by: human });
  await snapshot(root);
  assert.equal(locate(root, n, await now(root)).state, 'orphaned');
  uncut(root, { id: c.id });
  await snapshot(root);
  const back = locate(root, n, await now(root));
  assert.deepEqual([back.state, back.beat], ['current', 's003']);
  assert.ok(Math.abs(back.at - 8.95) < 0.01, `the playhead maps back to ${back.at}`);
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

test('rough cuts relax only declared stand-in text: a clipped source line or a textless finding still fails', () => {
  const job = {
    beats: [
      { id: 'chart', props: { title: 'Waits by hour', source: 'Source: City transit survey' }, words: [], captions: [] },
      {
        id: 'slate',
        props: { mode: 'highlight' },
        art: { over: [{ type: 'text', text: 'PLACEHOLDER · the desk at rush hour' }] },
        words: [{ text: 'Then' }, { text: 'it' }, { text: 'explodes.' }],
        captions: [],
      },
      {
        id: 'draw',
        props: {
          elements: [
            { type: 'text', text: 'Arrivals (rough label)' },
            { type: 'text', text: 'Departures' },
          ],
        },
        words: [],
        captions: [],
      },
    ],
  };
  const allowed = [
    { beat: 'slate', text: 'PLACEHOLDER · the desk at rush hour', why: 'placeholder slate' },
    { beat: 'draw', text: 'Arrivals (rough label)', why: 'marked unfinished' },
  ];
  const finding = (beat, text, kind = 'clipped') => ({ beat, level: 'error', kind, text, message: `${kind}: ${text ?? ''}`, seconds: 1 });
  const r = classifyAudit(
    [
      finding('chart', 'Source: City transit survey'), // attribution without a digit
      finding('chart', 'Waits by hour', 'covered'), // a category label without a digit
      finding('chart', undefined, 'small'), // no text to judge
      finding('slate', 'PLACEHOLDER · the desk at rush hour'), // the slate itself
      finding('slate', 'it explodes.', 'covered'), // the words spoken over the slate
      finding('draw', 'Arrivals (rough'), // a wrapped line of an element marked unfinished
      finding('draw', 'Departures', 'small'), // a finished element beside it
    ],
    { rough: true, allowed, job },
  );
  assert.equal(r.craft.length, 2, r.craft.join('\n'));
  assert.ok(r.craft.every(c => /\[(placeholder slate|marked unfinished)\]/.test(c)));
  assert.equal(r.errors.length, 5);
  assert.equal(classifyAudit([finding('slate', 'PLACEHOLDER · the desk at rush hour')], { rough: false, allowed, job }).errors.length, 1, 'only rough relaxes');
  const twice = { beats: [{ id: 'draw', props: { elements: [{ text: 'Coming soon' }, { text: 'Coming soon' }] }, words: [], captions: [] }] };
  assert.equal(
    classifyAudit([finding('draw', 'Coming soon')], { rough: true, allowed: [{ beat: 'draw', text: 'Coming soon', why: 'marked unfinished' }], job: twice }).errors.length,
    1,
    'text a finished element also shows is never relaxed',
  );
});

test('placeholders and unfinished elements are rough-only stand-ins and never reach the renderer', t => {
  const root = draftProject(t);
  edit(root, sb => {
    sb.beats[2].props.elements.push({ type: 'text', id: 'later', text: 'Label to come', x: 300, y: 300, size: 48, unfinished: 'final wording pending' });
    sb.beats[4].placeholder = 'the closing shot of the desk';
  });
  const sb = loadStoryboard(root),
    timing = computeTiming(root);
  assert.throws(() => roughStandIns(root, structuredClone(sb), structuredClone(timing)), /declared placeholder|marked unfinished/);
  const r = roughStandIns(root, structuredClone(sb), structuredClone(timing), { rough: true });
  assert.deepEqual(r.unfinished, [{ beat: 'desk', element: 'later', note: 'final wording pending' }]);
  assert.deepEqual(
    r.allowed.map(a => [a.beat, a.why]),
    [
      ['desk', 'marked unfinished: final wording pending'],
      ['end', 'placeholder slate'],
    ],
  );
  assert.ok(!JSON.stringify(r.sb).includes('"unfinished"'), 'the flag is stripped');
  const job = createJob(r.sb, r.timing, { draft: true });
  assert.deepEqual(job.errors, []);
  assert.equal(job.job.beats.find(b => b.id === 'end').art.over[1].text, 'PLACEHOLDER · the closing shot of the desk');
});

test('the CLI loads and lists the review commands', () => {
  const r = spawnSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'engine', 'cli.mjs'), 'help'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  for (const cmd of ['paper', 'revise', 'note', 'notes', 'keep', 'accept', 'reject', 'decide', 'restore', 'cut', 'uncut', 'runlog']) assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`));
  assert.match(r.stdout, /unfinished/);
});

test('a cut and the beat it changes next to it are one passage; separate stretches stay separate', () => {
  const tl = ids => ({ beats: ids.map((id, i) => ({ id, startFrame: i * 30, frames: 30 })) });
  const A = tl(['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(affectedPassages(A, tl(['a', 'b', 'd', 'e']), [
    { id: 'c', status: 'removed' },
    { id: 'd', status: 'appearance' },
  ]), [{ beats: ['b', 'd'], removed: ['c'], before: [30, 120], after: [30, 90] }]);
  assert.equal(affectedPassages(A, A, [{ id: 'a', status: 'content' }, { id: 'd', status: 'content' }]).length, 2);
});

test('coverage counts each chapter: pictures, placeholders, unfinished elements and acceptance', async t => {
  const root = draftProject(t);
  edit(root, sb => {
    sb.beats.forEach((b, i) => (b.chapter = i < 2 ? 'Setup' : 'World'));
    sb.beats[4].placeholder = 'the ending, drawn later';
    sb.beats[2].props.elements[0].unfinished = true;
  });
  const { revision } = await snapshot(root);
  addDecision(root, { action: 'accept', role: 'human', by: 'Ana', said: 'the opening works', revision: revision.id, scope: { beats: ['open', 'turn'] } });
  assert.deepEqual(coverage(root), [
    { chapter: 'Setup', beats: 2, placeholders: 0, unfinished: 0, pictured: 2, accepted: 2 },
    { chapter: 'World', beats: 3, placeholders: 1, unfinished: 1, pictured: 2, accepted: 0 },
  ]);
});

// Final: fake encodes isolate the status rules (no render is claimed); each revision gets
// distinct bytes, written to build/video.mp4 as a final render would.
function finalOf(root, rev) {
  const file = path.join(root, 'build', 'video.mp4');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `final encode of ${rev.id} ${crypto.randomUUID()}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  attachVideo(root, rev.id, { file, profile: 'final', receipt: { outputSha256: sha, frames: rev.frames, encoder: 'test' } });
  return file;
}
const final = (root, mode = 'guided') => checkpoints(root, { mode }).find(c => c.id === 'final');
const say = { by: 'Ana', said: 'ship it' };

test('Final closes only on a whole-cut acceptance of the current content and its encode', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  finalOf(root, r1);
  assert.equal(final(root).done, false, 'rendered is not accepted');
  addDecision(root, { action: 'accept', role: 'human', ...say, revision: r1.id, scope: { checkpoint: 'final' } });
  assert.equal(final(root).done, true);
  // A new cut: the old acceptance must not approve it.
  edit(root, sb => (sb.beats[0].props.mode = 'reveal'));
  assert.equal(final(root).done, false, 'the working copy changed');
  const { revision: r2 } = await snapshot(root);
  finalOf(root, r2);
  const f = final(root);
  assert.equal(f.done, false, 'r001 was accepted, r002 was not');
  assert.equal(f.decision, null);
  assert.match(f.detail, /r002 is current; not accepted/);
  // One note's result or some beats are not the film.
  const n = addNote(root, { text: 'the opening reads better now', revision: r2.id, at: 1, by: 'Ana' });
  addDecision(root, { action: 'accept', role: 'human', ...say, revision: r2.id, scope: { note: n.id } });
  assert.equal(final(root).done, false, 'note-scoped acceptance');
  addDecision(root, { action: 'accept', role: 'human', ...say, revision: r2.id, scope: { beats: ['s001'] } });
  assert.equal(final(root).done, false, 'beat-scoped acceptance');
  addDecision(root, { action: 'accept', role: 'human', ...say, revision: r2.id });
  assert.equal(final(root).done, true, 'acceptance of the whole revision');
  addDecision(root, { action: 'reject', role: 'human', by: 'Ana', said: 'no, the opening is wrong', revision: r2.id });
  assert.equal(final(root).done, false, 'a later rejection reopens it');
});

test('Final reopens when the output or the audio no longer match, and agents only decide in one-shot work', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  const file = finalOf(root, r1);
  addDecision(root, { action: 'decide', role: 'agent', reason: 'one-shot', revision: r1.id, scope: { checkpoint: 'rough' } });
  assert.equal(final(root, 'one-shot').done, false, 'a rough-cut decision is not the final');
  addDecision(root, { action: 'decide', role: 'agent', reason: 'one-shot: final', revision: r1.id, scope: { checkpoint: 'final' } });
  assert.equal(final(root, 'one-shot').done, true);
  assert.equal(final(root, 'guided').done, false, 'guided work needs the person');
  addDecision(root, { action: 'accept', role: 'human', ...say, revision: r1.id, scope: { checkpoint: 'final' } });
  assert.equal(final(root).done, true);
  // The deliverable is no longer that encode (a draft rendered over it, say).
  const encode = fs.readFileSync(file);
  fs.writeFileSync(file, 'a draft rendered later');
  assert.match(final(root).detail, /build\/video\.mp4 is not r001's final encode/);
  assert.equal(final(root).done, false);
  fs.writeFileSync(file, encode);
  assert.equal(final(root).done, true);
  // An audio-only change leaves storyboard.json untouched but is a different film.
  const wav = path.join(root, 'assets/vo/s003.wav');
  const bytes = fs.readFileSync(wav);
  bytes[bytes.length - 2] ^= 1;
  fs.writeFileSync(wav, bytes);
  const f = final(root);
  assert.equal(f.done, false);
  assert.match(f.detail, /changed since the last final render/);
});

test('keep facts holds what a chart means — labels, units, attribution, cited sources — but not its styling', async t => {
  const { root } = await recordedProject(t);
  edit(root, sb => {
    sb.beats[0].block = 'bars';
    sb.beats[0].props = { data: [{ label: 'Revenue', value: 10 }, { label: 'Costs', value: 20 }], source: 'Recording', format: ' dollars' };
    sb.beats[1].block = 'canvas';
    sb.beats[1].props = { elements: [{ type: 'text', id: 'claim', text: 'Waits fell', x: 400, y: 500, size: 80, fill: 'ink' }] };
  });
  const { revision } = await snapshot(root);
  addKeep(root, { what: 'facts', beats: ['s001', 's002'], revision: revision.id, by: human, said: 'keep the facts' });
  const broken = async change => {
    const before = read(root);
    edit(root, change);
    const v = checkKeeps(root, (await now(root)).timeline);
    write(root, before);
    return v;
  };
  assert.equal((await broken(sb => (sb.beats[0].props.data[0].label = 'Profit'))).length, 1, 'a category label');
  assert.equal((await broken(sb => (sb.beats[0].props.format = ' percent'))).length, 1, 'a unit');
  assert.equal((await broken(sb => (sb.beats[0].props.source = 'Recording, adjusted'))).length, 1, 'the attribution line');
  assert.equal((await broken(sb => (sb.sources[0].title = 'Recording: a different file'))).length, 1, 'the source it cites');
  assert.equal((await broken(sb => (sb.beats[1].props.elements[0].text = 'Waits fell, mostly'))).length, 1, 'a qualifier, no digits');
  assert.deepEqual(
    await broken(sb => {
      sb.beats[0].props.sort = 'desc';
      Object.assign(sb.beats[1].props.elements[0], { fill: 'accent2', x: 520, enter: 'rise', size: 96 });
    }),
    [],
    'order, colour, position, size and entrance are not facts',
  );
});

test('released videos free their stored copies unless something else still needs them', async t => {
  const { root } = await recordedProject(t);
  const objects = [];
  for (let i = 0; i < 5; i++) {
    edit(root, sb => (sb.beats[0].props.maxWords = 3 + i));
    const { revision } = await snapshot(root);
    const file = path.join(root, `v${i}.mp4`);
    // r002 and r005 share bytes: one stored copy that r005 still needs.
    fs.writeFileSync(file, i === 4 ? 'shared encode' : i === 1 ? 'shared encode' : `encode ${i}`);
    const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (i === 0) addDecision(root, { action: 'accept', role: 'human', by: 'Ana', said: 'keep this one', revision: revision.id });
    attachVideo(root, revision.id, { file, profile: 'draft', receipt: { outputSha256: sha, frames: 1, encoder: 'test' } });
    objects.push(path.join(root, ...listRevisions(root).at(-1).videos[0].object.split('/')));
  }
  const kept = listRevisions(root).map(r => [r.id, r.videos[0].retained]);
  assert.deepEqual(kept, [
    ['r001', true],
    ['r002', false],
    ['r003', true],
    ['r004', true],
    ['r005', true],
  ]);
  assert.ok(fs.existsSync(objects[0]), 'accepted: kept');
  assert.ok(fs.existsSync(objects[1]), 'released, but r005 has the same bytes');
  assert.equal(objects[1], objects[4]);
  edit(root, sb => (sb.beats[0].props.maxWords = 9));
  const { revision: r6 } = await snapshot(root);
  const file = path.join(root, 'v6.mp4');
  fs.writeFileSync(file, 'encode 6');
  attachVideo(root, r6.id, { file, profile: 'draft', receipt: { outputSha256: crypto.createHash('sha256').update('encode 6').digest('hex'), frames: 1, encoder: 'test' } });
  assert.ok(!fs.existsSync(objects[2]), 'r003 released and nothing else needs its copy: freed');
  assert.equal(listRevisions(root).find(r => r.id === 'r003').videos[0].retained, false);
});

// Restore: the result must be the target revision's effective inputs, not an overlay.
const LIB = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'library');
function withPictures(t) {
  const root = draftProject(t);
  fs.mkdirSync(path.join(root, 'assets/img'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/img/pic.png'), 'png bytes, first version');
  edit(root, sb => {
    sb.assets = [{ id: 'pic', kind: 'image', prompt: 'a desk' }];
    for (const i of [0, 4]) {
      sb.beats[i].block = 'canvas';
      sb.beats[i].props = { elements: [{ type: 'image', asset: 'pic', x: 100, y: 100, w: 400, h: 300 }] };
    }
  });
  return root;
}

test('a whole restore puts back the revision’s effective inputs: later overrides and shadowing files are set aside', async t => {
  const root = withPictures(t);
  edit(root, sb => {
    sb.theme = 'ink';
    sb.music = { volume: 0.2 };
  });
  fs.mkdirSync(path.join(root, 'assets/music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'assets/music/bed.mp3'), 'first bed');
  fs.writeFileSync(path.join(root, 'assets/music/bed.json'), JSON.stringify({ file: 'assets/music/bed.mp3' }));
  const { revision: r1, timeline: t1 } = await snapshot(root);
  // Afterwards: a palette override, a JPEG that wins over the PNG, a regenerated bed.
  const pal = JSON.parse(fs.readFileSync(path.join(LIB, 'palettes/ink.json'), 'utf8'));
  pal.colors.accent = '#ffffff';
  fs.mkdirSync(path.join(root, 'library/palettes'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library/palettes/ink.json'), JSON.stringify(pal));
  fs.writeFileSync(path.join(root, 'assets/img/pic.jpg'), 'a newer picture');
  fs.rmSync(path.join(root, 'assets/music/bed.mp3'));
  fs.writeFileSync(path.join(root, 'assets/music/bed.wav'), 'second bed');
  fs.writeFileSync(path.join(root, 'assets/music/bed.json'), JSON.stringify({ file: 'assets/music/bed.wav' }));
  useProject(null);
  await snapshot(root);
  const r = await restoreRevision(root, { revision: r1.id, by: 'Ana', said: 'back to the first version' });
  assert.equal(r.verified.state, 'exact', JSON.stringify(r.verified));
  assert.notEqual(r.restorePoint, r.now);
  assert.deepEqual(r.aside.map(a => a.file).sort(), ['assets/img/pic.jpg', 'library/palettes/ink.json']);
  assert.ok(!fs.existsSync(path.join(root, 'library/palettes/ink.json')));
  assert.ok(fs.existsSync(path.join(root, r.aside.find(a => a.file === 'assets/img/pic.jpg').to)), 'set aside, not deleted');
  useProject(null);
  const { timeline } = await workingTimeline(root);
  assert.equal(timeline.film.look, t1.film.look);
  assert.equal(timeline.music.src, 'assets/music/bed.mp3');
  // And the restore itself can be undone: the point before has the override.
  const back = await restoreRevision(root, { revision: r.restorePoint, by: 'Ana', said: 'undo that' });
  assert.equal(back.verified.state, 'exact');
  assert.ok(fs.existsSync(path.join(root, 'library/palettes/ink.json')));
  useProject(null);
  assert.deepEqual(await restoreRevision(root, { revision: r.restorePoint, by: 'Ana', said: 'again' }), {
    revision: r.restorePoint,
    unchanged: true,
    restored: [],
    verified: { state: 'exact' },
  });
});

test('restoring some beats never silently rewrites media other beats use, or replays merged recording', async t => {
  const root = withPictures(t);
  const { revision: r1 } = await snapshot(root);
  fs.writeFileSync(path.join(root, 'assets/img/pic.png'), 'png bytes, second version');
  edit(root, sb => (sb.beats[0].props.elements[0].w = 500));
  await snapshot(root);
  await assert.rejects(restoreRevision(root, { revision: r1.id, beats: ['open'], by: 'Ana', said: 'the old opening' }), /also change other beats: assets\/img\/pic\.png \(used by end\)/);
  assert.equal(fs.readFileSync(path.join(root, 'assets/img/pic.png'), 'utf8'), 'png bytes, second version', 'refused before touching anything');
  const r = await restoreRevision(root, { revision: r1.id, beats: ['open'], by: 'Ana', said: 'the old opening, picture and all', shared: true });
  assert.deepEqual(r.alsoChanged, [{ file: 'assets/img/pic.png', beats: ['end'] }]);
  assert.equal(read(root).beats[0].props.elements[0].w, 400);
  // A recorded beat merged away cannot come back on its own.
  const { root: rec } = await recordedProject(t);
  const { revision: q1 } = await snapshot(rec);
  mergeBeats(rec, { beats: ['s004', 's005'] });
  await snapshot(rec);
  await assert.rejects(restoreRevision(rec, { revision: q1.id, beats: ['s005'], by: 'Ana', said: 'the old ending' }), /s005 became s004/);
  // Even when nothing records the merge, the recording itself would play twice.
  const sbRec = read(rec);
  delete sbRec.beats.find(b => b.id === 's004').was;
  write(rec, sbRec);
  await assert.rejects(restoreRevision(rec, { revision: q1.id, beats: ['s005'], by: 'Ana', said: 'the old ending' }), /play the same recording twice \(s004 and s005\)/);
});

test('reject leaves a shared file alone when another beat that uses it changed since', async t => {
  const root = withPictures(t);
  await snapshot(root);
  fs.writeFileSync(path.join(root, 'assets/img/pic.png'), 'png bytes, candidate');
  edit(root, sb => (sb.beats[0].props.elements[0].x = 200));
  const { revision: cand } = await snapshot(root, { kind: 'candidate' });
  edit(root, sb => (sb.beats[4].props.elements[0].y = 160)); // the other user of pic.png, edited after
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'no' });
  assert.ok(r.restored.includes('open'));
  assert.ok(r.conflicts.some(c => /end was edited after/.test(c)));
  assert.ok(r.conflicts.some(c => /assets\/img\/pic\.png is also used by end/.test(c)));
  assert.equal(fs.readFileSync(path.join(root, 'assets/img/pic.png'), 'utf8'), 'png bytes, candidate', 'left as it is');
  assert.equal(read(root).beats[0].props.elements[0].x, 100);
});

// Rejecting a candidate that rearranged beats.
const ids = root => read(root).beats.map(b => b.id);

test('rejecting a reorder puts the parent’s order back, and the report names the reorder', async t => {
  const root = draftProject(t);
  const { timeline: A } = await snapshot(root);
  const original = ids(root);
  edit(root, sb => sb.beats.reverse());
  const { revision: cand, timeline: B } = await snapshot(root, { kind: 'candidate' });
  const report = impact(A, B);
  assert.equal(report.order.reordered, true);
  assert.match(report.summary.join(' '), /The order of beats changed/);
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'undo that reorder' });
  assert.deepEqual(r.restored, ['beat order']);
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(ids(root), original);
});

test('a reorder made after the candidate is kept and reported; a later content edit survives the reject', async t => {
  const root = draftProject(t);
  await snapshot(root);
  const original = ids(root);
  edit(root, sb => sb.beats.reverse());
  const { revision: cand } = await snapshot(root, { kind: 'candidate' });
  edit(root, sb => ([sb.beats[0], sb.beats[1]] = [sb.beats[1], sb.beats[0]])); // the person moved two more
  const later = ids(root);
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'no' });
  assert.ok(r.conflicts.some(c => /beat order was changed after/.test(c)));
  assert.deepEqual(ids(root), later, 'their order is left as they made it');
  // Again, with a content edit instead of a reorder: the order goes back, the edit stays.
  const root2 = draftProject(t);
  await snapshot(root2);
  edit(root2, sb => sb.beats.reverse());
  const { revision: cand2 } = await snapshot(root2, { kind: 'candidate' });
  edit(root2, sb => (sb.beats.find(b => b.id === 'desk').props.elements[0].fill = 'accent2'));
  const r2 = await rejectRevision(root2, { revision: cand2.id, by: 'Ana', said: 'no' });
  assert.deepEqual(r2.restored, ['beat order']);
  assert.deepEqual(ids(root2), original);
  assert.equal(read(root2).beats.find(b => b.id === 'desk').props.elements[0].fill, 'accent2');
});

test('a cut that moves later beats in time is not a reorder', async t => {
  const { root } = await recordedProject(t);
  const { timeline: A } = await snapshot(root);
  cutWords(root, { words: 'Right.' }, { by: human });
  const { revision: cand, timeline: B } = await snapshot(root, { kind: 'candidate' });
  assert.equal(impact(A, B).order.reordered, false);
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'keep the guest' });
  assert.ok(!r.restored.includes('beat order'));
  assert.deepEqual(ids(root), ['s001', 's002', 's003', 's004', 's005']);
});

test('a rejected reorder that also removed a beat comes back in the parent’s order; a beat added since keeps its place', async t => {
  const root = draftProject(t);
  await snapshot(root);
  edit(root, sb => {
    sb.beats.reverse();
    sb.beats = sb.beats.filter(b => b.id !== 'door');
  });
  const { revision: cand } = await snapshot(root, { kind: 'candidate' });
  // After the candidate the person adds a card after the desk.
  edit(root, sb => sb.beats.splice(sb.beats.findIndex(b => b.id === 'desk') + 1, 0, { id: 'card', block: 'statement', vo: 'One more thing.', props: { text: 'One more thing.' } }));
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'no' });
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.restored, ['door', 'beat order']);
  assert.deepEqual(ids(root), ['open', 'turn', 'desk', 'card', 'door', 'end']);
});

test('a beat split after a rejected reorder goes back with its original, still split', async t => {
  const { root } = await recordedProject(t);
  await snapshot(root);
  edit(root, sb => sb.beats.reverse());
  const { revision: cand } = await snapshot(root, { kind: 'candidate' });
  splitBeat(root, { beat: 's005', at: 'and the line' });
  const r = await rejectRevision(root, { revision: cand.id, by: 'Ana', said: 'keep the order' });
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.restored, ['beat order']);
  assert.deepEqual(ids(root), ['s001', 's002', 's003', 's004', 's005a', 's005b']);
  // Its parts moved apart since: that is the person's arrangement, kept and reported.
  const { root: two } = await recordedProject(t);
  await snapshot(two);
  edit(two, sb => sb.beats.reverse());
  const { revision: cand2 } = await snapshot(two, { kind: 'candidate' });
  splitBeat(two, { beat: 's005', at: 'and the line' });
  edit(two, sb => sb.beats.push(sb.beats.splice(1, 1)[0])); // s005b to the end
  const later = ids(two);
  const r2 = await rejectRevision(two, { revision: cand2.id, by: 'Ana', said: 'keep the order' });
  assert.ok(r2.conflicts.some(c => /beat order was changed after/.test(c)));
  assert.deepEqual(ids(two), later);
});

test('restoring a beat puts it after what is left of the beat before it', async t => {
  const { root } = await recordedProject(t);
  const { revision: r1 } = await snapshot(root);
  cutWords(root, { words: 'Right.' }, { by: human });
  splitBeat(root, { beat: 's002', at: 'That is' });
  await restoreRevision(root, { revision: r1.id, beats: ['s003'], by: 'Ana', said: 'bring back the guest' });
  assert.deepEqual(ids(root), ['s001', 's002a', 's002b', 's003', 's004', 's005']);
});

test('moving the note’s own beat is in scope, even past a beat outside it, and makes a candidate', async t => {
  const root = draftProject(t);
  const { revision, timeline } = await snapshot(root);
  const n = addNote(root, { text: 'the desk should come after the door', revision: revision.id, at: timeline.beats[2].start + 0.2, by: 'Ana' });
  edit(root, sb => sb.beats.splice(3, 0, sb.beats.splice(2, 1)[0]));
  assert.deepEqual(ids(root), ['open', 'turn', 'door', 'desk', 'end']);
  const r = await revise(root, { note: n.id, render: false });
  assert.equal(r.report.order.reordered, true);
  assert.match(r.report.summary.join(' '), /The order of beats changed/);
});

test('revise counts moving beats outside the note as out of scope', async t => {
  const root = draftProject(t);
  const { revision, timeline } = await snapshot(root);
  const n = addNote(root, { text: 'the turn should hit harder', revision: revision.id, at: timeline.beats[1].start + 0.2, by: 'Ana' });
  edit(root, sb => {
    sb.beats.find(b => b.id === 'turn').props.text = 'Nobody sees them. Ever.';
    sb.beats.push(sb.beats.splice(2, 1)[0]); // and, unasked, moves desk to the end
  });
  await assert.rejects(revise(root, { note: n.id, render: false }), /order of beats changed: desk moved/);
});
