// Breakdowns reconcile every parent and drill down without showing a quantity twice.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { breakdownSpec, breakdownElements, expandBreakdownProps } from '../film/breakdown.mjs';
import { createJob } from '../film/production.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const base = {
  id: 'opex', title: 'Where operating costs go', unit: 'Operating costs, $ millions', asOf: '2026-09-30', source: 'Example figures',
  decimals: 1, prefix: '$', total: { label: 'Operating costs', value: 41.8 },
  parts: [
    { id: 'people', label: 'People', value: 24.1, parts: [{ label: 'Salaries', value: 18.0 }, { label: 'Benefits', value: 4.2 }, { label: 'Contractors', value: 1.9 }] },
    { label: 'Technology', value: 9.6 }, { label: 'Facilities', value: 8.1 },
  ],
};
const frame = { width: 1920, height: 1080 };
const byId = els => Object.fromEntries(els.map(e => [e.id, e]));

test('every parent reconciles, or carries an explicit positive remainder; a negative one is a bridge', () => {
  assert.doesNotThrow(() => breakdownSpec(base));
  // Raw values reconcile exactly: a gap smaller than the printed precision is still a gap, and
  // as an explicit remainder it would print as zero, so more decimals are asked for.
  assert.throws(() => breakdownSpec({ ...base, total: { ...base.total, value: 41.84 } }), /add up to \$41\.8, but Operating costs is \$41\.8/);
  assert.throws(() => breakdownSpec({ ...base, total: { ...base.total, value: 41.84 }, residual: true }), /Not explained \(0\.0\d+\) prints as \$0\.0 at 1 decimal; show more decimals/);
  assert.doesNotThrow(() => breakdownSpec({ ...base, decimals: 2, total: { ...base.total, value: 41.84 }, residual: true }));
  assert.throws(() => breakdownSpec({ ...base, total: { ...base.total, value: 43 } }), /add up to \$41\.8, but Operating costs is \$43\.0\. Add the difference \(\$1\.2\)/);
  const gap = breakdownSpec({ ...base, total: { ...base.total, value: 43 }, residual: true });
  const rest = gap.parts.at(-1);
  assert.equal(rest.label, 'Not explained');
  assert.ok(Math.abs(rest.value - 1.2) < 1e-9 && rest.remainder);
  assert.throws(() => breakdownSpec({ ...base, total: { ...base.total, value: 40 }, residual: true }), /more than Operating costs \(\$40\.0\) by \$1\.8\. A negative remainder is not a share/);
  const child = structuredClone(base);
  child.parts[0].parts[0].value = 17;
  assert.throws(() => breakdownSpec(child), /parts of People add up to \$23\.1, but People is \$24\.1/);
  child.parts[0].residual = 'Unassigned';
  assert.equal(breakdownSpec(child).parts[0].parts.at(-1).label, 'Unassigned', 'a part reconciles with its own labelled remainder');
  for (const [bad, message] of [
    [{ ...base, parts: [{ label: 'Only', value: 41.8 }] }, /2–8 parts/],
    [{ ...base, parts: [...base.parts.slice(1), { label: 'Zero', value: 0 }, { label: 'People', value: 24.1 }] }, /zero: a part of nothing draws nothing/],
    [{ ...base, parts: [{ label: 'Up', value: 50 }, { label: 'Down', value: -8.2 }] }, /negative: a share of a whole cannot be negative/],
    [{ ...base, parts: [{ label: 'Same', value: 20.9 }, { label: 'same', value: 20.9 }] }, /ids must be unique/],
    [{ ...base, focus: 'technology' }, /Technology has no parts of its own/],
    [{ ...base, focus: 'people', gather: 'people' }, /a beat shows the whole/],
    [{ ...base, open: { part: 'people' } }, /open needs say, cue or at/],
  ])
    assert.throws(() => breakdownSpec(bad), message, JSON.stringify(bad).slice(0, 80));
});

