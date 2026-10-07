import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeSpec, bridgeColumns, expandBridgeProps, orderBridgeTimes } from '../film/bridge.mjs';

const base = { title: 'Revenue grew, even after churn', unit: 'Quarterly revenue, $ millions', asOf: '2026-10-04', source: 'Illustrative data',
  prefix: '$', decimals: 1, start: { label: 'Q1', value: 48.2 },
  steps: [{ label: 'New customers', value: 6.1 }, { label: 'Churn', value: -3.0 }, { label: 'Currency', value: -0.9 }],
  end: { label: 'Q2', value: 50.4 }, domain: [0, 60], ticks: [0, 20, 40, 60] };
const frame = { width: 1920, height: 1080, beatId: 'b', duration: 8 };
const named = (p, id) => p.elements.find(e => e.id === `b-${id}`);

test('totals stand on zero and drivers float from the running total', () => {
  const p = expandBridgeProps({ bridge: base }, frame);
  const zero = named(p, 'bridge-grid-0').y1, start = named(p, 'bridge-bar-0'), up = named(p, 'bridge-bar-1'), down = named(p, 'bridge-bar-2'), end = named(p, 'bridge-bar-4');
  assert.ok(Math.abs(start.y + start.h - zero) < 1e-9 && Math.abs(end.y + end.h - zero) < 1e-9, 'totals end on the zero line');
  assert.ok(Math.abs(up.y + up.h - start.y) < 1e-9, 'a rise starts where the previous total ended');
  assert.ok(Math.abs(down.y - up.y) < 1e-9, 'a fall hangs from the level the rise reached');
  assert.ok(Math.abs(up.h / start.h - 6.1 / 48.2) < 1e-9, 'heights are proportional on one scale');
  assert.deepEqual([start.fill, up.fill, down.fill, end.fill], ['muted', 'accent', 'negative', 'accent2']);
  assert.deepEqual([named(p, 'bridge-value-1').text, named(p, 'bridge-value-2').text, named(p, 'bridge-value-4').text], ['+$6.1', '−$3.0', '$50.4']);
  assert.equal(named(p, 'bridge-tick-3').text, '$60', 'ticks carry only the decimals they need');
  assert.equal(up.enter, 'grow-y'); assert.equal(up.origin[1], start.y, 'a driver grows from the running total');
  assert.match(p.source, /Illustrative data · 2026-10-04/);
});

test('a bridge that does not reconcile names the gap instead of hiding it', () => {
  assert.throws(() => bridgeSpec({ ...base, end: { label: 'Q2', value: 52 } }), /take \$48\.2 to \$50\.4, but end is \$52\.0.*"Other", "value": 1\.6/);
  assert.doesNotThrow(() => bridgeSpec({ ...base, end: { label: 'Q2', value: 50.43 } }), 'display rounding is the only tolerance');
  for (const bad of [{ ...base, domain: [10, 60], ticks: [10, 60] }, { ...base, steps: [{ label: 'Flat', value: 0 }], end: { label: 'Q2', value: 48.2 } },
    { ...base, steps: [{ label: 'Q1', value: 1 }], end: { label: 'Q2', value: 49.2 } }, { ...base, steps: [{ label: 'Big', value: 20 }], end: { label: 'Q2', value: 68.2 } },
    { ...base, start: { ...base.start, say: 'first' } }, { ...base, extra: true }])
    assert.throws(() => bridgeSpec(bad));
  assert.throws(() => expandBridgeProps({ bridge: base }, { ...frame, duration: 4 }), /two seconds/);
  assert.throws(() => expandBridgeProps({ bridge: base, bars: {} }, frame), /cannot combine/);
});

test('subtotals restate the running total and costs can be good news falling', () => {
  const pnl = { ...base, decimals: 0, start: { label: 'Revenue', value: 120 }, end: { label: 'Profit', value: 21 }, domain: [0, 120], ticks: [0, 40, 80, 120],
    steps: [{ label: 'Cost of sales', value: -48 }, { label: 'Gross profit', total: true }, { label: 'Operating costs', value: -45 }, { label: 'Interest', value: -6 }] };
  assert.deepEqual(bridgeColumns(bridgeSpec(pnl)).map(c => [c.kind, c.from, c.to]),
    [['start', 0, 120], ['step', 120, 72], ['subtotal', 0, 72], ['step', 72, 27], ['step', 27, 21], ['end', 0, 21]]);
  assert.throws(() => bridgeSpec({ ...pnl, steps: [pnl.steps[0], { label: 'Gross profit', total: true, value: 75 }, ...pnl.steps.slice(2)] }), /reach \$72/);
  const costs = expandBridgeProps({ bridge: { ...pnl, good: 'down' } }, frame);
  assert.equal(named(costs, 'bridge-bar-1').fill, 'accent', 'with good: down a fall takes the good colour');
});

