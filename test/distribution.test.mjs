import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('the assembled CLI runs from outside the workspace with its bundled modules', (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'clearframe CLI # '));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  const entry = fileURLToPath(
    new URL('../apps/cli/dist/main.mjs', import.meta.url),
  );
  const result = spawnSync(process.execPath, [entry, 'help'], {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /ClearFrame/);
  assert.match(result.stdout, /render/);
});
