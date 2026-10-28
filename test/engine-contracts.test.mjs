// The public contracts an agent framework reads (clearframe/contracts, `capabilities --json`):
// they load with no renderer or agent runtime, and they describe what the harness actually
// returns, so a schema cannot drift from the data it promises.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Schema from 'effect/Schema';
import * as contracts from '../packages/engine/dist/engine/public-contracts.mjs';
import {
  createJobHarness,
  harnessEffects,
} from '../packages/engine/dist/engine/harness.mjs';

const ENTRY = path.resolve('packages/engine/dist/engine/public-contracts.mjs');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Every module the entry loads, statically or dynamically, and the packages they import. */
function graph(entry) {
  const local = new Set(),
    external = new Set();
  const walk = (file) => {
    if (local.has(file)) return;
    local.add(file);
    const source = fs.readFileSync(file, 'utf8');
    for (const m of source.matchAll(
      /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g,
    )) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith('.')) walk(path.resolve(path.dirname(file), spec));
      else if (!spec.startsWith('node:'))
        external.add(
          spec
            .split('/')
            .slice(0, spec.startsWith('@') ? 2 : 1)
            .join('/'),
        );
    }
  };
  walk(entry);
  return { local, external };
}

test('the contracts entry loads only effect, not the renderer, studio or an agent runtime', () => {
  const { local, external } = graph(ENTRY);
  assert.deepEqual([...external], ['effect']);
  assert.ok(local.size <= 5, `${local.size} modules: ${[...local].join(', ')}`);
});

test('capabilities decode as their own schema and name only published contracts', () => {
  const c = contracts.capabilities();
  assert.deepEqual(
    Schema.decodeUnknownSync(contracts.CapabilitiesSchema)(c),
    c,
  );
  assert.equal(c.contractVersion, contracts.CONTRACT_VERSION);
  for (const op of c.operations)
    for (const name of [op.request, op.result].filter(Boolean))
      assert.ok(c.schemas[name], `${op.name} names ${name}`);
  for (const [name, schema] of Object.entries(c.schemas)) {
    assert.equal(
      schema.$schema,
      'https://json-schema.org/draft/2020-12/schema',
    );
    assert.equal(schema.title, name);
    assert.ok(schema.type || schema.anyOf, `${name} describes a value`);
  }
  assert.deepEqual(c.jobs.kinds, [...contracts.JOB_KINDS]);
  for (const key of [
    'cancellation',
    'progress',
    'idempotency',
    'evidence',
    'acceptance',
  ])
    assert.ok(c.semantics[key], key);
});

test('the CLI prints the same capabilities for callers in any language', () => {
  const r = spawnSync(
    process.execPath,
    [
      path.resolve('packages/engine/dist/engine/cli.mjs'),
      'capabilities',
      '--json',
    ],
    { encoding: 'utf8', cwd: os.tmpdir() },
  );
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), contracts.capabilities());
});

function fixture(t) {
  const base = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cf-contracts-')),
  );
  const dir = path.join(base, 'film');
  fs.mkdirSync(dir);
  fs.writeFileSync(
    path.join(dir, 'storyboard.json'),
    JSON.stringify({
      title: 'Contracts',
      beats: [
        { id: 'a', block: 'title', duration: 1, props: { text: 'Contracts' } },
      ],
    }),
  );
  const cli = path.join(base, 'fixture.mjs');
  fs.writeFileSync(cli, "console.log('done');\n");
  const harness = createJobHarness({
    base,
    out: path.join(base, 'build/viewer'),
    cli,
    gate: null,
  });
  t.after(async () => {
    await harness.stopAll();
    fs.rmSync(base, { recursive: true, force: true });
  });
  return { dir, harness };
}

test('views, events, health and start results the harness returns decode as their contracts', async (t) => {
  const { dir, harness } = fixture(t);
  const started = harness.start(dir, {
    film: 'film',
    kind: 'check',
    requestKey: 'contracts:1',
  });
  assert.deepEqual(
    Schema.decodeUnknownSync(contracts.StartResultSchema)(started),
    started,
  );
  let job;
  for (let i = 0; i < 400; i++) {
    job = harness.get(started.id);
    if (contracts.TERMINAL_STATUSES.includes(job.status)) break;
    await wait(25);
  }
  assert.equal(job.status, 'complete', job.log);
  // onExcessProperty: 'error' fails on any field the view carries that the contract omits.
  const strict = { onExcessProperty: 'error' };
  Schema.decodeUnknownSync(contracts.JobViewSchema)(job, strict);
  for (const view of harness.list())
    Schema.decodeUnknownSync(contracts.JobViewSchema)(view, strict);
  const events = harness.events({ jobId: started.id });
  assert.ok(events.length >= 3);
  for (const event of events)
    Schema.decodeUnknownSync(contracts.JobEventSchema)(event, strict);
  assert.deepEqual(
    events.map((e) => e.type),
    ['created', ...events.slice(1).map(() => 'transition')],
  );
  const repeat = harness.start(dir, {
    film: 'film',
    kind: 'check',
    requestKey: 'contracts:1',
  });
  assert.equal(repeat.duplicate, true);
  Schema.decodeUnknownSync(contracts.StartResultSchema)(repeat, strict);
  Schema.decodeUnknownSync(contracts.HarnessHealthSchema)(
    harness.health(),
    strict,
  );
});

test('a malformed request is refused at the public boundary with a typed reason, before any job exists', async (t) => {
  const { dir, harness } = fixture(t);
  const refused = (body, reason, status) => {
    assert.throws(
      () => harness.start(dir, body),
      (e) =>
        e instanceof contracts.HarnessRequestError &&
        e._tag === 'HarnessRequestError' &&
        e.reason === reason &&
        e.status === status &&
        typeof e.message === 'string',
    );
  };
  // Parsed JSON from another runtime: wrong field types never reach job preparation.
  refused(
    { film: 'film', kind: 'section', beats: 'a' },
    'invalid-request',
    400,
  );
  refused({ film: 'film', kind: 'render' }, 'invalid-request', 400);
  refused({ film: 'film', kind: 'still', pos: '0.5' }, 'invalid-request', 400);
  refused(
    { film: 'film', kind: 'check', requestKey: 'has spaces' },
    'invalid-request',
    400,
  );
  refused({ film: 'film', kind: 'voice' }, 'approval-required', 403);
  assert.deepEqual(harness.list(), []);
  harness.start(dir, { film: 'film', kind: 'check', requestKey: 'k' });
  refused(
    { film: 'film', kind: 'captions', requestKey: 'k' },
    'request-key-conflict',
    409,
  );
  assert.throws(
    () => harness.cancel('no-such-job'),
    (e) => e.reason === 'unknown-job' && e.status === 404,
  );

  // The Effect form keeps the same failure, tagged, in its error channel.
  const exit = await Effect.runPromiseExit(
    harnessEffects(harness).start(dir, {
      film: 'film',
      kind: 'section',
      beats: 'a',
    }),
  );
  assert.ok(Exit.isFailure(exit));
  const failure = exit.cause.reasons.find((r) => r._tag === 'Fail')?.error;
  assert.equal(failure?._tag, 'HarnessRequestError');
  assert.equal(failure?.reason, 'invalid-request');
});
