import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { reviewProject } from '../engine/lib/review.mjs';
import { runPipeline } from '../engine/lib/pipeline.mjs';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function project(t, sb) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-pipeline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(sb));
  return root;
}

test('an explicit review directory must be fresh and cannot overwrite or delete user files', async t => {
  const root = project(t, { beats: [{ id: 'a', block: 'statement', duration: 1, props: { text: 'Example' } }] });
  const video = path.join(root, 'video.mp4'); fs.writeFileSync(video, 'fixture bytes');
  fs.writeFileSync(video + '.json', JSON.stringify({ outputSha256: sha(fs.readFileSync(video)),
    hashes: { 'storyboard.json': sha(fs.readFileSync(path.join(root, 'storyboard.json'))) }, frames: 30, fps: 30, draft: true }));
  const directory = path.join(root, 'existing'); fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'keep.txt'), 'user work');
  await assert.rejects(reviewProject(root, { video, directory }), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(directory, 'keep.txt'), 'utf8'), 'user work');
});

test('a failed production stage leaves a durable failure report with no success or video claim', async t => {
  const root = project(t, { beats: [{ id: 'a', block: 'stat', props: { value: 42 } }] });
  await assert.rejects(runPipeline(root, { noRender: true }), /Pipeline failed/);
  const runs = fs.readdirSync(path.join(root, 'build/pipeline'));
  assert.equal(runs.length, 1);
  const report = JSON.parse(fs.readFileSync(path.join(root, 'build/pipeline', runs[0], 'report.json')));
  assert.equal(report.status, 'failed');
  assert.ok(report.stages.some(s => s.status === 'failed' && Number.isFinite(s.seconds)));
  assert.equal(report.artifacts.video, undefined);
  assert.ok(fs.existsSync(path.join(report.dir, 'REPORT.md')));
});
