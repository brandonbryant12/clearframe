// Camera rects addressed to what is drawn: exact boxes, the frame's aspect, explicit states, refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { targetRect, targetSpec } from '../film/target.mjs';
import { createJob } from '../film/production.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const frame = { width: 1920, height: 1080 };
const els = [
  { id: 'card', type: 'rect', x: 800, y: 400, w: 400, h: 100 },
  { id: 'row', type: 'group', x: 100, y: 50, children: [{ type: 'rect', x: 0, y: 0, w: 300, h: 60 }, { type: 'text', text: 'Alex', x: 10, y: 40 }, { type: 'circle', cx: 320, cy: 30, r: 20 }] },
  { id: 'label', type: 'text', text: 'A word', x: 10, y: 10 },
  { id: 'slide', type: 'rect', x: 0, y: 900, w: 100, h: 100, keys: [{ at: 1, x: 600 }] },
  { id: 'turned', type: 'rect', x: 0, y: 0, w: 10, h: 10, rotate: 20 },
];
const rect = (on, extra = {}) => targetRect(targetSpec({ on, ...extra }, 'view'), els, frame);

test('a target is its exact box, padded and widened to the frame, never closer than four times', () => {
  const [x, y, w, h] = rect('card', { pad: 0 });
  assert.ok(Math.abs(w / h - 16 / 9) < 1e-3, 'the frame’s aspect');
  assert.ok(Math.abs(x + w / 2 - 1000) < 0.01 && Math.abs(y + h / 2 - 450) < 0.01, 'centred on the card');
  assert.ok(w >= 400 && h >= 100 && Math.abs(w - 1920 / 4) < 0.01, 'a small card is not magnified past 4×');
  // A group's box comes from its shapes (its text is inside them), at its offset.
  const [gx, gy, gw, gh] = rect('row', { pad: 0 });
  assert.ok(gx <= 100 && gx + gw >= 440 && gy <= 50 && gy + gh >= 110);
  const both = rect(['card', 'row'], { pad: 0.1 });
  assert.ok(both[0] < 100 && both[0] + both[2] > 1200, 'several ids frame their union');
});

test('text, unknown ids, turned elements and unstated motion are refused by name', () => {
  assert.throws(() => rect('label'), /label is text, which has no measured box before rendering; frame the card, row or group it sits in/);
  assert.throws(() => rect('ghost'), /names "ghost", which no element/);
  assert.throws(() => rect('turned'), /turned is turned; its box on screen is not its authored box/);
  assert.throws(() => rect('slide'), /moves \(keys or a route\); say which state to frame/);
  const start = rect('slide', { state: 'start', pad: 0 }), end = rect('slide', { state: 'end', pad: 0 });
  assert.ok(Math.abs((end[0] + end[2] / 2) - (start[0] + start[2] / 2) - 600) < 0.01, 'state end follows the keys');
  assert.throws(() => targetSpec({ on: 'card', zoom: 2 }, 'view'), /unsupported field zoom/);
});

function film(t, beats) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-target-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), { version: 2, title: 'Target', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false, beats });
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}

test('view, reveal and camera.to resolve in the job; a world beat frames what its world drew', t => {
  const drawing = [{ id: 'page', type: 'rect', x: 200, y: 200, w: 1500, h: 700, fill: 'surface', at: 0, enter: 'none' },
    { id: 'clause', type: 'rect', x: 1200, y: 600, w: 360, h: 120, fill: 'wash', at: 0, enter: 'none' }];
  const { job, errors } = film(t, [
    { id: 'push', block: 'canvas', vo: 'This clause is the one that matters.', props: { view: { on: 'clause' }, elements: drawing } },
    { id: 'pull', block: 'canvas', hold: 2.5, vo: 'Now see the whole page around it.', props: { reveal: { from: 'clause-2', say: 'whole' }, elements: drawing.map(e => ({ ...e, id: `${e.id}-2` })).map(e => e.id === 'clause-2' ? { ...e } : e) } },
    { id: 'w1', block: 'canvas', vo: 'A world drawn once.', props: { world: 'w', view: [0, 0, 1920, 1080], elements: [{ id: 'far', type: 'rect', x: 3000, y: 300, w: 200, h: 120, fill: 'accent', at: 0, enter: 'none' }] } },
    { id: 'w2', block: 'canvas', vo: 'And a stop framed on it.', props: { world: 'w', view: { on: 'far' }, elements: [] } },
    { id: 'cam', block: 'canvas', vo: 'Push in on the card.', camera: { to: { on: 'tile' }, say: 'card' }, props: { elements: [{ id: 'tile', type: 'rect', x: 900, y: 500, w: 300, h: 160, fill: 'accent', at: 0, enter: 'none' }] } },
  ]);
  assert.deepEqual(errors, []);
  const [push, pull, , w2, cam] = job.beats;
  assert.ok(Array.isArray(push.props.view) && Math.abs(push.props.view[0] + push.props.view[2] / 2 - 1380) < 0.01);
  assert.ok(Array.isArray(pull.props.viewFrom) && pull.props.view[2] === 1920, 'reveal opens on the detail and ends on the whole frame');
  assert.ok(pull.props.viewAt > 0.5, 'and pulls back on its word');
  assert.ok(Math.abs(w2.props.view[0] + w2.props.view[2] / 2 - 3100) < 0.01, 'a world stop on an element an earlier beat drew');
  assert.ok(Array.isArray(cam.camera.to) && Math.abs(cam.camera.to[0] + cam.camera.to[2] / 2 - 1050) < 0.01);
  const bad = film(t, [{ id: 'a', block: 'canvas', vo: 'Frame a word.', props: { view: { on: 'w' }, elements: [{ id: 'w', type: 'text', text: 'Word', x: 100, y: 100 }] } }]);
  assert.match(bad.errors.join('\n'), /w is text, which has no measured box/);
});

