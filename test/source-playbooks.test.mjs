import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { storyboardFor } from '../film/playbooks.mjs';
import { sketch } from '../film/sketches.mjs';
import { normalizeElements } from '../film/canvas.mjs';
import { items } from '../film/library.mjs';
import { createJob } from '../film/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';

test('research and podcast examples compile to native jobs in both film shapes and retain their sample provenance', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-source-playbooks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const name of ['research-investigation', 'podcast-thread']) for (const vertical of [false, true]) {
    const sb = storyboardFor(name, { vertical }), dir = path.join(root, `${name}-${vertical}`);
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb));
    const loaded = loadStoryboard(dir), result = createJob(loaded, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, [], `${name} ${vertical ? 'vertical' : 'landscape'}`);
    assert.equal(loaded.assets.length, 0, 'the example needs no generated assets or external media');
    assert.deepEqual(sb.sources, items('playbooks').find(b => b.id === name).sources);
    assert.match(JSON.stringify(sb.sources), /[Ii]llustrative/);
    assert.ok(sb.beats.every(b => b.props.source), 'the sample and its limits remain visible');
  }
});

test('source drawings stay deterministic and valid for every supported frame shape', () => {
  for (const name of ['evidence-desk', 'evidence-gap', 'thread-knot', 'thread-opening'])
    for (const format of ['landscape', 'vertical', 'square', 'portrait']) {
      const props = sketch(name, format);
      assert.deepEqual(props, sketch(name, format));
      normalizeElements(props.elements, `${name}.${format}`, message => { throw new Error(message); });
      assert.doesNotMatch(JSON.stringify(props), /"(?:file|asset|material)"|#[a-f0-9]{6}/i);
      assert.ok(props.elements.some(e => e.at === 0 && e.enter === 'none'), 'the shot begins with a picture');
    }
});

test('the conversational world joins at the same point when its layout changes orientation', () => {
  const pathPoints = d => d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  for (const format of ['landscape', 'vertical', 'square', 'portrait']) {
    const first = sketch('thread-knot', format), next = sketch('thread-opening', format);
    const end = pathPoints(first.elements.find(e => e.type === 'path').d).slice(-2);
    const start = pathPoints(next.elements.find(e => e.type === 'path').d).slice(0, 2);
    assert.deepEqual(start, end, `${format}: the line must not jump when the camera moves`);
    assert.notDeepEqual(first.view, next.view, 'the reframe finds a new part of the same drawing');
    assert.ok(next.elements.some(e => e.type === 'meter'), 'audio activity comes from the recorded or generated narration');
  }
});
