import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyAssets } from './shared.mjs';

test('distributions copy reusable assets without local credentials or generated example media', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clearframe-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  for (const file of [
    'storyboard.json',
    '.env',
    '.env.local',
    'assets/take.wav',
    'review/notes.json',
    'build/video.mp4',
    'native/main.rs',
    'helper.mts',
  ]) {
    const target = path.join(source, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file);
  }
  const example = path.join(root, 'example');
  copyAssets(source, example, { omitDirectories: ['assets', 'review'] });
  assert.deepEqual(fs.readdirSync(example).sort(), [
    'native',
    'storyboard.json',
  ]);
  assert.equal(
    fs.readFileSync(path.join(example, 'native/main.rs'), 'utf8'),
    'native/main.rs',
  );
  const reusable = path.join(root, 'reusable');
  copyAssets(path.join(source, 'assets'), reusable);
  assert.equal(
    fs.readFileSync(path.join(reusable, 'take.wav'), 'utf8'),
    'assets/take.wav',
  );
});
