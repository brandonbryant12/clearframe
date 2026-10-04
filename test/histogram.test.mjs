import test from 'node:test';
import assert from 'node:assert/strict';
import { histogramSpec, expandHistogramProps } from '../fframes/histogram.mjs';

const base = { title: 'Calendar-year returns', unit: 'Returns, 2016–2025', asOf: '2026-10-04', source: 'Illustrative data',
  observations: [12, 22, -4, 31, 18, 29, -18, 26, 25, 17], edges: [-20, -10, 0, 10, 20, 30, 40], suffix: '%',
  threshold: { value: 0, relation: 'lt', label: 'Losing years' }, marker: { value: 17, label: '2025' } };
const frame = { width: 1920, height: 1080, beatId: 'b', duration: 8 };
const named = (p, id) => p.elements.find(e => e.id === `b-${id}`);

test('bins count every observation and the threshold sentence states the exact share', () => {
  const p = expandHistogramProps({ distribution: base }, frame);
  const counts = p.elements.filter(e => /-distribution-count-/.test(e.id)).map(e => +e.text);
  assert.equal(counts.reduce((a, b) => a + b, 0), 10);
  assert.equal(named(p, 'distribution-threshold-label').text, 'Losing years: 2 of 10');
  assert.equal(named(p, 'distribution-bar-0').fill, 'negative', 'a bin wholly below zero takes the negative tone');
  assert.equal(named(p, 'distribution-bar-3').fill, 'accent');
  assert.equal(named(p, 'distribution-marker-label').text, '2025');
  const tall = named(p, 'distribution-bar-4'), short = named(p, 'distribution-bar-0');
  assert.ok(Math.abs(tall.h / short.h - 4) < 1e-9, 'bar height is proportional to count (4 of 1)');
});

test('histograms reject silent exclusion and unlabeled thresholds', () => {
  assert.throws(() => histogramSpec({ ...base, observations: [...base.observations, 55] }), /outside bins/);
  assert.throws(() => histogramSpec({ ...base, threshold: { value: 0, relation: 'lt' } }), /threshold.label/);
  assert.throws(() => histogramSpec({ ...base, marker: { value: 90, label: 'x' } }), /marker/);
  assert.throws(() => expandHistogramProps({ distribution: base }, { ...frame, duration: 3 }), /two seconds/);
  const missing = expandHistogramProps({ distribution: { ...base, observations: [...base.observations, null] } }, frame);
  assert.match(missing.source, /1 missing observation excluded/);
});
