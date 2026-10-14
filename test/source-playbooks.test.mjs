import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { storyboardFor } from '../film/playbooks.mjs';
import { createJob } from '../film/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';

test('research and podcast examples compile to native jobs in both film shapes and retain their sample provenance', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-source-playbooks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['research-digest', 'podcast-clip']) for (const vertical of [false, true]) {
    const sb = storyboardFor(name, { vertical }), dir = path.join(root, `${name}-${vertical}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb));
    const loaded = loadStoryboard(dir), result = createJob(loaded, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, [], `${name} ${vertical ? 'vertical' : 'landscape'}`);
    assert.equal(loaded.assets.length, 0, 'the example needs no generated assets or external media');
  }
});
