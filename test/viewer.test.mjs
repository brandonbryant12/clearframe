import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildViewer, saveNote, fileType } from '../engine/lib/viewer.mjs';

const clip = (file, size = '320x568') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=navy:s=${size}:d=1`, '-f', 'lavfi', '-i', 'sine=d=1', '-shortest', '-pix_fmt', 'yuv420p', file]);
  assert.equal(r.status, 0, String(r.stderr));
};
const dataOf = file => JSON.parse(fs.readFileSync(file, 'utf8').match(/<script id="data" type="application\/json">(.*?)<\/script>/s)[1]);

test('every kind of file gets a preview type', () => {
  for (const [f, t] of [['a.png', 'image'], ['logo.svg', 'svg'], ['x.mov', 'video'], ['bed.wav', 'audio'], ['Face.otf', 'font'], ['notes.md', 'text'], ['brief.pdf', 'document'], ['scene.blend', 'model'], ['fire.vdb', 'model'], ['thing.xyz', 'other']])
    assert.equal(fileType(f), t, f);
});

test('the viewer lists ClearFrame and outside films with versions, scenes, lanes, files and fonts', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-viewer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const native = path.join(root, 'films', 'quarterly');
  clip(path.join(native, 'build/video.mp4'));
  fs.writeFileSync(path.join(native, 'storyboard.json'), JSON.stringify({ version: 2, title: 'Quarterly <review>', format: { preset: 'vertical' }, beats: [{ id: 'a' }, { id: 'b' }] }));
  const outside = path.join(root, 'films', 'reel');
  clip(path.join(outside, 'versions/v1.mp4')); clip(path.join(outside, 'versions/v2.mp4'));
  fs.mkdirSync(path.join(outside, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(outside, 'brand/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  fs.copyFileSync('fframes/assets/fonts/Inter-Regular.ttf', path.join(outside, 'Face-Bold.ttf'));
  fs.writeFileSync(path.join(outside, 'film.json'), JSON.stringify({ title: 'Reel', versions: [{ id: 'v1', file: 'versions/v1.mp4' }, { id: 'v2', file: 'versions/v2.mp4', label: 'Final cut' }],
    scenes: [{ start: 0, end: 1, kind: 'Hero', elements: [{ text: 'WIN', font: 'Face-Bold.ttf', box: [10, 10, 100, 40], at: 0.2 }] }],
    lanes: { sfx: [{ t: 0.5, name: 'Boom' }] }, fonts: [{ file: 'Face-Bold.ttf', used: ['Slogan'] }] }));
  const out = path.join(root, 'viewer');
  const r = await buildViewer({ root: [path.join(root, 'films')], out, render: false });
  assert.equal(r.films, 2); assert.equal(r.versions, 3);
  const data = dataOf(r.file);
  const q = data.films.find(f => f.title === 'Quarterly <review>'), reel = data.films.find(f => f.title === 'Reel');
  assert.equal(q.shape, 'tall'); assert.equal(q.versions[0].video, '../films/quarterly/build/video.mp4');
  assert.ok(fs.existsSync(path.join(out, q.versions[0].poster)), 'a poster frame is extracted');
  assert.equal(reel.kind, 'external'); assert.equal(reel.versions.at(-1).label, 'Final cut');
  const scene = reel.versions.at(-1).scenes[0], font = data.library.fonts.find(f => f.id === scene.elements[0].font);
  assert.equal(font.family, 'Face'); assert.deepEqual(font.uses, ['Slogan']);
  assert.deepEqual(reel.versions.at(-1).lanes.sfx, [{ t: 0.5, name: 'Boom' }]);
  assert.ok(reel.files.some(f => f.type === 'svg') && reel.files.some(f => f.type === 'font'), 'vector art and fonts are listed as files');
  assert.ok(!reel.files.some(f => f.name.startsWith('versions/')), 'version videos are not repeated as files');
  const css = fs.readFileSync(path.join(out, 'fonts.css'), 'utf8');
  assert.match(css, new RegExp(`font-family:"${font.id}";src:url\\(data:font/ttf;base64,`));
  const html = fs.readFileSync(r.file, 'utf8');
  assert.ok(!html.includes('Quarterly <review>'), 'titles are escaped inside the embedded data');
  assert.ok(data.library.charts.every(c => c.image === null), 'no renders when render is off');
});

test('notes on an outside film are saved beside it with their pin', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-notes-'));
  fs.writeFileSync(path.join(dir, 'film.json'), JSON.stringify({ versions: [] }));
  const n = saveNote(dir, { version: 'v2', at: 3.5, text: 'Tighter cut here', by: 'Ana', element: 'win', pin: { x: .4, y: .6 } });
  assert.equal(n.id, 'n001');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'notes.json'))).notes[0].pin, { x: .4, y: .6 });
  assert.throws(() => saveNote(dir, { version: 'v2', at: 1, text: ' ' }), /needs text/);
  assert.throws(() => saveNote(dir, { version: 'v2', at: 1, text: 'x', pin: { x: 2, y: 0 } }), /pin/);
  fs.rmSync(dir, { recursive: true, force: true });
});
