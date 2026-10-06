import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { kpiSpec, expandKPIProps, seesawAngle } from '../film/kpis.mjs';
import { normalizeElements, eachElement } from '../film/canvas.mjs';
import { scaffold } from '../film/playbooks.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { createJob } from '../film/job.mjs';

const source = 'Illustrative test values';
const frame = { width: 1920, height: 1080 };
const spec = { form: 'comparison', label: 'Completion', unit: '%', domain: [0, 100], values: [{ label: 'A', value: 25 }, { label: 'B', value: 75 }] };
const draw = (kpi, size = frame) => expandKPIProps({ kpi, source }, size);
const named = (props, id) => { let found; eachElement(props.elements, el => { if (el.id === id) found = el; }); return found; };

test('literal edits regenerate proportional front faces while depth and attribution stay fixed', () => {
  const first = draw({ ...spec, motion: 'none' });
  const edited = draw({ ...spec, motion: 'none', values: [{ label: 'A', value: 50 }, { label: 'B', value: 75 }] });
  const a = named(first, 'kpi-value-face-0'), b = named(first, 'kpi-value-face-1'), changed = named(edited, 'kpi-value-face-0');
  assert(Math.abs(a.h / b.h - 25 / 75) < 1e-12);
  assert.equal(changed.h, a.h * 2);
  assert.equal(a.y + a.h, b.y + b.h, 'front faces share one baseline');
  assert.equal(changed.y + changed.h, a.y + a.h);
  const top = named(first, 'kpi-depth-0-top'), topEdited = named(edited, 'kpi-depth-0-top');
  assert.equal(top.points[1][0] - top.points[0][0], topEdited.points[1][0] - topEdited.points[0][0], 'depth is independent of value');
  assert.equal(first.source, source); assert.equal(edited.source, source);
  const rail = draw({ form: 'rail', label: 'Progress', value: 72, total: 100, motion: 'none' });
  assert(Math.abs(named(rail, 'kpi-value-face-0').w / named(rail, 'kpi-track-face').w - 0.72) < 1e-12);
  const zero = draw({ form: 'rail', label: 'Progress', value: 0, total: 100 });
  assert.equal(named(zero, 'kpi-value-face-0'), undefined, 'zero is never drawn as a positive amount');
});

test('decorative pedestal accepts signed finite values without changing its geometry', () => {
  const a = draw({ form: 'pedestal', label: 'Weekly return', value: -0.49, suffix: '%', decimals: 2, motion: 'none' });
  const b = draw({ form: 'pedestal', label: 'Weekly return', value: 22, suffix: '%', decimals: 2, motion: 'none' });
  assert.equal(named(a, 'kpi-value-label').text, '-0.49%');
  assert.deepEqual(named(a, 'kpi-decorative-plinth'), named(b, 'kpi-decorative-plinth'));
});

test('seesaw is level for equal values and uses finite monotonic qualitative tilt', () => {
  const values = (a, b) => [{ label: 'A', value: a }, { label: 'B', value: b }];
  assert.equal(seesawAngle(values(0, 0)), 0);
  assert.equal(seesawAngle(values(4, 4)), 0);
  assert(seesawAngle(values(4, 8)) > 0);
  assert(seesawAngle(values(4, 12)) > seesawAngle(values(4, 8)));
  assert.equal(seesawAngle(values(8, 4)), -seesawAngle(values(4, 8)));
  assert(Number.isFinite(seesawAngle(values(Number.MAX_VALUE, Number.MAX_VALUE / 2))));
  assert.equal(seesawAngle(values(0, 9)), 12);
  const base = { form: 'seesaw', label: 'Requests', unit: 'Requests this week', values: values(24, 36), motion: 'none' };
  const a = draw(base), b = draw({ ...base, values: values(100, 0) });
  for (let i = 0; i < 2; i++) assert.deepEqual(named(a, `kpi-weight-face-${i}`), named(b, `kpi-weight-face-${i}`), 'fixed weights do not encode volume');
  assert.throws(() => kpiSpec({ ...base, unit: undefined }, source), /unit/);
  assert.throws(() => kpiSpec({ ...base, values: [...base.values, { label: 'C', value: 1 }] }, source), /exactly 2/);
});