test('what is printed adds up: rounding that hides a part or breaks the printed sum asks for more decimals', () => {
  const plain = { ...base, decimals: 0, prefix: '', total: { label: 'Total', value: 100 } };
  // 49.6 + 50.6 is 100.2: not 100, whatever the rounding.
  assert.throws(() => breakdownSpec({ ...plain, parts: [{ label: 'A', value: 49.6 }, { label: 'B', value: 50.6 }] }), /parts of Total add up to 100, but Total is 100/);
  // 33.3 + 33.3 + 33.4 is exactly 100, but prints 33 + 33 + 33 = 99 beside 100.
  assert.throws(() => breakdownSpec({ ...plain, parts: [{ label: 'A', value: 33.3 }, { label: 'B', value: 33.3 }, { label: 'C', value: 33.4 }] }),
    /at 0 decimals the parts of Total print as 33 \+ 33 \+ 33 = 99, next to 100; show more decimals \(decimals: 1\)/);
  assert.doesNotThrow(() => breakdownSpec({ ...plain, decimals: 1, parts: [{ label: 'A', value: 33.3 }, { label: 'B', value: 33.3 }, { label: 'C', value: 33.4 }] }));
  // A named remainder stays visible at the chosen precision.
  assert.throws(() => breakdownSpec({ ...plain, residual: 'Unassigned', parts: [{ label: 'A', value: 60 }, { label: 'B', value: 39.6 }] }), /Unassigned \(0\.4\d*\) prints as 0 at 0 decimals/);
  // Authored values are never changed.
  const spec = breakdownSpec({ ...plain, decimals: 1, parts: [{ label: 'A', value: 33.3 }, { label: 'B', value: 33.3 }, { label: 'C', value: 33.4 }] });
  assert.deepEqual(spec.parts.map(x => x.value), [33.3, 33.3, 33.4]);
});

test('a tiny share keeps its exact width: a marker finds it, nothing enlarges it', () => {
  const tiny = { ...base, decimals: 3, prefix: '', total: { label: 'Total', value: 100 },
    parts: [{ id: 'small', label: 'Small', value: 0.001 }, { label: 'Rest', value: 99.999, parts: [{ label: 'x', value: 0.001 }, { label: 'y', value: 99.998 }] }] };
  const e = byId(breakdownElements(breakdownSpec(tiny), frame));
  const total = e['bd-opex-total-bar'], small = e['bd-opex-small-bar'], rest = e['bd-opex-rest-bar'];
  assert.ok(Math.abs(small.w - total.w * 0.001 / 100) < 1e-12, `the bar is exactly its share (${small.w} px), not enlarged`);
  assert.ok(Math.abs(small.w + rest.w - total.w) < 1e-9, 'the parts still tile the total exactly');
  assert.equal(e['bd-opex-small-marker'].fill, 'none', 'an outline marker, not a filled quantity, makes it findable');
  assert.equal(e['bd-opex-rest-marker'], undefined);
  const o = byId(breakdownElements(breakdownSpec({ ...tiny, focus: 'rest' }), frame));
  const [x, y] = ['x', 'y'].map(k => o[`bd-opex-rest-${k}-bar`]);
  assert.ok(Math.abs(x.morphFrom.slice[1] - 0.001 / 99.999) < 1e-15 && x.morphFrom.slice[1] === y.morphFrom.slice[0] && y.morphFrom.slice[1] === 1,
    'a tiny part is an exact slice and the slices still tile the parent');
  assert.ok(Math.abs(x.w - o['bd-opex-rest-frame'].w * 0.001 / 99.999) < 1e-12 && o['bd-opex-rest-x-marker']);
});

