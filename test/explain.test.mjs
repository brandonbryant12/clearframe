// Visual explanation primitives: the formulas they draw, and the geometry that makes their pictures true.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FUNCTIONS, graphElements, accumulateElements, estimateElements, fieldElements } from '../film/explain.mjs';

const wide = { width: 1920, height: 1080 };

test('graph functions are the formulas they name, and refuse domains where they are not real', () => {
  assert.equal(FUNCTIONS.power({ a: 1, p: 2 })(-2), 4);
  const q = m => FUNCTIONS.queue({ measure: m })(0.5);
  assert.deepEqual([q('inSystem'), q('waiting'), q('time')], [1, 0.5, 2], 'M/M/1 at ρ = 0.5: L = 1, Lq = 0.5, W = 2 service times');
  assert.throws(() => graphElements({ fn: { kind: 'queue' }, x: { domain: [0, 1.2] } }, wide), /0 ≤ utilisation < 1/);
  assert.throws(() => graphElements({ fn: { kind: 'power', p: 0.5 }, x: { domain: [-1, 1] } }, wide), /not a finite real number/);
});

test('accumulated pieces tile the total column in order, and nothing stacks from a zero rate', () => {
  const els = accumulateElements({ rate: { kind: 'saturating', k: 3 }, x: { domain: [0, 1] }, steps: 8 }, wide);
  const pieces = els.find(e => e.type === 'group').children;
  const base = pieces[0].origin[1];
  // After scaling about its bottom-left corner and moving, each piece's bottom sits on the last one's top.
  let top = base;
  for (const p of pieces) {
    const [{ y, scaleY }] = p.keys;
    assert.ok(Math.abs(base + y - top) < 0.6, 'no gap or overlap between stacked pieces');
    top = base + y - p.h * scaleY;
  }
  const column = els.find(e => e.type === 'rect' && e.dash);
  assert.ok(Math.abs(top - (column.y + 6)) < 1.5, 'the stacked pieces fill the normalised column exactly');
  const none = accumulateElements({ rate: 0, x: { domain: [0, 1] } }, wide).find(e => e.type === 'group').children;
  assert.equal(none.length, 0);
});

test('a simulated estimate is the same every render, and its band is ±1 standard error', () => {
  const spec = { value: 0, spread: 1, count: 16, seed: 5 };
  assert.deepEqual(estimateElements(spec, wide), estimateElements(spec, wide));
  const band = estimateElements(spec, wide).find(e => e.type === 'poly').points;
  const line = estimateElements(spec, wide).find(e => e.type === 'path' && e.enter === 'wipe');
  const first = Number(line.d.split(' ')[2]), last = Number(line.d.split(' ').at(-1));
  const half = (i, n) => Math.abs(band[i][1] - band[2 * n - 1 - i][1]) / 2;
  assert.ok(Math.abs(half(0, 16) / half(15, 16) - 4) < 0.05, 'the band at n = 16 is a quarter of the band at n = 1 (σ/√n)');
  assert.ok(Number.isFinite(first) && Number.isFinite(last));
});

test('field arrows point the way the field pushes on a non-square box', () => {
  const box = [0, 0, 1600, 400];
  const arrows = fieldElements({ kind: 'saddle', box, particles: 6 }, wide).find(e => e.type === 'group').children;
  // A saddle (u, −v): at u, v > 0 the push is right and down, in screen terms right and down too.
  const a = arrows.find(e => e.x1 > 1000 && e.y1 < 150);
  assert.ok(a.x2 > a.x1 && a.y2 > a.y1);
  const drift = fieldElements({ kind: 'drift', box, particles: 6 }, wide).find(e => e.type === 'group').children;
  assert.ok(drift.every(e => Math.abs(e.y1 - e.y2) < 0.2 && e.x2 > e.x1), 'a uniform drift is horizontal');
});