test('stack preserves literal contribution widths, remainder and a staged build', () => {
  const base = { form: 'stack', label: 'Weekly time', unit: 'Hours', total: 40, values: [{ label: 'Delivery', value: 20 }, { label: 'Planning', value: 10 }, { label: 'Support', value: 6 }], motion: { preset: 'stagger', duration: 0.55, stagger: 0.12 } };
  const p = draw(base), track = named(p, 'kpi-stack-track-face');
  assert.equal(named(p, 'kpi-stack-face-0').w / track.w, 0.5);
  assert.equal(named(p, 'kpi-stack-face-1').w / track.w, 0.25);
  assert.equal(named(p, 'kpi-stack-remainder').text, 'Remainder 4');
  assert.equal(named(p, 'kpi-stack-remainder').at, named(p, 'kpi-value-label-2').at, 'the final remainder does not label intermediate empty track');
  for (let i = 1; i < 3; i++) {
    const prev = named(p, `kpi-stack-group-${i - 1}`).keys[1], current = named(p, `kpi-stack-group-${i}`).keys[1];
    assert(current.at > prev.at + prev.dur, 'one front face finishes before the next starts');
    assert(named(p, `kpi-value-label-${i}`).at >= current.at + current.dur);
  }
  const zero = draw({ ...base, values: [{ label: 'A', value: 0 }, { label: 'B', value: 0 }] });
  assert.equal(named(zero, 'kpi-stack-face-0'), undefined);
  assert.throws(() => kpiSpec({ ...base, total: 20 }, source), /exceed/);
  assert.throws(() => kpiSpec({ ...base, total: undefined }, source), /explicit/);
  assert.throws(() => draw({ ...base, motion: { preset: 'stagger', duration: 2, stagger: 0.6 } }, { ...frame, duration: 5 }), /settles/);
  assert.doesNotThrow(() => kpiSpec({ ...base, total: 0.3, values: [{ label: 'A', value: 0.1 }, { label: 'B', value: 0.2 }] }, source));
});

test('invalid numbers, scales, totals and conflicting attribution are rejected', () => {
  for (const value of ['12', null, true, NaN, Infinity]) assert.throws(() => kpiSpec({ form: 'pedestal', label: 'Value', value }, source), /finite/);
  for (const total of [0, -1, '100', NaN, Infinity]) assert.throws(() => kpiSpec({ form: 'rail', label: 'Progress', value: 0, total }, source), /total/);
  assert.throws(() => kpiSpec({ form: 'rail', label: 'Progress', value: -1, total: 100 }, source), /nonnegative/);
  assert.throws(() => kpiSpec({ form: 'rail', label: 'Progress', value: 101, total: 100 }, source), /exceed/);
  assert.throws(() => kpiSpec({ ...spec, domain: [20, 100] }, source), /domain/);
  assert.throws(() => kpiSpec({ ...spec, domain: [0, 50] }, source), /outside/);
  assert.throws(() => kpiSpec({ ...spec, values: [{ label: 'A', value: -1 }, { label: 'B', value: 20 }] }, source), /nonnegative/);
  assert.throws(() => kpiSpec({ ...spec, source: 'Another source' }, source), /conflicts/);
  assert.throws(() => kpiSpec(spec), /source/);
});

test('bounded reveals start at zero, defer final labels, and never scale data for emphasis', () => {
  const p = draw({ ...spec, motion: { preset: 'stagger', duration: 0.8, stagger: 0.2 } });
  for (let i = 0; i < 2; i++) {
    const group = named(p, `kpi-value-group-${i}`), label = named(p, `kpi-value-label-${i}`), top = named(p, `kpi-depth-${i}-top`);
    assert.equal(group.keys[0].scaleY, 0); assert.equal(group.keys[1].scaleY, 1);
    assert(label.at >= group.keys[1].at + group.keys[1].dur);
    assert.equal(top.at, label.at, 'decorative depth arrives after the amount resolves');
  }
  for (const preset of ['none', 'emphasis']) {
    const still = draw({ ...spec, motion: preset });
    assert.equal(named(still, 'kpi-value-group-0').keys, undefined);
    assert.equal(named(still, 'kpi-value-label-0').at, 0);
  }
  assert.throws(() => kpiSpec({ ...spec, motion: { preset: 'reveal', duration: 10 } }, source), /duration/);
  assert.throws(() => kpiSpec({ form: 'rail', label: 'Progress', value: 5, total: 10, motion: 'stagger' }, source), /comparisons/);
});

test('all forms compile in both frame shapes with exact sources and native editable text', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-kpis-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const vertical of [false, true]) {
    const dir = path.join(root, vertical ? 'vertical' : 'landscape');
    scaffold(dir, { playbook: 'dimensional-kpis', vertical });
    const sb = loadStoryboard(dir), result = createJob(sb, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []);
    for (const beat of result.job.beats) {
      assert.equal(beat.props.kpi, undefined);
      assert.equal(beat.props.source, 'Illustrative values · replace before publishing');
      eachElement(beat.props.elements, el => { if (el.id) assert(el.id.startsWith(beat.id + '-'), 'generated ids cannot morph into a different KPI beat'); });
      normalizeElements(beat.props.elements, beat.id, message => { throw new Error(message); });
      assert(!JSON.stringify(beat.props).includes('scene.blend'));
    }
    assert.equal(sb.assets.length, 0);
  }
});
