import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBarFixture, comparePixels } from '../engine/lib/library-bar.mjs';

test('prop sensitivity distinguishes unchanged output from a localized visual change', () => {
  const base = Buffer.from([0, 0, 0, 255, 255, 255]);
  assert.equal(comparePixels(base, Buffer.from(base)).changedFraction, 0);
  assert.equal(comparePixels(base, Buffer.from(base)).psnr, Infinity);
  const changed = comparePixels(base, Buffer.from([8, 0, 0, 255, 255, 255]));
  assert.equal(changed.changedPixels, 1);
  assert.equal(changed.changedFraction, 0.5);
  assert.ok(Number.isFinite(changed.psnr));
  assert.equal(comparePixels(base, Buffer.from([2, 0, 0, 255, 255, 255])).changedPixels, 0, 'three-level tolerance ignores tiny channel noise');
  assert.throws(() => comparePixels(base, Buffer.alloc(3)), /equally sized/);
});

test('the library bar bounds render variants and rejects invalid sensitivity references', () => {
  const fixture = { name: 'sample', cases: [{ id: 'base', storyboard: {} }, { id: 'changed', storyboard: 'variant.json', at: [0.5, 2] }],
    sensitivities: [{ id: 'amount', base: 'base', changed: 'changed', at: 1, minChangedFraction: 0.001 }],
    refusals: [{ id: 'bad-total', storyboard: {}, match: 'must add up' }] };
  assert.equal(validateBarFixture(fixture), fixture);
  assert.throws(() => validateBarFixture({ ...fixture, cases: Array.from({ length: 13 }, (_, i) => ({ id: `case-${i}`, storyboard: {} })) }), /1–12/);
  assert.throws(() => validateBarFixture({ ...fixture, sensitivities: [{ id: 'amount', base: 'base', changed: 'missing', at: 1 }] }), /two distinct case ids/);
  assert.throws(() => validateBarFixture({ ...fixture, refusals: {} }), /24 named refusals/);
  assert.throws(() => validateBarFixture({ ...fixture, cases: [{ id: '../escape', storyboard: {} }] }), /unique lowercase/);
});
