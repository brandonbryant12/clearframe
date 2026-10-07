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

test('objects stay inside the title-safe area, marks ride with their object, and the look carries', () => {
  const tall = { width: 1080, height: 1920 };
  const edge = { look: 'drawn', objects: [{ id: 'a', icon: 'file' }, { id: 'b', icon: 'mail' }, { id: 'c', icon: 'star' }],
    formations: [{ form: 'scatter', at: 0, center: [1000, 300] }, { form: 'cluster', ids: ['b', 'c'], beside: 'a', at: 1 }, { form: 'mark', mark: 'cross', ids: ['b'], at: 2 }, { form: 'exit', ids: ['b'], at: 3 }] };
  const carry = {}, els = expandCastProps({ cast: edge }, { ...tall, beatId: 'x', duration: 5 }, { carry }).elements;
  for (const id of ['a', 'b', 'c']) {
    const g = els.find(e => e.id === `x-cast-${id}`), keys = g.keys.filter(k => k.x != null && k.at < 3);
    const at = keys.length ? { x: g.x + keys.at(-1).x, y: g.y + keys.at(-1).y } : g;
    assert.ok(at.x >= 108 && at.x <= 972 && at.y >= 115 && at.y <= 1805, `${id} stays in the safe area (${at.x.toFixed(0)}, ${at.y.toFixed(0)})`);
  }
  const b = els.find(e => e.id === 'x-cast-b'), cross = b.children.find(c => c.type === 'path');
  assert.ok(cross && cross.rough && cross.exitAt == null, 'the cross is drawn by hand inside the object, and leaves with it');
  assert.ok(b.children.find(c => c.id.endsWith('-tile')).rough?.fill === 'hachure', 'the drawn look hatches the tile');
  assert.equal(carry.look, 'drawn');
  // Under a heading the cast keeps below it.
  const headed = expandCastProps({ title: 'Reports arrive', cast: { objects: [1, 2, 3, 4, 5, 6].map(i => ({ id: `o${i}`, icon: 'mail' })), formations: [{ form: 'scatter', at: 0 }, { form: 'ring', at: 1 }] } }, { ...tall, beatId: 'h', duration: 4 }, {}).elements;
  for (const g of headed.filter(e => e.type === 'group'))
    for (const y of [g.y, ...g.keys.filter(k => k.y != null).map(k => g.y + k.y)]) assert.ok(y - 0.58 * 162 >= 430, `${g.id} stays under the heading (${y.toFixed(0)})`);
  assert.throws(() => expandCastProps({ cast: { look: 'print', formations: [{ form: 'wave', at: 0 }] } }, { ...tall, beatId: 'y' }, { objects: carry.objects, state: carry.state, look: carry.look }), /look is set once/);
});

test('the camera holds the whole cast, stands on frame one, and carries its zoom across the cut', () => {
  const carry = {}, ctx = () => ({ state: carry.state, objects: carry.objects, threads: carry.threads, look: carry.look, camera: carry.camera, carry });
  const one = expandCastProps({ cast: { objects, formations: [{ form: 'hero', hero: 'b', at: 0 }, { form: 'camera', zoom: 1.2, on: 'b', at: 0.5 }] } }, { ...wide, beatId: 'p' }, ctx()).elements;
  assert.equal(one.length, 1); assert.equal(one[0].id, 'p-cast-stage'); assert.equal(one[0].enter, 'none');
  assert.equal(one[0].keys.at(-1).scale, 1.2);
  const two = expandCastProps({ cast: { formations: [{ form: 'wave', at: 0 }] } }, { ...wide, beatId: 'q' }, ctx()).elements;
  assert.deepEqual([two[0].keys[0].at, two[0].keys[0].scale, two[0].keys[0].dur], [0, 1.2, 0], 'the next beat starts where the camera stopped');
  const three = expandCastProps({ cast: { formations: [{ form: 'camera', zoom: 1, at: 0 }] } }, { ...wide, beatId: 'r' }, ctx()).elements;
  assert.equal(three[0].keys.at(-1).scale, 1);
  assert.ok(expandCastProps({ cast: { formations: [{ form: 'wave', at: 0 }] } }, { ...wide, beatId: 's' }, ctx()).elements.length > 1, 'back at rest, no stage is needed');
});

test('an object fills the frame and the next scene plays on its colour; it emerges back where it was', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { computeTiming } = await import('../engine/lib/timing.mjs');
  const { loadStoryboard } = await import('../engine/lib/project.mjs');
  const { createJob } = await import('../film/job.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fill-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Fill', format: { preset: 'landscape' }, theme: 'paper', transition: 'fade',
    beats: [{ id: 'one', block: 'canvas', vo: 'One piece becomes the whole screen.', props: { cast: { objects: [...objects, { id: 'd', icon: 'chart-bar', color: 'accent2' }],
      formations: [{ form: 'hero', hero: 'd', at: 0 }, { form: 'fill', ids: ['d'], say: 'whole' }] } } },
    { id: 'mid', block: 'statement', vo: 'This is the moment.', props: { text: 'The moment' } },
    { id: 'two', block: 'canvas', vo: 'And then it goes back.', props: { cast: { formations: [{ form: 'emerge', ids: ['d'], at: 0 }] } } }] }));
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  assert.deepEqual(errors, []);
  const [one, mid, two] = job.beats;
  assert.equal(mid.tone, 'accent2', 'the scene after the fill takes the object’s colour as its tone');
  assert.deepEqual([one.exit, mid.transition, mid.exit, two.transition], ['none', 'cut', 'none', 'cut'], 'cuts on one colour, both ways');
  const d = (els, id) => { for (const e of els) { if (e.id === id) return e; const c = e.children && d(e.children, id); if (c) return c; } };
  const grown = d(one.props.elements, 'one-cast-d'), back = d(two.props.elements, 'two-cast-d');
  assert.ok(grown.keys.at(-1).scale > 10, 'it grows past the frame');
  assert.equal(back.keys[0].scale, grown.keys.at(-1).scale, 'and comes back from exactly there');
  assert.equal(back.keys.at(-1).scale, 2.3, 'to the pose it had before');
  const icon = back.children.find(c => c.type === 'icon');
  assert.deepEqual([icon.keys[0].opacity, icon.keys.at(-1).opacity, icon.opacity], [0, 1, undefined], 'its face returns by keys, never a base opacity');
  assert.throws(() => expandCastProps({ cast: { objects, formations: [{ form: 'fill', ids: ['a'], at: 0 }, { form: 'wave', at: 1 }] } }, { ...wide, beatId: 'z' }, {}), /fill is the last move/);
  assert.throws(() => expandCastProps({ cast: { objects: [{ id: 'g', icon: 'file', color: 'positive' }], formations: [{ form: 'fill', ids: ['g'], at: 0 }] } }, { ...wide, beatId: 'z' }, {}), /accent, accent2, surface or ink/);
});

test('a cast names only objects it declared', () => {
  assert.throws(() => film([{ objects, formations: [{ form: 'hero', hero: 'z', at: 0 }] }]), /hero/);
  assert.throws(() => film([{ objects, formations: [{ form: 'line', ids: ['a'], by: ['b'], at: 0 }] }]), /by lists/);
});