test('rows share one scale; an opened part is an outline its parts fill, each a slice of the part', () => {
  const whole = byId(breakdownElements(breakdownSpec(base), frame));
  const total = whole['bd-opex-total-bar'], people = whole['bd-opex-people-bar'];
  assert.ok(Math.abs(people.w / total.w - 24.1 / 41.8) < 1e-9, 'a part is its share of the total bar');
  const opened = breakdownElements(breakdownSpec({ ...base, focus: 'people' }), frame), o = byId(opened);
  assert.equal(o['bd-opex-people-frame'].fill, 'none', 'the opened part is an outline, so its quantity is not drawn twice');
  assert.equal(o['bd-opex-people-bar'], undefined, 'and its own bar is not on screen');
  const kids = ['salaries', 'benefits', 'contractors'].map(k => o[`bd-opex-people-${k}-bar`]);
  assert.ok(Math.abs(kids[0].w / o['bd-opex-people-frame'].w - 18 / 24.1) < 1e-9, 'parts are drawn on the part’s own scale');
  // The slices tile the part's bar exactly: no gap, no overlap.
  const slices = kids.map(k => k.morphFrom.slice);
  assert.equal(slices[0][0], 0);
  assert.ok(Math.abs(slices.at(-1)[1] - 1) < 1e-12);
  for (let i = 1; i < slices.length; i++) assert.ok(Math.abs(slices[i][0] - slices[i - 1][1]) < 1e-12);
  for (const [i, k] of kids.entries()) assert.ok(Math.abs((slices[i][1] - slices[i][0]) - [18, 4.2, 1.9][i] / 24.1) < 1e-12);
  // Gathering: the parts sit in their slices of the part's bar and hand over to it as they meet.
  const g = byId(breakdownElements(breakdownSpec({ ...base, gather: 'people' }), frame)), bar = g['bd-opex-people-bar'];
  const back = ['salaries', 'benefits', 'contractors'].map(k => g[`bd-opex-people-${k}-bar`]);
  assert.ok(Math.abs(back.reduce((a, k) => a + k.w, 0) - bar.w) < 1e-9 && back[0].x === bar.x);
  assert.ok(back.every(k => k.exitAt === bar.at && k.exit === 'none'), 'the slices leave the frame the bar arrives');
});

test('opening in the beat breaks the bar into slices that travel to their rows on one moment', () => {
  const els = breakdownElements(breakdownSpec({ ...base, open: { part: 'people', at: 2 } }), frame);
  const e = byId(els);
  assert.equal(e['bd-opex-people-bar'].exitAt, 2);
  const kid = e['bd-opex-people-salaries-bar'], src = e['bd-opex-people-bar'];
  assert.equal(kid.at, 2);
  assert.ok(Math.abs(kid.x + kid.keys[0].x - src.x) < 1e-9 && Math.abs(kid.w * kid.keys[0].scaleX - src.w * 18 / 24.1) < 1e-9, 'it starts as its slice');
  assert.equal(e['bd-opex-technology-bar'].exitAt, 2, 'the rest of the whole steps away on the same moment');
});

function film(t, beats) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-breakdown-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), { version: 2, title: 'Breakdown', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false,
    sources: [{ id: 'ex', title: 'Example figures' }], beats });
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}
const beat = (id, extra, vo = 'Operating costs, then people, technology and facilities, held for a moment to read.') =>
  ({ id, block: 'canvas', min: 6, vo, props: { source: 'Example figures', breakdown: { ...structuredClone(base), ...extra } } });

