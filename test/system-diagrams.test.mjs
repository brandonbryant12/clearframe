// System diagrams: identities over time, layout and routing, and the steady camera they sit in.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeProps } from '../film/catalog.mjs';
import { diagramElements } from '../film/system-diagrams.mjs';
import { sketch, sketchByName } from '../film/sketches.mjs';
import { normalizeElements } from '../film/canvas.mjs';
import { applyTreatment } from '../film/treatments.mjs';
import { storyboardFor } from '../film/playbooks.mjs';
import { createJob } from '../film/production.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const exact = v => v; // numeric cues, resolved as the job resolves them
const compile = (d, w = 1920, h = 1080) => diagramElements(d, { width: w, height: h, resolve: exact });
const byId = (els, id) => els.find(e => e.id === id);
const job = (t, sb) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-diagram-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
};
const film = beats => ({ ...structuredClone(storyboardFor('concept-explainer')), beats });

test('a diagram compiles to native shapes in every frame shape, with stable ids placed by translation', () => {
  const diagram = { nodes: [{ id: 'user', kind: 'user', label: 'User' }, { id: 'db', kind: 'database', label: 'Store' }], edges: [{ from: 'user', to: 'db' }] };
  for (const [width, height] of [[1920, 1080], [1080, 1920], [1080, 1080], [1080, 1350]]) {
    const props = normalizeProps('canvas', { diagram }, { width, height });
    assert.equal(props.diagram, undefined);
    const node = byId(props.elements, 'diagram-node-db');
    // Children are drawn around (0, 0) and the group carries the position, so a shared id slides.
    assert(Number.isFinite(node.x) && Number.isFinite(node.y));
    assert(node.children.some(e => e.type === 'ellipse' && e.cx === 0));
    assert(byId(props.elements, 'diagram-edge-user-db').arrow === 'end');
    assert.deepEqual(diagramElements(diagram, { width, height }), diagramElements(diagram, { width, height }));
  }
});

test('steps change one cast over time: replace keeps the slot, removal marks then clears connectors, new wiring reads as added', () => {
  const els = compile({
    nodes: [{ id: 'client', label: 'Client', kind: 'user' }, { id: 'old', label: 'Old worker' }, { id: 'queue', label: 'Queue', kind: 'queue' }],
    edges: [{ from: 'client', to: 'old' }, { from: 'client', to: 'queue' }],
    steps: [{ at: 1.5, send: ['client', 'old'], label: 'job' }, { at: 2.5, replace: 'old', with: 'queue' }],
  });
  const old = byId(els, 'diagram-node-old'), queue = byId(els, 'diagram-node-queue');
  assert.deepEqual([queue.x, queue.y], [old.x, old.y], 'the replacement takes the old place');
  assert.equal(old.exitAt, 3.3);
  assert.equal(queue.at, 3.3);
  assert(old.children.some(c => c.type === 'group' && c.at === 2.5), 'the old component is marked before it goes');
  const gone = byId(els, 'diagram-edge-client-old');
  assert.equal(gone.exitAt, 3.3, 'its connector leaves with it');
  assert(els.some(e => e.type === 'path' && e.d === gone.d && e.stroke === 'negative' && e.at === 2.5), 'and is marked with it');
  assert.equal(byId(els, 'diagram-edge-client-queue').stroke, 'positive');
  assert(byId(els, 'diagram-edge-client-queue').at >= queue.at + 0.3, 'a connector waits for both ends');
  const token = els.find(e => e.along && e.type === 'circle');
  assert.equal(token.along.at, 1.5);
  assert(old.children.some(c => c.type === 'rect' && c.stroke === 'accent' && Math.abs(c.at - 2.2) < 0.01), 'arrival pulses the component');
});

