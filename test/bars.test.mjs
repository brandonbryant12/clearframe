import test from 'node:test';
import assert from 'node:assert/strict';
import { barsSpec, expandBarsProps } from '../fframes/bars.mjs';

const base = { title: 'Annual returns', unit: 'Total return', asOf: '2026-10-04', source: 'Illustrative data',
  values: [{ label: '2023', value: 26 }, { label: '2024', value: -18 }, { label: '2025', value: 12 }],
  domain: [-20, 40], ticks: [-20, 0, 20, 40], suffix: '%' };
const frame = { width: 1920, height: 1080, beatId: 'b', duration: 6 };
const named = (p, id) => p.elements.find(e => e.id === `b-${id}`);

test('bars grow from an honest zero baseline with signed colours', () => {
  const p = expandBarsProps({ bars: base }, frame);
  const zero = named(p, 'bars-grid-1').y1, up = named(p, 'bars-bar-0'), down = named(p, 'bars-bar-1');
  assert.ok(Math.abs(up.y + up.h - zero) < 1e-9, 'a positive bar ends on zero');
  assert.ok(Math.abs(down.y - zero) < 1e-9, 'a negative bar starts on zero');
  assert.ok(Math.abs(up.h / down.h - 26 / 18) < 1e-9, 'heights are proportional to values');
  assert.equal(up.fill, 'accent'); assert.equal(down.fill, 'negative');
  assert.equal(down.enter, 'grow-y'); assert.ok(Math.abs(down.origin[0] - (down.x + down.w / 2)) < 1e-9 && down.origin[1] === zero, 'bars grow from zero');
  assert.equal(named(p, 'bars-value-1').text, '−18%');
  assert.match(p.source, /Illustrative data · 2026-10-04/);
});

test('bars reject dishonest or unreadable inputs', () => {
  for (const bad of [{ ...base, domain: [5, 40], ticks: [5, 40] }, { ...base, values: [{ label: 'a', value: 50 }, { label: 'b', value: 1 }] },
    { ...base, ticks: [-20, 40, 0] }, { ...base, values: [{ label: 'a', value: 1 }, { label: 'a', value: 2 }] }, { ...base, orientation: 'diagonal' }, { ...base, extra: 1 }])
    assert.throws(() => barsSpec(bad));
  assert.throws(() => expandBarsProps({ bars: base }, { ...frame, duration: 3 }), /two seconds/);
  assert.throws(() => expandBarsProps({ bars: base, plot: {} }, frame), /cannot combine/);
});

test('horizontal bars keep negative values clear of category names', () => {
  const p = expandBarsProps({ bars: { ...base, orientation: 'horizontal', domain: [-2, 8], ticks: [-2, 0, 2, 4, 6, 8], suffix: ' pp',
    values: [{ label: 'Technology', value: 6.1 }, { label: 'Energy', value: -0.8 }] } }, { ...frame, width: 1080, height: 1920 });
  const label = named(p, 'bars-label-1'), value = named(p, 'bars-value-1');
  assert.ok(value.anchor === 'start' || value.x - value.text.length * value.size * .56 > label.x, 'the value does not run into its category label');
});
