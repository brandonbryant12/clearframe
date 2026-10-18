import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { snapshot, attachVideo, updateRevision } from '../engine/lib/revisions.mjs';
import { exportHandoff, verifyHandoff } from '../engine/lib/handoff.mjs';
import { sha256File } from '../engine/lib/store.mjs';

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-handoff-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storyboard = {
    format: { width: 640, height: 360, fps: 30 }, theme: 'paper', sfx: false,
    beats: [{ id: 'a', block: 'statement', duration: 2, props: { text: 'A clear owner' } }],
  };
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(storyboard));
  const { revision } = await snapshot(root);
  return { root, revision, storyboard };
}

test('handoff exports saved inputs and verified retained delivery after the working copy changes', async t => {
  const { root, revision, storyboard } = await fixture(t);
  // Deliberately opaque bytes: packaging verifies identity, not MP4 decoding.
  const video = path.join(root, 'saved.mp4');
  fs.writeFileSync(video, 'retained-video-bytes');
  const receipt = { outputSha256: sha256File(video), inputId: revision.inputId, frames: 60, encoder: 'fixture' };
  attachVideo(root, revision.id, { file: video, receipt, profile: 'final' });
  fs.writeFileSync(path.join(root, 'storyboard.json'), '{}');
  fs.writeFileSync(path.join(root, '.env'), 'UNRELATED=do-not-export');
  fs.writeFileSync(path.join(root, 'saved.mp4'), 'a later video');
  const result = exportHandoff(root);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.directory, 'project/storyboard.json'))), storyboard);
  assert.equal(fs.readFileSync(path.join(result.directory, 'delivery/video.mp4'), 'utf8'), 'retained-video-bytes');
  assert.equal(fs.existsSync(path.join(result.directory, 'project/.env')), false);
  assert.equal(result.delivery.profile, 'final');
  assert.equal(verifyHandoff(result.directory).delivery, true);
  assert.throws(() => exportHandoff(root), /already exists/);
  fs.appendFileSync(path.join(result.directory, 'project/storyboard.json'), ' ');
  assert.throws(() => verifyHandoff(result.directory), /file changed/);
});

test('handoff reports absent video, rejects damaged objects, and leaves no partial destination', async t => {
  const { root, revision } = await fixture(t);
  const first = exportHandoff(root, { out: path.join(root, 'first') });
  assert.equal(first.delivery, null);
  assert.ok(first.warnings.some(w => /no retained video/.test(w)));
  fs.chmodSync(path.join(root, revision.inputs['storyboard.json']), 0o644);
  fs.writeFileSync(path.join(root, revision.inputs['storyboard.json']), 'damaged');
  const out = path.join(root, 'bad');
  assert.throws(() => exportHandoff(root, { out }), /damaged/);
  assert.equal(fs.existsSync(out), false);
  assert.equal(fs.readdirSync(root).some(f => f.startsWith('.cf-handoff-')), false);
});

test('handoff refuses a receipt for a different revision input identity', async t => {
  const { root, revision } = await fixture(t);
  const video = path.join(root, 'video.mp4');
  fs.writeFileSync(video, 'retained');
  attachVideo(root, revision.id, { file: video, profile: 'final', receipt: { outputSha256: sha256File(video), inputId: 'wrong' } });
  assert.throws(() => exportHandoff(root), /identities do not agree/);
  // An unsafe path in a stored record cannot write outside the staging project.
  updateRevision(root, revision.id, m => { m.inputs = { '../escape': m.inputs['storyboard.json'] }; });
  assert.throws(() => exportHandoff(root), /outside the project/);
});
