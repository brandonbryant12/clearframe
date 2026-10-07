import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The library holds sources. Renders, evidence and review media belong in build/ (ignored).
// Binaries are allowed only where they are the reusable asset or a fixture.
const ALLOWED = [
  /^film\/assets\//,                        // bundled fonts and icons
  /^scene\/native\/tests\/fixtures\//,      // decoder fixtures
  /^examples\/sculptures\/[^/]+\//,         // prepared 3D clips, posters and editable scenes
  /^docs\/media\//,                         // guide illustrations
  /^docs\/design\/material-studies\/[^/]+\.png$/,
  /^archive\//,                             // retired renderer, recovery only
  /^recipes\/screen-walkthrough\/assets\//,
  /^examples\/trajectories\/[^/]+\/[^/]+\.png$/,     // source photos that ingest examples start from
];
const BINARY = /\.(png|jpe?g|gif|webp|mp4|mov|webm|mkv|wav|mp3|m4a|aac|blend|exr|vdb|zip|tar|gz)$/i;

test('binary files are limited to reusable assets and fixtures', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const stray = files.filter(f => BINARY.test(f) && !ALLOWED.some(r => r.test(f)) && fs.existsSync(f));
  assert.deepEqual(stray, [], `render or evidence files are tracked; move them to build/:\n${stray.join('\n')}`);
  const total = files.filter(f => BINARY.test(f) && fs.existsSync(f)).reduce((n, f) => n + fs.statSync(f).size, 0);
  assert.ok(total < 60 * 2 ** 20, `tracked binaries total ${(total / 2 ** 20).toFixed(1)} MB; keep the repository under 60 MB of media`);
});

test('build caches and compiler output are never tracked', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const cached = files.filter(f => /(^|\/)\.cache\/|(^|\/)target\/(release|debug)\//.test(f));
  assert.deepEqual(cached.slice(0, 5), [], `${cached.length} build-cache files are tracked; they belong in the ignored .cache/ folders`);
  // The ignore rules are checked in a scratch repository holding only this repository's tracked
  // .gitignore files: a checkout's scene/.cache may be a symlink to a shared warm cache, and git
  // will not look through a symlink. Rules only in .git/info/exclude would not reach other machines.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ignore-'));
  try {
    execFileSync('git', ['init', '-q', scratch]);
    for (const f of files.filter(f => path.basename(f) === '.gitignore')) {
      fs.mkdirSync(path.join(scratch, path.dirname(f)), { recursive: true });
      fs.copyFileSync(f, path.join(scratch, f));
    }
    for (const p of ['scene/.cache/target/release/clearframe-scene', 'scene/.cache/target/x', '.clearframe/opencode/x', 'build/x.mp4'])
      assert.doesNotThrow(() => execFileSync('git', ['-C', scratch, 'check-ignore', '-q', '--no-index', p]), `${p} must be ignored by a tracked .gitignore`);
    assert.throws(() => execFileSync('git', ['-C', scratch, 'check-ignore', '-q', '--no-index', 'film/cast.mjs']), 'sources are not ignored');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
