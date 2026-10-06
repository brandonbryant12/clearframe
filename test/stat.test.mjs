import test from 'node:test';
import assert from 'node:assert/strict';
import { statSpec, expandStatProps } from '../film/stat.mjs';

const base = { kicker: 'Inflation', value: 3.1, decimals: 1, suffix: '%', label: 'Consumer prices, last twelve months',
  change: { value: -0.6, suffix: ' pts', context: 'vs a year earlier', good: 'down' }, asOf: '2026-10-04', source: 'Illustrative data' };
const frame = { width: 1920, height: 1080, beatId: 'b', duration: 6 };
const named = (p, id) => p.elements.find(e => e.id === `b-${id}`);

test('a headline figure counts up to its exact value and colours change by meaning', () => {
  const p = expandStatProps({ stat: base }, frame);
  const v = named(p, 'stat-value');
  assert.equal(v.text, '3.1%');
  assert.deepEqual({ to: v.count.to, decimals: v.count.decimals, suffix: v.count.suffix }, { to: 3.1, decimals: 1, suffix: '%' });
  assert.equal(named(p, 'stat-change').fill, 'positive', 'a fall is good news when good is down');
  assert.match(named(p, 'stat-change').text, /−0\.6 pts vs a year earlier/);
  const up = expandStatProps({ stat: { ...base, change: { ...base.change, value: 0.4 } } }, frame);
  assert.equal(named(up, 'stat-change').fill, 'negative');
  const money = expandStatProps({ stat: { ...base, value: 87500, decimals: 0, prefix: '$', suffix: '', change: undefined, count: false } }, frame);
  assert.equal(named(money, 'stat-value').text, '$87,500');
  assert.equal(named(money, 'stat-value').count, undefined);
  assert.match(p.source, /Illustrative data · 2026-10-04/);
});

test('a stat needs a label, a source and room to settle', () => {
  for (const bad of [{ ...base, label: '' }, { ...base, value: NaN }, { ...base, decimals: 4 }, { ...base, change: { value: 1 } }, { ...base, change: { ...base.change, good: 'sideways' } }, { ...base, extra: 1 }])
    assert.throws(() => statSpec(bad));
  assert.throws(() => statSpec({ ...base, source: undefined }));
  assert.throws(() => expandStatProps({ stat: base }, { ...frame, duration: 3 }), /two seconds/);
});
