import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { nativeJob, prepare, verifyBundle, validateProbe, measure } from '../lib.mjs';

const timing = () => ({ width: 1920, height: 1080, fps: 30, frames: 90, estimated: false,
  beats: [{ id: 'a', start: 0, end: 3, vo: { start: 0.2, end: 2, words: [{ w: 'Hello', t0: 0.5, t1: 1 }] } }] });
const spec = () => ({ version: 1, beats: { a: { layout: 'statement', headline: 'Hello', cue: 'hello' } } });
const sb = () => ({ pacing: {}, assets: [], captions: false, sources: [] });

test('keeps frame boundaries and absolute narration cue converted to local seconds', () => {
  const t = timing(); t.beats[0].start = 2; t.beats[0].end = 5; t.beats[0].vo.start = 2.2; t.beats[0].vo.end = 4; t.beats[0].vo.words[0].t0 = 2.5;
  const j = nativeJob(t, spec(), sb()); assert.equal(j.beats[0].frames, 90); assert.equal(j.beats[0].cue_seconds, 0.35);
});
test('rejects estimated narration unless explicitly sketching', () => {
  const t = timing(); t.estimated = true;
  assert.throws(() => nativeJob(t, spec(), sb()), /Record voice/);
  assert.equal(nativeJob(t, spec(), sb(), { allowEstimated: true }).estimated, true);
});
test('rejects missing cues, unsupported scenes and ignored props', () => {
  const s = spec(); s.beats.a.cue = 'missing'; assert.throws(() => nativeJob(timing(), s, sb()), /does not exist/);
  s.beats.a.cue = 'hello'; s.beats.a.layout = 'waffle'; assert.throws(() => nativeJob(timing(), s, sb()), /not auto-ported/);
  s.beats.a.layout = 'statement'; s.beats.a.glow = true; assert.throws(() => nativeJob(timing(), s, sb()), /unsupported native field/);
});
test('rejects cropped voice, unsupported formats and implicit media omissions', () => {
  const t = timing(); t.beats[0].vo.end = 4; assert.throws(() => nativeJob(t, spec(), sb()), /crosses/);
  t.beats[0].vo.end = 2; t.width = 1080; t.height = 1920; assert.throws(() => nativeJob(t, spec(), sb()), /16:9/);
  const story = sb(); story.sfx = true; assert.throws(() => nativeJob(timing(), spec(), story), /SFX/);
});
test('rejects misleading bar scales and missing sources', () => {
  const s = spec(); Object.assign(s.beats.a, { layout: 'bars', rows: [{ label: 'A', value: 20 }], max: 10 });
  assert.throws(() => nativeJob(timing(), s, sb()), /zero-based scale/);
  s.beats.a.max = 20; assert.throws(() => nativeJob(timing(), s, sb()), /source/);
});
test('video acceptance checks actual frames, canvas and fps', () => {
  const m = { width: 1920, height: 1080, fps: 30, frames: 90 };
  const probe = { streams: [{ codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30/1', nb_read_frames: '90' }] };
  validateProbe(probe, m); probe.streams[0].nb_read_frames = '89'; assert.throws(() => validateProbe(probe, m), /frame count/);
  probe.streams[0].nb_read_frames = '90'; probe.streams.push({ codec_type: 'audio' });
  assert.throws(() => validateProbe(probe, m), /one video stream and no audio/);
});
test('freeze copies inputs, rejects mutation, preserves existing folders and records command failures', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fframes-'));
  try {
    const source = path.join(tmp, 'source'), bundle = path.join(tmp, 'bundle');
    fs.mkdirSync(path.join(source, 'assets/fonts'), { recursive: true });
    fs.writeFileSync(path.join(source, 'assets/fonts/Inter.ttf'), 'fixture font');
    fs.writeFileSync(path.join(source, 'storyboard.json'), JSON.stringify({ title: 'fixture', format: { preset: 'landscape' }, music: false, captions: false, beats: [{ id: 'a', duration: 3 }] }));
    const s = spec(); delete s.beats.a.cue;
    fs.writeFileSync(path.join(source, 'fframes.json'), JSON.stringify(s));
    fs.writeFileSync(path.join(source, '.env'), 'secret');
    await prepare(source, bundle);
    assert.equal(fs.existsSync(path.join(bundle, 'browser/.env')), false);
    const first = verifyBundle(bundle);
    assert.equal(first.audio, null);
    assert.equal(first.frames, 90);
    const result = await measure({ bundle, renderer: 'fframes-metal', phase: 'cold-build', output: path.join(tmp, 'failure.json'), command: [process.execPath, '-e', 'process.exit(7)'] });
    assert.equal(result.success, false); assert.equal(result.code, 7); assert.equal(result.framesPerSecond, null);
    await assert.rejects(prepare(source, bundle), /never overwritten/);
    fs.appendFileSync(path.join(bundle, 'browser/storyboard.json'), '\n');
    assert.throws(() => verifyBundle(bundle), /Frozen input changed/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
