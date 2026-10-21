import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { workspace } from './shared.mjs';

const evidence = path.join(workspace, 'build/package');
fs.mkdirSync(evidence, { recursive: true });
const temporary = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), 'clearframe-package-')),
);
// A consumer must load its installed JavaScript without a workspace loader.
const { NODE_OPTIONS: _workspaceLoader, ...environment } = process.env;
environment.GOMAXPROCS = '2';
const checks: string[] = [];

function writeReport(status: 'running' | 'passed' | 'failed', error?: string) {
  fs.writeFileSync(
    path.join(evidence, 'result.json'),
    JSON.stringify({ status, node: process.version, checks, error }, null, 2),
  );
}
writeReport('running');

function run(
  name: string,
  command: string,
  args: readonly string[],
  cwd: string,
): string {
  const result = spawnSync(command, args, {
    cwd,
    env: environment,
    encoding: 'utf8',
    timeout: 600_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  fs.writeFileSync(path.join(evidence, `${name}.log`), output);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${name} failed:\n${output}`);
  checks.push(name);
  return result.stdout;
}

const harnessProbe = `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { createJobHarness } from 'clearframe/harness';
const dir = path.resolve('film');
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({
  title: 'Installed package', beats: [{ id: 'a', block: 'title', duration: 2,
    vo: 'Hello from the installed package.', props: { text: 'Package test' } }],
}));
const options = { base: process.cwd(), gate: null };
const harness = createJobHarness(options);
const request = { film: 'film', kind: 'captions', requestKey: 'package-smoke' };
let id;
try {
  ({ id } = harness.start(dir, request));
  let job;
  for (let attempt = 0; attempt < 400; attempt++) {
    job = harness.get(id);
    if (!['queued', 'waiting', 'running'].includes(job.status)) break;
    await wait(25);
  }
  assert.equal(job.status, 'complete', job.log);
  assert.match(fs.readFileSync(path.join(dir, 'build/captions.srt'), 'utf8'),
    /Hello from the installed package/);
} finally { await harness.stopAll(); }
const reopened = createJobHarness(options);
try {
  assert.equal(reopened.get(id).status, 'complete');
  assert.equal(reopened.start(dir, request).id, id);
  assert.ok(reopened.events({ jobId: id }).length >= 3);
} finally { await reopened.stopAll(); }
console.log('Installed harness completed, persisted and deduplicated a real job.');
`;

try {
  const packed = path.join(temporary, 'packed');
  fs.mkdirSync(packed);
  run(
    'pack',
    'pnpm',
    ['--filter', 'clearframe', 'pack', '--pack-destination', packed],
    workspace,
  );
  const archives = fs
    .readdirSync(packed)
    .filter((name) => name.endsWith('.tgz'));
  assert.equal(archives.length, 1, 'Packing must produce one distribution.');
  const archive = path.join(packed, archives[0]);
  fs.copyFileSync(archive, path.join(evidence, archives[0]));
  const consumer = path.join(temporary, 'consumer # %');
  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({
      name: 'clearframe-install-check',
      private: true,
      type: 'module',
      dependencies: {
        clearframe: `file:${path.relative(consumer, archive)}`,
      },
    }),
  );
  fs.writeFileSync(
    path.join(consumer, 'pnpm-workspace.yaml'),
    "allowBuilds:\n  '@opencode/cli': true\n",
  );
  run(
    'install',
    'pnpm',
    ['install', '--prod', '--no-frozen-lockfile'],
    consumer,
  );
  run(
    'frozen-install',
    'pnpm',
    ['install', '--prod', '--offline', '--frozen-lockfile'],
    consumer,
  );
  fs.copyFileSync(
    path.join(consumer, 'pnpm-lock.yaml'),
    path.join(evidence, 'consumer-pnpm-lock.yaml'),
  );
  const cli = path.join(consumer, 'node_modules/clearframe/dist/main.mjs');
  assert.match(
    run('help', process.execPath, [cli, 'help'], consumer),
    /ClearFrame/,
  );
  assert.match(
    run('blocks', process.execPath, [cli, 'blocks', '--json'], consumer),
    /"title"/,
  );
  fs.writeFileSync(path.join(consumer, 'probe.mjs'), harnessProbe);
  run('harness', process.execPath, ['probe.mjs'], consumer);
  writeReport('passed');
  console.log('Packed CLI and public harness pass a fresh external install.');
} catch (error) {
  writeReport('failed', error instanceof Error ? error.message : String(error));
  throw error;
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
