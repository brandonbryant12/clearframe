// A cast carries the same objects across cuts: each beat starts exactly where the last one left them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { expandCastProps } from '../film/cast.mjs';

const wide = { width: 1920, height: 1080 };
const objects = [{ id: 'a', icon: 'file' }, { id: 'b', icon: 'chart-bar', color: 'accent2' }, { id: 'c', icon: 'photo', enter: 'none' }];
// Where a group stands once its keys have run: the base plus the last offsets, scale and opacity.
const end = g => g.keys.reduce((p, k) => ({ x: g.x + (k.x ?? p.x - g.x), y: g.y + (k.y ?? p.y - g.y), scale: k.scale ?? p.scale, opacity: k.opacity ?? p.opacity }), { x: g.x, y: g.y, scale: 1, opacity: 1 });
const film = beats => {
  const carry = {};
  return beats.map((cast, i) => expandCastProps({ cast }, { ...wide, beatId: `b${i}` }, { state: carry.state, objects: carry.objects, threads: carry.threads, cue: v => (typeof v === 'number' ? v : 1), carry }).elements);
};
const group = (els, beat, id) => els.find(e => e.id === `b${beat}-cast-${id}`);

test('each beat starts every object where the last beat left it, without compounding opacity', () => {
  const [one, two] = film([{ objects, formations: [{ form: 'scatter', at: 0 }, { form: 'hero', hero: 'b', at: 1 }] }, { formations: [{ form: 'line', ids: ['a', 'b', 'c'], at: 0.5, thread: true }] }]);
  for (const id of ['a', 'b', 'c']) {
    const was = end(group(one, 0, id)), now = group(two, 1, id);
    assert.ok(Math.abs(now.x - was.x) < 1e-6 && Math.abs(now.y - was.y) < 1e-6, `${id} keeps its place across the cut`);
    assert.equal(now.keys[0].at, 0); assert.equal(now.keys[0].scale, was.scale); assert.equal(now.keys[0].opacity, was.opacity, `${id} keeps its scale and opacity as absolute keys`);
    assert.equal(end(now).opacity, 1, `${id} is fully back in the line`);
  }
  assert.equal(group(one, 0, 'c').enter, 'none', 'an object can stand on frame one');
  assert.equal(two.filter(e => e.type === 'line').length, 2, 'the line is threaded');
});

test('objects no formation names are still drawn; a swap hands one pose to another, its cause drawn on top', () => {
  const beats = film([
    { objects, formations: [{ form: 'hero', hero: 'b', at: 0 }] },
    { objects: [{ id: 'note', icon: 'pencil', color: 'surface' }, { id: 'd', icon: 'chart-line', color: 'positive' }],
      formations: [{ form: 'cluster', ids: ['note'], beside: 'b', at: 0.2 }, { form: 'swap', out: 'b', in: 'd', by: ['note'], at: 2 }] },
    { formations: [{ form: 'wave', ids: ['d'], at: 0.5 }] },
  ]);
  const [, two, three] = beats;
  assert.ok(group(two, 1, 'a') && group(two, 1, 'c'), 'the quiet ring is still on screen while the note acts');
  const b = end(group(two, 1, 'b')), d = end(group(two, 1, 'd'));
  assert.equal(b.opacity, 0); assert.ok(Math.abs(d.x - b.x) < 1e-6 && Math.abs(d.y - b.y) < 1e-6, 'the new object stands where the old one was');
  const order = two.filter(e => e.type === 'group').map(e => e.id);
  assert.ok(order.indexOf('b1-cast-note') > order.indexOf('b1-cast-d'), 'what causes the change is drawn over it');
  const order3 = three.filter(e => e.type === 'group').map(e => e.id);
  assert.ok(order3.indexOf('b2-cast-note') > order3.indexOf('b2-cast-d'), 'and keeps that depth across the cut');
  assert.ok(!group(three, 2, 'b'), 'a swapped-out object stays gone');
});

test('consecutive cast beats cut without moving the picture under the objects', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { computeTiming } = await import('../engine/lib/timing.mjs');
  const { loadStoryboard } = await import('../engine/lib/project.mjs');
  const { createJob } = await import('../film/job.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-cast-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Cast', format: { preset: 'landscape' }, theme: 'paper', transition: 'fade',
    beats: [{ id: 'pile', block: 'canvas', vo: 'A pile of material.', props: { cast: { objects, formations: [{ form: 'scatter', at: 0 }] } } },
      { id: 'order', block: 'canvas', vo: 'So it falls into line.', props: { cast: { formations: [{ form: 'line', say: 'line' }] } } }] }));
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  assert.deepEqual(errors, []);
  const [pile, order] = job.beats;
  assert.equal(order.transition, 'cut'); assert.equal(pile.exit, 'none');
  assert.deepEqual([pile.camera, order.camera], [{ move: 'none' }, { move: 'none' }]);
  assert.ok(order.props.elements.some(e => e.id === 'order-cast-a'), 'the carried objects are in the second beat');
});

test('a thread never appears before the pieces it joins; too late in the beat, it is left out with a note', () => {
  const lineUp = at => ({ cast: { objects, formations: [{ form: 'scatter', at: 0 }, { form: 'line', ids: ['a', 'b', 'c'], at, stagger: 0.2, thread: true }] } });
  const run = (at, duration) => { const notes = [], carry = {}; return { els: expandCastProps(lineUp(at), { ...wide, beatId: 'x', duration }, { notes, carry }).elements, notes, carry }; };
  const early = run(1, 6), lines = early.els.filter(e => e.type === 'line');
  assert.equal(lines.length, 2);
  lines.forEach((l, j) => assert.ok(l.at >= 1 + (j + 1) * 0.2 + 1.1 - 1e-9, `segment ${j + 1} draws after its far end arrives (${l.at})`));
  assert.equal(early.carry.threads.length, 2, 'a settled thread carries into the next beat');
  const late = run(4.6, 6);
  assert.equal(late.els.filter(e => e.type === 'line').length, 0, 'no connector shows before the line has formed');
  assert.match(late.notes[0], /^x: the thread of formation 2 \(line\) would finish .* after the beat ends/);
  assert.equal(late.carry.threads.length, 0, 'and none appears after the cut either');
});

test('a cast names only objects it declared', () => {
  assert.throws(() => film([{ objects, formations: [{ form: 'hero', hero: 'z', at: 0 }] }]), /hero/);
  assert.throws(() => film([{ objects, formations: [{ form: 'line', ids: ['a'], by: ['b'], at: 0 }] }]), /by lists/);
});