test('across a cut the parts come out of the part’s bar in the beat before; overlapping or duplicated slices are refused', t => {
  const { job, errors } = film(t, [beat('whole', {}), beat('people', { focus: 'people' }), beat('back', { gather: 'people' })]);
  assert.deepEqual(errors, []);
  const [a, b, c] = job.beats.map(x => byId(x.props.elements));
  const src = a['bd-opex-people-bar'], kids = ['salaries', 'benefits', 'contractors'].map(k => b[`bd-opex-people-${k}-bar`]);
  assert.ok(kids.every(k => k.morph && k.morphFrom === undefined && k.at === 0 && k.enter === 'none'));
  assert.ok(Math.abs(kids.reduce((s, k) => s + k.morph.from.w, 0) - src.w) < 1e-9, 'the slices partition the part’s bar: its width, no more');
  assert.equal(kids[0].morph.from.x, src.x);
  assert.equal(b['bd-opex-people-label'].morph.from.y, a['bd-opex-people-label'].y, 'the part’s name carries across');
  assert.ok(['salaries', 'benefits', 'contractors'].every(k => c[`bd-opex-people-${k}-bar`].morph), 'gathering morphs the same parts back');
  assert.equal(job.beats[1].transition, 'cut');
  // A second element claiming an overlapping slice would count part of the bar twice.
  const twice = film(t, [beat('whole', {}), { id: 'bad', block: 'canvas', min: 4, vo: 'One part, twice.', props: { source: 'Example figures', elements: [
    { id: 'p1', type: 'rect', x: 100, y: 100, w: 100, h: 50, fill: 'accent', morphFrom: { id: 'bd-opex-people-bar', slice: [0, 0.6] } },
    { id: 'p2', type: 'rect', x: 100, y: 200, w: 100, h: 50, fill: 'accent', morphFrom: { id: 'bd-opex-people-bar', slice: [0.5, 1] } }] } }]);
  assert.match(twice.errors.join('\n'), /overlapping slices of bd-opex-people-bar/);
  const kept = film(t, [beat('whole', {}), { id: 'bad', block: 'canvas', min: 4, vo: 'The whole stays.', props: { source: 'Example figures', elements: [
    { id: 'bd-opex-people-bar', type: 'rect', x: 100, y: 100, w: 300, h: 50, fill: 'accent' },
    { id: 'p1', type: 'rect', x: 100, y: 200, w: 100, h: 50, fill: 'accent', morphFrom: { id: 'bd-opex-people-bar', slice: [0, 1] } }] } }]);
  assert.match(kept.errors.join('\n'), /cannot also stay on screen as itself/);
});

test('a tall frame keeps names above full-width bars and the source line carries the date', () => {
  const p = expandBreakdownProps({ source: 'Example figures', breakdown: base }, { width: 1080, height: 1920, duration: 8 });
  const e = byId(p.elements);
  assert.equal(e['bd-opex-people-label'].anchor, 'start');
  assert.ok(e['bd-opex-people-label'].y < e['bd-opex-people-bar'].y, 'the name sits above its bar');
  assert.match(p.source, /Example figures · 2026-09-30/);
  assert.throws(() => expandBreakdownProps({ breakdown: base, bridge: {} }, frame), /cannot combine breakdown with bridge/);
});

test('the printed-sum check reads the same digits the viewer sees', () => {
  const two = { ...base, decimals: 2, prefix: '' };
  // 1.005 prints as 1.01 (the formatter's half-up rounding), so 1.005 + 1.005 prints 2.02 beside 2.01.
  assert.throws(() => breakdownSpec({ ...two, total: { label: 'Total', value: 2.01 }, parts: [{ label: 'A', value: 1.005 }, { label: 'B', value: 1.005 }] }),
    /print as 1\.01 \+ 1\.01 = 2\.02, next to 2\.01/);
  // 1.005 + 0.995 is exactly 2.00, but prints 1.01 + 1.00 = 2.01 beside 2.00.
  assert.throws(() => breakdownSpec({ ...two, total: { label: 'Total', value: 2 }, parts: [{ label: 'A', value: 1.005 }, { label: 'B', value: 0.995 }] }),
    /print as 1\.01 \+ 1\.00 = 2\.01, next to 2\.00/);
  assert.doesNotThrow(() => breakdownSpec({ ...two, decimals: 3, total: { label: 'Total', value: 2 }, parts: [{ label: 'A', value: 1.005 }, { label: 'B', value: 0.995 }] }));
  assert.doesNotThrow(() => breakdownSpec({ ...two, decimals: 0, total: { label: 'Total', value: 12345 }, parts: [{ label: 'A', value: 12000 }, { label: 'B', value: 345 }] }), 'thousands separators read back');
});
