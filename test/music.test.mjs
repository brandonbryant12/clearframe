// Mock transport only: exercise the real request builder, generation, cache and timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateMusic } from '../skills/lyria-music/scripts/music.mjs';
import { plan, scoreMusic } from '../engine/lib/generate.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { findMusicBed, writeMusicBed } from '../engine/lib/music-files.mjs';

const audio = (mime_type = 'audio/mpeg', data = Buffer.from('ID3-mock-music').toString('base64')) => ({
  status: 'completed', steps: [{ type: 'model_output', content: [
    { type: 'text', text: 'Instrumental' }, { type: 'audio', mime_type, data },
  ] }],
});
function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-music-'));
  const sb = { title: 'Music regression', music: { prompt: 'Ambient piano', bpm: 80 }, beats: [{ id: 'one', duration: 3 }] };
  const save = () => fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(sb));
  save();
  const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'mock-key';
  t.after(() => {
    if (oldKey == null) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, sb, save };
}

test('Lyria decodes MP3 MIME aliases, rejects unknown/empty/failed responses', async t => {
  let body = audio();
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(body)));
  for (const mime of ['audio/mpeg', 'audio/mp3', undefined, 'Audio/MPEG; rate=44100']) {
    body = audio(mime);
    if (mime === undefined) delete body.steps[0].content[1].mime_type;
    const r = await generateMusic({ prompt: 'Ambient', key: 'mock-key' });
    assert.equal(r.ext, 'mp3'); assert.equal(r.data.toString(), 'ID3-mock-music');
  }
  body = audio('audio/l16');
  await assert.rejects(generateMusic({ prompt: 'Ambient', key: 'mock-key' }), /Unsupported Lyria audio MIME/);
  body = audio('audio/mpeg', '');
  await assert.rejects(generateMusic({ prompt: 'Ambient', key: 'mock-key' }), /No audio|empty audio/);
  body = { status: 'failed', steps: [] };
  await assert.rejects(generateMusic({ prompt: 'Ambient', key: 'mock-key' }), /interaction failed/);
});

test('music generation writes MP3, reuses paid cache, and regenerates missing or changed assets', async t => {
  const { root, sb, save } = project(t);
  const bodies = [];
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    bodies.push(JSON.parse(options.body));
    return new Response(JSON.stringify(audio()));
  });
  writeMusicBed(root, Buffer.from('old draft'), 'wav', { provider: 'local' });
  await scoreMusic(root);
  assert.deepEqual(bodies[0].response_format, { type: 'audio' });
  const mp3 = path.join(root, 'assets/music/bed.mp3');
  assert.equal(fs.readFileSync(mp3, 'utf8'), 'ID3-mock-music');
  assert.equal(fs.existsSync(path.join(root, 'assets/music/bed.wav')), false);
  assert.equal(computeTiming(root).music.src, 'assets/music/bed.mp3');
  assert.equal(plan(root).rows.find(r => r.kind === 'music').status, 'cached');
  await scoreMusic(root); assert.equal(bodies.length, 1);
  // Legacy metadata has no file field: don't charge again for an existing valid bed.
  const metaPath = path.join(root, 'assets/music/bed.json');
  const meta = JSON.parse(fs.readFileSync(metaPath)); delete meta.file;
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  await scoreMusic(root); assert.equal(bodies.length, 1);
  fs.rmSync(mp3);
  assert.equal(plan(root).rows.find(r => r.kind === 'music').status, 'todo');
  await scoreMusic(root); assert.equal(bodies.length, 2);
  sb.music.prompt = 'Muted strings'; save();
  const row = plan(root).rows.find(r => r.kind === 'music');
  assert.equal(row.status, 'todo'); assert.equal(row.cost, 0.08);
  await scoreMusic(root); assert.equal(bodies.length, 3);
  assert.match(bodies[2].input, /Muted strings/);
});

test('a failed paid request keeps the existing bed and metadata', async t => {
  const { root } = project(t);
  writeMusicBed(root, Buffer.from('existing bed'), 'wav', { provider: 'local' });
  const metaFile = path.join(root, 'assets/music/bed.json'), before = fs.readFileSync(metaFile, 'utf8');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { message: 'request rejected' } }), { status: 400 }));
  await assert.rejects(scoreMusic(root), /request rejected/);
  assert.equal(fs.readFileSync(path.join(root, 'assets/music/bed.wav'), 'utf8'), 'existing bed');
  assert.equal(fs.readFileSync(metaFile, 'utf8'), before);
  assert.throws(() => writeMusicBed(root, Buffer.alloc(0), 'mp3', {}), /empty/);
  assert.equal(fs.readFileSync(metaFile, 'utf8'), before);
});

test('a file-write failure keeps the existing bed and metadata', t => {
  const { root } = project(t);
  writeMusicBed(root, Buffer.from('existing bed'), 'wav', { provider: 'local' });
  const metaFile = path.join(root, 'assets/music/bed.json'), before = fs.readFileSync(metaFile, 'utf8');
  const write = fs.writeFileSync;
  t.mock.method(fs, 'writeFileSync', (file, ...args) => {
    if (String(file).includes('bed.mp3.')) throw new Error('ENOSPC: disk full');
    return write(file, ...args);
  });
  assert.throws(() => writeMusicBed(root, Buffer.from('new bed'), 'mp3', {}), /ENOSPC/);
  assert.equal(fs.readFileSync(path.join(root, 'assets/music/bed.wav'), 'utf8'), 'existing bed');
  assert.equal(fs.readFileSync(metaFile, 'utf8'), before);
});

test('timing follows recorded bed, supports legacy OGG, and keeps explicit file priority', t => {
  const { root, sb, save } = project(t);
  writeMusicBed(root, Buffer.from('active MP3'), 'mp3', { provider: 'lyria' });
  fs.writeFileSync(path.join(root, 'assets/music/bed.wav'), 'stale draft');
  assert.equal(computeTiming(root).music.src, 'assets/music/bed.mp3');
  sb.music.file = 'assets/music/bed.wav'; save();
  assert.equal(computeTiming(root).music.src, 'assets/music/bed.wav');
  delete sb.music.file; save();
  fs.rmSync(path.join(root, 'assets/music/bed.mp3'));
  assert.equal(findMusicBed(root), null, 'missing recorded file must not silently select stale draft');
  writeMusicBed(root, Buffer.from('ogg'), 'ogg', { provider: 'lyria' });
  fs.rmSync(path.join(root, 'assets/music/bed.json'));
  assert.equal(computeTiming(root).music.src, 'assets/music/bed.ogg');
});

test('music CLI applies duration and tempo with --prompt and uses the MP3 default', () => {
  const script = new URL('../skills/lyria-music/scripts/music.mjs', import.meta.url);
  const output = execFileSync(process.execPath, [script.pathname, '--prompt', 'Ambient', '--seconds', '70', '--bpm', '80', '--dry-run'], { encoding: 'utf8' });
  assert.match(output, /about 70 seconds/); assert.match(output, /80 BPM/);
  assert.doesNotMatch(output, /audio\/wav|mime_type/);
});