test('spoken cues reveal a driver, its value and the connector into it on the word', () => {
  const p = expandBridgeProps({ bridge: { ...base, steps: [{ ...base.steps[0], say: 'customers' }, ...base.steps.slice(1)], end: { ...base.end, say: 'landed' } } }, { ...frame, duration: 5 });
  for (const id of ['bridge-bar-1', 'bridge-value-1', 'bridge-link-0']) assert.equal(named(p, id).say, 'customers', id);
  assert.equal(named(p, 'bridge-bar-4').say, 'landed');
  assert.ok(named(p, 'bridge-bar-2').at > 0 && named(p, 'bridge-bar-2').say == null, 'uncued drivers keep their timed order');
});

test('spoken cues are anchors; uncued columns fall in reading order around them', () => {
  const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  assert.ok(close(orderBridgeTimes([0.5, 1, 1.5, 2], [false, false, false, false]), [0.5, 1, 1.5, 2]), 'in order stays as authored');
  const late = orderBridgeTimes([0.5, 4, 1.5, 2], [false, true, false, false]);
  assert.ok(late[2] > late[1] && late[3] > late[2], 'columns after a late cue follow it');
  const early = orderBridgeTimes([0.5, 0.3, 1.5, 2], [false, true, false, false]);
  assert.ok(early[0] >= 0 && early[0] < early[1], 'the opening total moves ahead of an early cue');
  const squeezed = orderBridgeTimes([0.5, 1, 2.5, 3, 2], [false, false, false, false, true]);
  assert.ok(squeezed[1] > squeezed[0] && squeezed[2] > squeezed[1] && squeezed[3] > squeezed[2] && squeezed[3] < squeezed[4], 'timed columns fit before a cued end');
  assert.throws(() => orderBridgeTimes([0.5, 3, 2], [false, true, true]), /column 3 is cued at/);
});

test('the job refuses a bridge whose spoken cue puts a driver after the next one', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { computeTiming } = await import('../engine/lib/timing.mjs');
  const { loadStoryboard } = await import('../engine/lib/project.mjs');
  const { createJob } = await import('../film/job.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-bridge-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sb = steps => ({ version: 2, title: 'Bridge order', format: { preset: 'landscape' }, theme: 'ledger', sources: [{ claim: 'Illustrative', source: 'Illustrative data', asOf: '2026-10-04' }],
    beats: [{ id: 'walk', block: 'canvas', min: 9, camera: 'none', vo: 'New customers came first, then churn took some back, and currency barely moved.', props: { bridge: { ...base, steps } } }] });
  const job = steps => { fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb(steps))); return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true }); };
  assert.match(job([{ ...base.steps[0], say: 'currency' }, { ...base.steps[1], say: 'customers' }, base.steps[2]]).errors.join('\n'), /column 3 is cued at .* before column 2/);
  const late = job([{ ...base.steps[0], say: 'currency' }, ...base.steps.slice(1)]);
  assert.equal(late.errors.length, 0);
  const at = i => late.job.beats[0].props.elements.find(e => e.id === `walk-bridge-bar-${i}`).at;
  assert.ok(at(2) > at(1) && at(3) > at(2) && at(4) > at(3), 'uncued columns follow a late cue instead of arriving before it');
  assert.deepEqual(job([{ ...base.steps[0], say: 'customers' }, { ...base.steps[1], say: 'churn' }, { ...base.steps[2], say: 'currency' }]).errors, [], 'cues in reading order pass');
});

test('tall frames read the bridge down the page with every bar on one scale', () => {
  const p = expandBridgeProps({ bridge: base }, { ...frame, width: 1080, height: 1920 });
  const start = named(p, 'bridge-bar-0'), up = named(p, 'bridge-bar-1'), label = named(p, 'bridge-label-1');
  assert.equal(start.enter, 'grow-x');
  assert.ok(Math.abs(up.x - (start.x + start.w)) < 1e-9, 'a rise starts where the total ended');
  assert.ok(label.y < up.y && label.x < start.x + start.w, 'the name sits above its bar, in the label column');
  assert.ok(start.w > 1080 * .4, 'bars use the frame width');
});
