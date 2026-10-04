import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

// The library holds sources. Renders, evidence and review media belong in build/ (ignored).
// Binaries are allowed only where they are the reusable asset or a fixture.
const ALLOWED = [
  /^fframes\/assets\//,                     // bundled fonts and icons
  /^fframes\/native\/tests\/fixtures\//,    // decoder fixtures
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
