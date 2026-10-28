import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cell,
  pairedWarmStill,
  summarize,
} from '../scripts/engine-bench-summary.mjs';

const row = (measure, run, ms, extra = {}) => ({
  project: 'p',
  engine: 'scene',
  measure,
  run,
  ms,
  peakBytes: 100 * 2 ** 20,
  diskBytes: 2 ** 20,
  width: 1920,
  height: 1080,
  fps: 30,
  frames: measure === 'full' ? 300 : measure === 'range' ? 60 : undefined,
  ...extra,
});

test('the warm still pairs runs by index instead of mixing the fastest of each', () => {
  // Independently chosen minima take cold 900 from run 1 and ten 1450 from run 2:
  // (1450 - 900) / 9 = 61, a cost no run produced. Each run's own pair gives 101 and 50.
  const cold = [row('cold', 1, 900), row('cold', 2, 1000)];
  const ten = [row('ten', 1, 1810), row('ten', 2, 1450)];
  const mixed = Math.round(
    (Math.min(...ten.map((r) => r.ms)) - Math.min(...cold.map((r) => r.ms))) /
      9,
  );
  assert.equal(mixed, 61);
  const warm = pairedWarmStill(cold, ten);
  assert.equal(warm.status, 'measured');
  assert.deepEqual(
    warm.pairs.map((p) => p.ms),
    [101, 50],
  );
  assert.equal(warm.median, 76);
  assert.equal(warm.min, 50);
  assert.equal(warm.max, 101);
});

test('a non-positive pair makes the warm still inconclusive, never faster than free', () => {
  const warm = pairedWarmStill(
    [row('cold', 1, 1000), row('cold', 2, 1000)],
    [row('ten', 1, 1900), row('ten', 2, 990)],
  );
  assert.equal(warm.status, 'inconclusive');
  assert.equal(warm.median, null);
  assert.equal(cell(warm), 'inconclusive (-1–100)');
  assert.equal(pairedWarmStill([row('cold', 1, 1)], []).status, 'unpaired');
});

test('failed runs stay counted and out of the medians', () => {
  const rows = [
    row('cold', 1, 1000),
    row('cold', 2, 1100),
    row('ten', 1, 1900),
    row('ten', 2, null, { error: 'exited 1' }),
    row('range', 1, 500),
    row('range', 2, 700),
    row('full', 1, 9000),
    row('full', 2, 11000),
    row('full', 3, null, { error: 'exited 1' }),
  ];
  const [s] = summarize(rows);
  assert.deepEqual(s.runs, { cold: 2, ten: 2, range: 2, full: 3 });
  assert.deepEqual(s.failures, { cold: 0, ten: 1, range: 0, full: 1 });
  assert.deepEqual(s.fullMs, { median: 10000, min: 9000, max: 11000, n: 2 });
  assert.equal(s.fullFps, 30);
  // Only run 1 has both measures: one pair, not a mix of run 1 and run 2.
  assert.deepEqual(
    s.warmStillMs.pairs.map((p) => p.run),
    [1],
  );
  assert.equal(s.warmStillMs.median, 100);
  assert.match(s.scope, /not time to an accepted film/);
  assert.equal(cell(s.fullMs), '10000 (9000–11000)');
  assert.equal(cell(null), '—');
});
