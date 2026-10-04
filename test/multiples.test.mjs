import test from 'node:test';
import assert from 'node:assert/strict';
import { multiplesSpec, expandMultiplesProps } from '../fframes/multiples.mjs';

const series = ['a', 'b', 'c', 'd'].map((id, k) => ({ id, label: id.toUpperCase(), values: [{ x: 0, y: 100 }, { x: 5, y: 100 + 20 * k }, { x: 10, y: 100 + 50 * k }] }));
const base = { title: 'Growth of 100', unit: 'Index', x: { type: 'linear', label: 'Years', domain: [0, 10], ticks: [0, 10] },
  y: { type: 'linear', label: 'Value', domain: [50, 300], ticks: [50, 300] }, series, highlight: 'c', asOf: '2026-10-04', source: 'Illustrative data' };
const frame = { width: 1920, height: 1080, beatId: 'b', duration: 7 };
const named = (p, id) => p.elements.find(e => e.id === `b-${id}`);

test('every panel shares one scale and the highlight stands out', () => {
  const p = expandMultiplesProps({ multiples: base }, frame);
  const start = ['a', 'b'].map(id => named(p, `multiples-${id}-segment-1`));
  const h = s => named(p, `multiples-${s}-grid-0`).y1 - named(p, `multiples-${s}-grid-1`).y1;
  assert.ok(Math.abs(h('a') - h('d')) < 1e-9, 'panels have equal scale height');
  const rise = id => named(p, `multiples-${id}-grid-0`).y1 - named(p, `multiples-${id}-end`).cy;
  assert.ok(rise('d') > rise('b') && rise('b') > rise('a'), 'larger values sit higher on the shared scale');
  assert.equal(named(p, 'multiples-c-segment-1').stroke, 'accent2');
  assert.equal(named(p, 'multiples-a-segment-1').stroke, 'muted');
  assert.equal(named(p, 'multiples-d-value').text, '250');
  assert.ok(start.every(Boolean));
});

test('multiples reuse the plot contract and reject crowded or unknown input', () => {
  assert.throws(() => multiplesSpec({ ...base, series: series.slice(0, 1) }), /2–9/);
  assert.throws(() => multiplesSpec({ ...base, highlight: 'z' }), /highlight/);
  assert.throws(() => multiplesSpec({ ...base, series: [...series.slice(0, 3), { ...series[3], values: [{ x: 0, y: 400 }] }] }), /outside/);
  assert.throws(() => multiplesSpec({ ...base, series: [...series.slice(0, 3), { ...series[3], id: 'a' }] }), /unique/);
  assert.throws(() => expandMultiplesProps({ multiples: base }, { ...frame, duration: 3 }), /two seconds/);
});
