// Time-bug QA and the beat map: the rules on synthetic signals, and a drop landed on a beat.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { timeFindings, deliveryFindings } from '../engine/lib/qa.mjs';
import { findDrop, findTempo, cutsOnGrid } from '../engine/lib/beatmap.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';

test('qa finds a one-frame pop, a jumping world seam and a held stretch under the voice', () => {
  const fps = 30,
    n = 300;
  const d = Array(n).fill(3),
    skip = Array(n).fill(3),
    second = Array(n).fill(20);
  // A pop at frame 40: it differs from both neighbours, which agree.
  d[40] = 30;
  d[41] = 30;
  skip[40] = 0.5;
  // A world cut at frame 150 that should be invisible but jumps.
  d[150] = 40;
  // Frames 200–299 barely change, under narration.
  for (let i = 200; i < n; i++) second[i] = 0.5;
  const beats = [
    { id: 'a', start: 0, end: 5 },
    { id: 'b', start: 5, end: 10, vo: { start: 5.2, end: 9.8 } },
  ];
  const f = timeFindings({ d, skip, second, fps, beats, worlds: { a: 'city', b: 'city' } });
  assert.ok(f.some(x => x.kind === 'pop' && x.frame === 40 && x.level === 'error'));
  assert.ok(f.some(x => x.kind === 'seam' && x.beat === 'b'));
  const held = f.find(x => x.kind === 'held');
  assert.ok(held && held.level === 'warn' && held.seconds >= 3, JSON.stringify(held));
  // A flash transition is several frames long: not a pop.
  const d2 = Array(n).fill(3),
    skip2 = Array(n).fill(3);
  d2[40] = d2[44] = 60;
  assert.ok(!timeFindings({ d: d2, skip: skip2, second, fps, beats }).some(x => x.kind === 'pop'));
});

test('qa reads the export the way a platform does', () => {
  const v = {
    codec_type: 'video',
    width: 1920,
    height: 1080,
    avg_frame_rate: '30/1',
    nb_frames: '90',
    pix_fmt: 'yuv420p',
    color_range: 'tv',
    color_space: 'smpte170m',
    sample_aspect_ratio: '496:495',
  };
  const f = deliveryFindings({ streams: [v] }, { fps: 30, frames: 90, width: 1920, height: 1080 });
  assert.ok(f.some(x => x.level === 'error' && /pixel aspect/.test(x.message)));
  assert.ok(f.some(x => /primaries untagged/.test(x.message)));
  const ok = deliveryFindings(
    { streams: [{ ...v, sample_aspect_ratio: '1:1', color_primaries: 'bt709', color_transfer: 'bt709' }] },
    { fps: 30, frames: 90, width: 1920, height: 1080 },
  );
  assert.deepEqual(ok, []);
});

test('beat map: the drop where the bass jumps and stays, tempo from onsets, cuts against the grid', () => {
  // 20 ms windows: quiet bass for 8 s, then loud.
  const bass = Float64Array.from({ length: 1000 }, (_, i) => (i < 400 ? 1e-5 : 1e-2));
  assert.deepEqual(findDrop(bass), { t: 8, jump: 30 });
  assert.equal(findDrop(Float64Array.from({ length: 1000 }, () => 1e-3)), null);
  // Onsets every 0.5 s (5 ms hop), with weaker off-beats: 120 BPM, not 240.
  const on = Float64Array.from({ length: 4000 }, (_, i) => (i % 100 === 0 ? 10 : i % 100 === 50 ? 3 : 0));
  const t = findTempo(on);
  assert.equal(t.bpm, 120);
  assert.ok(t.alternatives.includes(60));
  const cuts = cutsOnGrid(
    [
      { id: 'a', start: 0 },
      { id: 'b', start: 2.02 },
      { id: 'c', start: 3.3 },
    ],
    { bpm: 120, phase: 0 },
  );
  assert.deepEqual(
    cuts.map(c => c.ms),
    [20, -200],
  );
});

test('music.drop starts the song so its measured drop plays on the chosen beat', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-drop-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'assets/music'), { recursive: true });
  // 12 s: a quiet tick until 6 s, then a loud low pulse.
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    "aevalsrc=exprs='if(lt(t,6),0.05*sin(2*PI*900*t)*exp(-40*mod(t,0.5)),0.7*sin(2*PI*55*t))':s=16000:d=12",
    path.join(root, 'assets/music/track.wav'),
  ]);
  const sb = {
    title: 'Drop',
    music: { file: 'assets/music/track.wav', drop: { beat: 'title' } },
    beats: [
      { id: 'tease', duration: 2 },
      { id: 'build', duration: 2.5 },
      { id: 'title', duration: 3 },
    ],
  };
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(sb));
  const m = computeTiming(root).music;
  assert.equal(m.drop.film, 4.5);
  assert.ok(Math.abs(m.drop.song - 6) < 0.05, `drop measured at ${m.drop.song}`);
  assert.ok(Math.abs(m.offset - 1.5) < 0.05);
  // A drop later in the film than in the song delays the song.
  sb.music.drop = { beat: 'title', song: 3 };
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(sb));
  assert.equal(computeTiming(root).music.offset, -1.5);
});
