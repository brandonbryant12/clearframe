import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { items } from '../film/library.mjs';
import { sketch } from '../film/sketches.mjs';
import { normalizeElements } from '../film/canvas.mjs';
import { storyboardFor } from '../film/playbooks.mjs';
import { createJob } from '../film/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';

const books = ['cash-flow', 'scenario-lab', 'risk-tradeoffs'];
const drawings = ['cash-lock', 'scenario-fork', 'scenario-origin', 'scenario-outcomes', 'risk-lens'];

test('financial films scaffold to valid native jobs in landscape and vertical with their evidence metadata', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-financial-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of books) for (const vertical of [false, true]) {
    const sb = storyboardFor(name, { vertical });
    const dir = path.join(root, `${name}-${vertical}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb));
    const loaded = loadStoryboard(dir);
    const result = createJob(loaded, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, [], `${name} ${vertical ? 'vertical' : 'landscape'}`);
    assert.equal(result.job.chrome, false);
    assert.equal(loaded.assets.length, 0, 'all evidence and illustration stays native');
    assert.deepEqual(sb.sources, items('playbooks').find(b => b.id === name).sources);
    assert.ok(sb.sources.every(s => s.claim && s.source && s.asOf));
    assert.ok(sb.beats.some(b => b.block === 'canvas' && !b.vo), 'the edit has room for a breath');
    assert.ok(sb.beats.some(b => ['iris', 'panel'].includes(b.transition)), 'a motivated turn changes the visual rhythm');
  }
});

test('financial mechanisms are reproducible native drawings in all four frame shapes', () => {
  for (const name of drawings) for (const format of ['landscape', 'vertical', 'square', 'portrait']) {
    const props = sketch(name, format);
    assert.deepEqual(props, sketch(name, format), `${name} ${format}`);
    normalizeElements(props.elements, `${name}.${format}`, message => { throw new Error(message); });
    assert.doesNotMatch(JSON.stringify(props), /"(?:file|asset|material)"|#[a-f0-9]{6}/i,
      'brand palette tokens and native geometry carry the mechanism');
    assert.ok(props.elements.some(e => e.at === 0 && e.enter === 'none'), 'a picture exists on frame one');
  }
});

test('the sample cash balance reconciles and scenario comparisons use one explicit basis', () => {
  const cash = storyboardFor('cash-flow');
  const flows = cash.beats.find(b => b.id === 'flows').props;
  const balance = cash.beats.find(b => b.id === 'balance').props;
  assert.equal(balance.from.value + flows.data[0].value - flows.data[1].value, balance.to.value,
    'replacing a sample amount must also update its reconciled balance');
  for (const b of cash.beats.filter(b => ['bars', 'delta'].includes(b.block))) {
    assert.match(b.props.source, /Illustrative.*month.*USD thousands/);
    assert.match(b.props.kicker, /Illustrative/);
  }
  const scenarios = storyboardFor('scenario-lab');
  const chart = scenarios.beats.find(b => b.id === 'comparison').props;
  assert.equal(chart.sort, 'none', 'scenario order carries meaning');
  assert.ok(chart.data.every(d => d.value <= chart.max));
  assert.match(chart.source, /same example month.*USD thousands/);
  assert.match(scenarios.beats.find(b => b.id === 'limits').vo, /not forecasts/);
  assert.match(scenarios.beats.find(b => b.id === 'outcomes').vo, /no probabilities assigned/);
});
