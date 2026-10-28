// Footage with non-square pixels prepares like any other: the native decoder reads the sample
// aspect ratio and draws each clip at its display shape (its geometry is tested in the scene
// crate, `anamorphic_footage_decodes_at_its_display_shape`). Preparation only measures duration.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareProjectSync } from '../packages/engine/dist/film/prepare.mjs';
import { probeFootage } from '../packages/engine/dist/film/probes.mjs';

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

/** A 2 s clip with a chosen stored size and sample aspect ratio, optionally rotated. */
function clip(file, { size = '640x360', sar = '1/1', rotation = null } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const stored = `${file}.stored.mp4`;
  ffmpeg([
    '-f',
    'lavfi',
    '-i',
    `testsrc2=s=${size}:r=30:d=2`,
    '-vf',
    `setsar=${sar}`,
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    stored,
  ]);
  // A display matrix is the rotation players honour (`-metadata rotate=` writes none in FFmpeg 8).
  ffmpeg([
    ...(rotation == null ? [] : ['-display_rotation:v:0', String(rotation)]),
    '-i',
    stored,
    '-c',
    'copy',
    file,
  ]);
  fs.rmSync(stored);
  return file;
}

const rotationOf = (file) =>
  execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream_side_data=rotation',
    '-of',
    'csv=p=0',
    file,
  ])
    .toString()
    .trim();

function project(t, beat) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cf-footage-shape-')),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify({
      format: { width: 640, height: 360, fps: 30 },
      beats: [beat],
    }),
  );
  return root;
}

const videoBeat = {
  id: 'shot',
  block: 'video',
  duration: 1,
  props: { file: 'clips/shot.mp4' },
};
const plateBeat = {
  id: 'street',
  block: 'statement',
  duration: 1,
  plate: { file: 'clips/shot.mp4', side: 'right' },
  props: { text: 'Every morning' },
};

test('square, anamorphic and rotated footage prepare in blocks and plates', (t) => {
  const shapes = [
    {},
    { sar: '1/1' },
    { size: '480x360', sar: '4/3' },
    { size: '640x360', sar: '8/9' },
    { size: '480x360', sar: '4/3', rotation: 90 },
  ];
  for (const beat of [videoBeat, plateBeat])
    for (const shape of shapes) {
      const root = project(t, beat);
      const file = clip(path.join(root, 'clips/shot.mp4'), shape);
      if (shape.rotation)
        assert.equal(rotationOf(file), '90', 'the fixture really is rotated');
      const ctx = prepareProjectSync(root, { draft: true });
      assert.ok(ctx.job.frames > 0, `${beat.id} ${JSON.stringify(shape)}`);
    }
});

test('the footage probe measures duration', (t) => {
  const root = project(t, videoBeat);
  const duration = probeFootage(
    clip(path.join(root, 'clips/a.mp4'), { size: '480x360', sar: '4/3' }),
  );
  assert.ok(Math.abs(duration - 2) < 0.1, String(duration));
});