test('timing mistakes fail with the reason instead of rendering a dangling or early picture', () => {
  const nodes = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', at: 2 }];
  assert.throws(() => compile({ nodes, edges: [{ from: 'a', to: 'b', at: 0.5 }] }), /before both a and b/);
  assert.throws(() => compile({ nodes, edges: [{ from: 'a', to: 'b' }], steps: [{ at: 1, send: ['a', 'b'] }] }), /not on screen/);
  assert.throws(() => compile({ nodes: [{ id: 'a', label: 'A', exitAt: 3 }, nodes[1]], edges: [{ from: 'a', to: 'b', exitAt: 4 }] }), /dangle/);
  assert.throws(() => compile({ nodes, steps: [{ at: 1, send: ['a', 'b'] }] }), /no connection/);
  assert.throws(() => compile({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B', replaces: 'a' }] }), /must leave first/);
  assert.throws(() => compile({ nodes: [{ id: 'a', label: 'A long component name here' }, ...Array.from({ length: 4 }, (_, i) => ({ id: `n${i}`, label: 'N' }))], edges: [{ from: 'a', to: 'n0' }, { from: 'n0', to: 'n1' }, { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' }] }), /cannot be read/);
});

test('routing: two-way pairs take separate runs, a connector detours around a component, self-transitions loop', () => {
  const els = compile({
    nodes: ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase() })),
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c', label: 'skip' }, { from: 'c', to: 'c', label: 'poll' }],
  });
  const [ab, ba] = ['a-b', 'b-a'].map(id => byId(els, `diagram-edge-${id}`).d);
  assert.notEqual(ab, ba);
  const y = d => d.match(/^M [\d.]+ ([\d.]+)/)[1];
  assert.notEqual(y(ab), y(ba), 'two-way connectors leave from different ports');
  const skip = byId(els, 'diagram-edge-a-c').d, b = byId(els, 'diagram-node-b');
  const ys = [...skip.matchAll(/[LM] [\d.]+ ([\d.]+)/g)].map(m => Number(m[1]));
  assert(Math.min(...ys) < b.y - 50 || Math.max(...ys) > b.y + 50, 'the skip connector leaves the row to pass B');
  assert.match(byId(els, 'diagram-edge-c-c').d, / C /);
});

test('starter sketches compile with exact timing in every aspect, and print their editable diagram', () => {
  for (const name of ['architecture', 'state-machine', 'component-change']) {
    assert(sketchByName(name).diagram, `${name} exposes its diagram source`);
    for (const [w, h] of [[1920, 1080], [1080, 1920], [1080, 1080], [1080, 1350]]) compile(sketchByName(name).diagram, w, h);
    for (const shape of ['landscape', 'vertical']) assert(normalizeElements(sketch(name, shape).elements, name, m => { throw new Error(m); }).length);
  }
  const sb = storyboardFor('pr-walkthrough');
  assert(sb.beats.every(b => b.props.diagram && !b.props.elements), 'the playbook keeps diagrams declarative');
  assert.equal(storyboardFor('pr-walkthrough', { vertical: true }).beats[0].props.view, undefined);
});

test('a node shared by consecutive diagram beats is on screen across the cut and slides to its new place', t => {
  const nodes = [{ id: 'api', label: 'API' }, { id: 'db', label: 'Database', kind: 'database' }];
  const sb = film([
    { id: 'a', block: 'canvas', duration: 4, props: { diagram: { nodes, edges: [{ from: 'api', to: 'db' }] } } },
    { id: 'b', block: 'canvas', duration: 5, props: { diagram: { nodes: [nodes[0], { id: 'cache', label: 'Cache', kind: 'database' }, nodes[1]], edges: [{ from: 'api', to: 'cache' }, { from: 'api', to: 'db' }], steps: [{ at: 1, set: { db: 'active' } }] } } },
  ]);
  const r = job(t, sb);
  assert.deepEqual(r.errors, []);
  const db = byId(r.job.beats[1].props.elements, 'diagram-node-db');
  assert(db.morph, 'db morphs from the previous beat');
  assert.notEqual(db.morph.from.y, db.y, 'and slides to its new place');
  const base = db.children.filter(c => c.type !== 'group');
  assert(base.every(c => c.at === 0), 'its drawing does not re-enter after the cut');
  assert(db.children.some(c => c.type === 'group' && c.at === 1), 'later changes keep their own time');
  assert.deepEqual(r.job.beats[1].camera, { move: 'none' });
});

test('steady films: the film camera applies to every beat, plates hold still, and stacked motion is called out', t => {
  const sb = film([
    { id: 'a', block: 'statement', duration: 3, props: { text: 'Steady' } },
    { id: 'b', block: 'statement', duration: 3, camera: 'in', props: { text: 'Asked for' } },
  ]);
  applyTreatment(sb, 'business');
  assert.equal(sb.camera, 'none');
  sb.beats.push({ id: 'later', block: 'statement', duration: 3, plate: { file: 'clip.mp4', side: 'right' }, props: { text: 'Added after new' } });
  let r = job(t, sb);
  assert.deepEqual(r.job.beats.map(b => b.camera?.move), ['none', 'in', 'none']);
  assert.equal(r.job.beats[2].plate.drift, 'none');
  assert(!r.warnings.some(w => /shake|whole frame/.test(w)));
  const loose = film([{ id: 'f', block: 'statement', duration: 3, lens: { handheld: 0.3 }, plate: { file: 'clip.mp4' }, props: { text: 'Shaky' } }]);
  r = job(t, loose);
  assert(r.warnings.some(w => /footage carries its own camera motion/.test(w)));
  const stacked = film([{ id: 'g', block: 'statement', duration: 3, camera: 'left', lens: { handheld: 0.2 }, props: { text: 'Busy' } }]);
  assert(job(t, stacked).warnings.some(w => /move the whole frame at once/.test(w)));
});
