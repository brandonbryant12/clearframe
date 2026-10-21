import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const runtime = new URL('../packages/engine/dist/', import.meta.url);
const moduleURL = (file) => new URL(file, runtime).href;

async function until(check, message) {
  for (let i = 0; i < 400; i++) {
    if (check()) return;
    await wait(25);
  }
  throw new Error(message());
}

function fixture(t) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cf-command-scope-')),
  );
  const children = [];
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode == null && child.signalCode == null) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {}
        await once(child, 'close');
      }
    }
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.symlinkSync(
    fileURLToPath(new URL('../packages/engine/node_modules', import.meta.url)),
    path.join(root, 'node_modules'),
    'dir',
  );
  const start = (args) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    children.push(child);
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    return { child, output: () => output, closed: once(child, 'close') };
  };
  return { root, start };
}

for (const adapter of ['process', 'renderer']) {
  test(`CLI interruption waits for the ${adapter} Effect child to stop`, async (t) => {
    const { root, start } = fixture(t);
    const worker = path.join(root, 'worker.mjs');
    const pidFile = path.join(root, 'child.pid');
    const stopped = path.join(root, 'child.stopped');
    fs.writeFileSync(
      worker,
      `
import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on('SIGTERM', () => {
  setTimeout(() => {
    fs.writeFileSync(${JSON.stringify(stopped)}, 'cleanup completed');
    process.exit(0);
  }, 150);
});
setInterval(() => {}, 1000);
`,
    );
    const runner = path.join(root, 'runner.mjs');
    const operation =
      adapter === 'process'
        ? `runCommandEffect(runCommand({ executable: process.execPath, args: [${JSON.stringify(worker)}] }).pipe(Effect.provide(NodeProcessRunnerLive)))`
        : `run(process.execPath, [${JSON.stringify(worker)}], { capture: true })`;
    fs.writeFileSync(
      runner,
      `
import * as Effect from 'effect/Effect';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { commandScope, runCommandEffect } from ${JSON.stringify(moduleURL('engine/lib/command-scope.mjs'))};
import { runCommand, NodeProcessRunnerLive } from ${JSON.stringify(moduleURL('engine/lib/process.mjs'))};
import { run } from ${JSON.stringify(moduleURL('scene/engine/commands.mjs'))};
NodeRuntime.runMain(commandScope(async () => ${operation}, (error) => error), { disableErrorReporting: true });
`,
    );
    const processRun = start([runner]);
    await until(
      () => fs.existsSync(pidFile),
      () => `The child did not start: ${processRun.output()}`,
    );
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    if (process.platform !== 'win32') {
      const group = spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], {
        encoding: 'utf8',
      });
      assert.equal(
        Number(group.stdout.trim()),
        processRun.child.pid,
        'the child must remain in the CLI process group',
      );
    }
    processRun.child.kill('SIGTERM');
    await processRun.closed;
    assert.equal(
      fs.readFileSync(stopped, 'utf8'),
      'cleanup completed',
      processRun.output(),
    );
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
}

test('viewer CLI termination closes its ledger and removes the private bridge', async (t) => {
  const { root, start } = fixture(t);
  fs.mkdirSync(path.join(root, 'films'));
  const processRun = start([
    fileURLToPath(new URL('engine/cli.mjs', runtime)),
    'viewer',
    'films',
    '--serve',
    '--no-render',
    '--port',
    '0',
  ]);
  const bridge = path.join(root, '.clearframe/agent/bridge.json');
  await until(
    () => fs.existsSync(bridge),
    () => `The viewer did not start: ${processRun.output()}`,
  );
  processRun.child.kill('SIGTERM');
  await processRun.closed;
  assert.equal(fs.existsSync(bridge), false, processRun.output());
  const db = new DatabaseSync(
    path.join(root, 'build/viewer/studio/.harness/jobs.sqlite'),
  );
  try {
    assert.equal(
      db.prepare("SELECT value FROM meta WHERE key = 'owner_pid'").get(),
      undefined,
    );
  } finally {
    db.close();
  }
});

test('harness cancellation stops an Effect child before the next queued job starts', async (t) => {
  const { root } = fixture(t);
  const { createJobHarness } = await import(moduleURL('engine/harness.mjs'));
  const project = path.join(root, 'film');
  fs.mkdirSync(project);
  fs.writeFileSync(
    path.join(project, 'storyboard.json'),
    JSON.stringify({
      title: 'Cancellation',
      beats: [
        { id: 'a', block: 'title', duration: 1, props: { text: 'Test' } },
      ],
    }),
  );
  const pidFile = path.join(root, 'child.pid');
  const events = path.join(root, 'events');
  const worker = path.join(root, 'worker.mjs');
  fs.writeFileSync(
    worker,
    `
import fs from 'node:fs';
fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
process.on('SIGTERM', () => {
  setTimeout(() => {
    fs.appendFileSync(${JSON.stringify(events)}, 'child stopped\\n');
    process.exit(0);
  }, 150);
});
setInterval(() => {}, 1000);
`,
  );
  const cli = path.join(root, 'cli.mjs');
  fs.writeFileSync(
    cli,
    `
import fs from 'node:fs';
import * as Effect from 'effect/Effect';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { commandScope, runCommandEffect } from ${JSON.stringify(moduleURL('engine/lib/command-scope.mjs'))};
import { runCommand, NodeProcessRunnerLive } from ${JSON.stringify(moduleURL('engine/lib/process.mjs'))};
NodeRuntime.runMain(commandScope(async () => {
  if (process.argv[2] === 'check') {
    fs.appendFileSync(${JSON.stringify(events)}, 'next job started\\n');
    return;
  }
  await runCommandEffect(runCommand({
    executable: process.execPath, args: [${JSON.stringify(worker)}],
  }).pipe(Effect.provide(NodeProcessRunnerLive)));
}, (error) => error), { disableErrorReporting: true });
`,
  );
  const harness = createJobHarness({ base: root, cli, gate: null });
  try {
    const first = harness.start(project, { film: 'film', kind: 'captions' });
    await until(
      () => fs.existsSync(pidFile),
      () => 'The supervised child did not start.',
    );
    const second = harness.start(project, { film: 'film', kind: 'check' });
    harness.cancel(first.id);
    await until(
      () => harness.get(second.id)?.status === 'complete',
      () => JSON.stringify(harness.list()),
    );
    assert.equal(harness.get(first.id).status, 'cancelled');
    assert.deepEqual(fs.readFileSync(events, 'utf8').trim().split('\n'), [
      'child stopped',
      'next job started',
    ]);
    const pid = Number(fs.readFileSync(pidFile, 'utf8'));
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    await harness.stopAll();
  }
});
