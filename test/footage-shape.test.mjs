// Footage with non-square pixels: the native decoder draws stored pixels, so an anamorphic clip
// would be laid out at its stored shape (a 480x360 SAR 4:3 clip shown as 4:3, not 16:9).
// Preparation refuses it with the conversion that fixes it; square footage is unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareProjectSync } from '../packages/engine/dist/film/prepare.mjs';
import {
  pixelAspect,
  probeFootage,
} from '../packages/engine/dist/film/probes.mjs';

const ffmpeg = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);

/** A 2 s clip whose stored size and sample aspect ratio are chosen, with an optional rotation. */
function clip(file, { size = '640x360', sar = '1/1', rotate = null } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
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
    ...(rotate == null ? [] : ['-metadata:s:v:0', `rotate=${rotate}`]),
    file,
  ]);
  return file;
}

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

test('the pixel aspect reads ffprobe ratios; unknown ratios count as square', () => {
  assert.equal(pixelAspect('1:1'), 1);
  assert.equal(pixelAspect('4:3'), 4 / 3);
  assert.equal(pixelAspect('8:9'), 8 / 9);
  for (const unknown of ['0:1', 'N/A', undefined, ''])
    assert.equal(pixelAspect(unknown), 1);
});

test('anamorphic footage is refused with its shape and the conversion, in blocks and plates', (t) => {
  for (const beat of [videoBeat, plateBeat]) {
    const root = project(t, beat);
    clip(path.join(root, 'clips/shot.mp4'), { size: '480x360', sar: '4/3' });
    assert.throws(
      () => prepareProjectSync(root, { draft: true }),
      (e) =>
        /non-square pixels \(sample aspect ratio 4:3: 480×360 stored, 640×360 shown\)/.test(
          e.message,
        ) &&
        /squeezed/.test(e.message) &&
        /scale=trunc\(iw\*sar\/2\)\*2:ih,setsar=1/.test(e.message) &&
        e.message.startsWith(beat.id),
      `${beat.id} refuses anamorphic footage`,
    );
  }
});

test('the suggested conversion yields footage that prepares, at its display shape', (t) => {
  const root = project(t, videoBeat);
  const source = clip(path.join(root, 'clips/source.mp4'), {
    size: '480x360',
    sar: '4/3',
  });
  ffmpeg([
    '-i',
    source,
    '-vf',
    'scale=trunc(iw*sar/2)*2:ih,setsar=1',
    '-c:a',
    'copy',
    path.join(root, 'clips/shot.mp4'),
  ]);
  const ctx = prepareProjectSync(root, { draft: true });
  assert.ok(ctx.job.frames > 0);
  const probe = JSON.parse(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height,sample_aspect_ratio',
      '-of',
      'json',
      path.join(root, 'clips/shot.mp4'),
    ]).toString(),
  ).streams[0];
  assert.deepEqual([probe.width, probe.height], [640, 360]);
});

test('square footage, tagged or rotated, prepares as before', (t) => {
  for (const options of [{}, { sar: '1/1' }, { rotate: 90 }]) {
    const root = project(t, videoBeat);
    clip(path.join(root, 'clips/shot.mp4'), options);
    const ctx = prepareProjectSync(root, { draft: true });
    assert.ok(ctx.job.frames > 0, JSON.stringify(options));
  }
  // The stage path calls the same probe: a non-square clip fails there with its element name.
  const root = project(t, videoBeat);
  const file = clip(path.join(root, 'clips/narrow.mp4'), {
    size: '640x360',
    sar: '8/9',
  });
  assert.throws(
    () => probeFootage(file, 'stage layer a', 'clips/narrow.mp4'),
    /^Error: stage layer a: footage clips\/narrow\.mp4 has non-square pixels .*stretched/,
  );
  assert.ok(probeFootage(clip(path.join(root, 'clips/ok.mp4')), 'x') > 1.9);
});
