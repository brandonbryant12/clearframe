import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('measured rates and sound caches survive a change of working directory', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clearframe-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, 'cache');
  const first = path.join(root, 'first');
  const second = path.join(root, 'second');
  fs.mkdirSync(first);
  fs.mkdirSync(second);
  const rates = new URL(
    '../packages/engine/dist/engine/lib/voice-rates.mjs',
    import.meta.url,
  ).href;
  const sounds = new URL(
    '../packages/engine/dist/engine/lib/sfx.mjs',
    import.meta.url,
  ).href;
  const env = { ...process.env, CLEARFRAME_CACHE: cache };
  delete env.CF_VOICE_RATES;
  delete env.CF_SFX_CACHE;
  const run = (cwd, code) =>
    JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', code], {
        cwd,
        env,
        encoding: 'utf8',
      }),
    );
  const recorded = run(
    first,
    `const {recordRate}=await import(${JSON.stringify(rates)}); console.log(JSON.stringify(recordRate({model:'fixture',voice:'reader'},'One two three four five six seven eight nine ten.',4)));`,
  );
  const recovered = run(
    second,
    `const {measuredRate}=await import(${JSON.stringify(rates)}); const {SFX_DIR}=await import(${JSON.stringify(sounds)}); console.log(JSON.stringify({rate:measuredRate({model:'fixture',voice:'reader'}),sounds:SFX_DIR}));`,
  );
  assert.ok(recorded > 0);
  assert.equal(recovered.rate, recorded);
  assert.equal(recovered.sounds, path.join(cache, 'sfx'));
  assert.ok(fs.existsSync(path.join(cache, 'voice-rates.json')));
  assert.deepEqual(fs.readdirSync(first), []);
  assert.deepEqual(fs.readdirSync(second), []);
});