test('keyed scales combine as the native pose does; turns, loops, depth and unprovable group children are refused', () => {
  const list = [
    { id: 'grow', type: 'rect', x: 100, y: 100, w: 100, h: 100, keys: [{ at: 1, scale: 2 }, { at: 2, scaleX: 1.5 }] },
    { id: 'flip', type: 'rect', x: 100, y: 100, w: 100, h: 100, keys: [{ at: 1, scaleX: -1 }] },
    { id: 'spin', type: 'rect', x: 0, y: 0, w: 10, h: 10, loop: { type: 'pulse', period: 1 } },
    { id: 'deep', type: 'rect', x: 0, y: 0, w: 10, h: 10, depth: 0.5 },
    { id: 'tilting', type: 'rect', x: 0, y: 0, w: 10, h: 10, keys: [{ at: 1, tiltY: 20 }] },
    { id: 'card', type: 'group', children: [{ type: 'rect', x: 0, y: 0, w: 200, h: 80 }, { id: 'tick', type: 'path', d: 'M 0 0 C 100 0 300 200 300 300' }] },
    { id: 'torn', type: 'group', children: [{ type: 'path', d: 'M 0 0 L 480 0 L 480 285 L 458 298 L 436 285 Z' }] },
    { id: 'card2', type: 'group', children: [{ type: 'rect', x: 0, y: 0, w: 200, h: 80 }, { id: 'badge', type: 'rect', x: 180, y: -10, w: 30, h: 30, rotate: 45 }] },
  ];
  const at = (on, extra = {}) => targetRect(targetSpec({ on, pad: 0, ...extra }, 'view'), list, { width: 1920, height: 1080, maxZoom: 100 });
  // scale 2 × scaleX 1.5 about the centre (150, 150): 300 × 200, as canvas.rs multiplies them.
  const g = at('grow', { state: 'end' });
  // The 300 × 200 box, widened to 16:9 around its centre: 355.56 × 200.
  assert.ok(Math.abs(g[3] - 200) < 0.01 && Math.abs(g[2] - 200 * 16 / 9) < 0.01 && Math.abs(g[0] + g[2] / 2 - 150) < 0.01, `combined scale ${JSON.stringify(g)}`);
  const f = at('flip', { state: 'end' });
  assert.ok(f[2] > 0 && Math.abs(f[0] + f[2] / 2 - 150) < 1e-6, 'a mirrored box keeps positive bounds');
  assert.throws(() => at('spin'), /moves in a pulse loop/);
  assert.throws(() => at('deep'), /is placed in depth/);
  assert.throws(() => at('tilting', { state: 'end' }), /turns or tilts in its keys/);
  assert.throws(() => at('card'), /tick is curved; its exact box is not known here/);
  const torn = at('torn');
  assert.ok(torn[0] <= 0 && torn[0] + torn[2] >= 480 && torn[1] <= 0 && torn[1] + torn[3] >= 298, 'a straight-segment path is the box of its vertices');
  assert.throws(() => at('card2'), /child badge is turned, so the group's drawn box cannot be proved/);
});

test('straight path data is read whole: exponents, signs and decimals, or a refusal, never part of it', () => {
  const frame1 = { width: 1920, height: 1080, maxZoom: 100 };
  const box = d => targetRect(targetSpec({ on: 'p', pad: 0 }, 'view'), [{ id: 'g', type: 'group', children: [{ type: 'rect', x: 0, y: 0, w: 1, h: 1 }, { id: 'p', type: 'path', d }] }].map(g => g.children[1]).map(c => ({ ...c, id: 'p' })), frame1);
  const plain = box('M 0 0 L 1000 0 L 1000 250 Z'), sci = box('M0,0 L1e3,0 L1E3,2.5e2 z'), rel = box('m 0 0 h 1000 v 250 h -1000 z');
  assert.deepEqual(sci, plain, 'exponent notation gives the same box as decimals');
  assert.deepEqual(rel, plain, 'relative commands give the same box');
  assert.ok(box('M -5e2 0 L 5e+2 0 L 0 +250')[2] >= 1000);
  assert.throws(() => box('M 0 0 L 1000 0 X 5 5'), /cannot be read exactly at "X 5 5"/);
  assert.throws(() => box('M 0 0 L 1000'), /L without its numbers/);
});

test('a structured picture keeps an authored view: a decision framed on one of its outcomes', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-target-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const decision = { id: 'claim', title: 'Which route', ask: [{ id: 'amount', label: 'Over $500?' }], tree: { ask: 'amount', yes: 'manager', no: 'auto' },
    outcomes: [{ id: 'manager', label: 'Manager approves' }, { id: 'auto', label: 'Approved automatically' }], cases: [{ label: 'A $120 taxi', answers: { amount: 'no' }, at: 0.5 }] };
  writeJSON(path.join(dir, 'storyboard.json'), { version: 2, title: 'Target', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false,
    sources: [{ id: 'r', title: 'Example rule' }],
    beats: [{ id: 'a', block: 'canvas', duration: 5, props: { view: { on: 'dc-claim-out-auto', pad: 0.4 }, decision } }] });
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  assert.deepEqual(errors, []);
  const [x, , w] = job.beats[0].props.view, out = job.beats[0].props.elements.find(e => e.id === 'dc-claim-out-auto');
  assert.ok(Math.abs(x + w / 2 - (out.x + out.w / 2)) < 0.01 && w < 1920, 'the authored target view is kept, not replaced by the full frame');
});
