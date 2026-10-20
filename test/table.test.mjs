import test from 'node:test';
import assert from 'node:assert/strict';
import {
  tableSpec,
  tableElements,
} from '../packages/engine/dist/film/table.mjs';
const base = {
  id: 'claims',
  title: 'Who sees a claim',
  source: 'Illustrative records',
  columns: [
    { id: 'person', label: 'Employee' },
    { id: 'amount', label: 'Amount', align: 'right' },
    { id: 'status', label: 'Status' },
  ],
  rows: [
    { id: 'r1', cells: { person: 'Alex', amount: '$120', status: 'Approved' } },
  ],
  views: [
    { id: 'manager', label: 'Managers see' },
    { id: 'contractor', label: 'Contractors see', hide: ['person', 'amount'] },
  ],
  show: [
    { view: 'contractor', at: 3 },
    { view: 'manager', at: 6 },
  ],
};
const visible = (list, t) =>
  list.filter((e) => (e.at ?? 0) <= t && (e.exitAt == null || e.exitAt > t));
test('audience views remove hidden text for the entire interval while retaining fixed cells', () => {
  const { elements } = tableElements(tableSpec(base), {
    width: 1920,
    height: 1080,
    duration: 9,
  });
  for (const t of [0, 2.99, 6, 8.99])
    assert.ok(visible(elements, t).some((e) => e.text === '$120'));
  for (const t of [3, 4, 5.999]) {
    assert.ok(
      !visible(elements, t).some((e) => ['Alex', '$120'].includes(e.text)),
    );
    assert.ok(visible(elements, t).some((e) => e.text === 'Approved'));
  }
  assert.equal(
    elements.filter((e) => e.id === 'tbl-claims-r1-amount').length,
    1,
  );
  const amount = elements.find(
    (e) => e.id === 'tbl-claims-r1-amount-text-standalone-0',
  );
  assert.equal(amount.anchor, 'end');
  assert.equal(amount.font, 'figures');
  assert.equal(
    elements.find((e) => e.id === 'tbl-claims-r1-amount-text-standalone-2').x,
    amount.x,
  );
});
test('refuses missing cells, unknown views, out-of-order changes and unreadable layouts', () => {
  assert.throws(
    () =>
      tableSpec({ ...base, rows: [{ id: 'r1', cells: { person: 'Alex' } }] }),
    /format numbers with their units/,
  );
  assert.throws(
    () => tableSpec({ ...base, show: [{ view: 'unknown', at: 2 }] }),
    /unknown view/,
  );
  assert.throws(
    () =>
      tableSpec({
        ...base,
        views: [{ id: 'all', label: 'All', hide: ['unknown'] }],
      }),
    /hide must name/,
  );
  assert.throws(
    () =>
      tableElements(
        tableSpec({
          ...base,
          show: [
            { view: 'contractor', at: 6 },
            { view: 'manager', at: 3 },
          ],
        }),
        { width: 1920, height: 1080 },
      ),
    /increasing/,
  );
  const four = {
    ...base,
    columns: [...base.columns, { id: 'extra', label: 'Extra' }],
    rows: [{ id: 'r1', cells: { ...base.rows[0].cells, extra: 'More' } }],
  };
  assert.throws(
    () => tableElements(tableSpec(four), { width: 1080, height: 1920 }),
    /portrait tables take at most 3/,
  );
  assert.throws(
    () =>
      tableElements(
        tableSpec({
          ...base,
          rows: [
            {
              id: 'r1',
              cells: {
                ...base.rows[0].cells,
                person:
                  'An extraordinarily long employee name that will not fit inside this column',
              },
            },
          ],
        }),
        { width: 1080, height: 1920 },
      ),
    /too long for its cell/,
  );
});

test('timed values get beat-local identities while cell geometry carries across cuts', () => {
  const p = tableSpec(base),
    a = tableElements(p, { width: 1920, height: 1080, beatId: 'a' }).elements,
    b = tableElements(p, { width: 1920, height: 1080, beatId: 'b' }).elements;
  const previous = new Set(a.map((e) => e.id));
  for (const e of b.filter(
    (e) =>
      e.id.includes('-text-') ||
      e.id.includes('-redaction-') ||
      e.id.includes('-audience-'),
  ))
    assert.ok(!previous.has(e.id));
  assert.ok(previous.has(b.find((e) => e.id === 'tbl-claims-r1-amount').id));
});

test('compiled cuts preserve a later reveal and named moments share audience timing', async (t) => {
  const fs = await import('node:fs'),
    os = await import('node:os'),
    path = await import('node:path');
  const { createJob } =
    await import('../packages/engine/dist/film/production.mjs');
  const { loadStoryboard } =
    await import('../packages/engine/dist/engine/lib/project.mjs');
  const { computeTiming } =
    await import('../packages/engine/dist/engine/lib/timing.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-table-cut-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const hidden = {
    ...base,
    views: [base.views[1], base.views[0]],
    show: [{ view: 'manager', cue: 'RETURN' }],
  };
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify({
      version: 2,
      title: 'Audience cuts',
      format: { preset: 'landscape', fps: 30 },
      theme: 'paper',
      captions: false,
      music: false,
      sources: [{ claim: 'Example records', source: 'Illustrative' }],
      beats: [
        { id: 'first', block: 'canvas', duration: 9, props: { table: base } },
        {
          id: 'next',
          block: 'canvas',
          duration: 9,
          props: { moments: { RETURN: { at: 6 } }, table: hidden },
        },
      ],
    }),
  );
  const { job, errors } = createJob(loadStoryboard(root), computeTiming(root), {
    draft: true,
  });
  assert.deepEqual(errors, []);
  const second = job.beats[1].props.elements;
  assert.ok(!visible(second, 1).some((e) => e.text === '$120'));
  assert.equal(second.find((e) => e.text === '$120').at, 6);
  assert.equal(second.find((e) => e.text === 'Managers see').at, 6);
});
