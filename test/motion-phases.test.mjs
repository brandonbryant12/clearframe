import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { motionManifest, planClipRetiming } from '../engine/lib/motion-phases.mjs';
import { sculptureConfig, sculptures } from '../engine/lib/sculptures.mjs';

// A gate that holds closed, opens, then holds open: the shape of any declared phase contract.
const GATE = { version: 1, clock: 'qualitative-pose', phases: [
  { id: 'closed', role: 'hold', start: 0, end: 0.2, minSeconds: 0 },
  { id: 'opening', role: 'action', start: 0.2, end: 0.65, minSeconds: 0.25 },
  { id: 'hold', role: 'hold', start: 0.65, end: 1, minSeconds: 0.5 }] };
const gate = ({ fps = 24, phaseSeconds, duration = 4 } = {}) => {
  const seconds = phaseSeconds && typeof phaseSeconds === 'object' && !Array.isArray(phaseSeconds) ? Object.values(phaseSeconds).reduce((a, b) => a + b, 0) : duration;
  return { frames: Math.round(seconds * fps), motion: motionManifest(GATE, { frames: Math.round(seconds * fps), fps, loop: false, phaseSeconds }) };
};

test('phase manifests preserve the old pose clock and expose exact half-open holds', () => {
  for (const recipe of sculptures()) {
    const c = sculptureConfig(recipe.id, { fps: 24 });
    assert.deepEqual(c.motion.poseSamples, Array.from({ length: c.frames + 1 }, (_, i) => i / c.frames));
    assert.equal(c.motion.phases[0].startFrame, 0);
    assert.equal(c.motion.phases.at(-1).endFrame, c.frames);
    assert.equal(c.motion.loopIntent, recipe.loop);
  }
  const m = gate({ fps: 24 }).motion;
  assert.deepEqual(m.phases.map(p => [p.id, p.startFrame, p.endFrame]), [['closed', 0, 20], ['opening', 20, 63], ['hold', 63, 96]]);
  assert.equal(m.poseSamples[62] < .65, true);
  assert.equal(m.poseSamples[63] >= .65, true);
  assert.equal(sculptureConfig('petal-reveal').motion.safeTrimWindows.length, 0);
});

test('named phase retiming quantizes cue boundaries', () => {
  const seconds = { closed: 1, opening: 1, hold: 2 };
  const c = gate({ fps: 12, phaseSeconds: seconds });
  assert.equal(c.frames, 48);
  assert.deepEqual(c.motion.phases.map(p => [p.startFrame, p.endFrame]), [[0, 12], [12, 24], [24, 48]]);
  assert.equal(c.motion.poseSamples[12], .2);
  assert.ok(Math.abs(c.motion.poseSamples[18] - .425) < 1e-12);
  assert.equal(c.motion.poseSamples[24], .65);
  assert.equal(c.motion.poseSamples[48], 1);
  for (const phaseSeconds of [{ closed: 1, opening: 1 }, { ...seconds, typo: 1 }, { ...seconds, hold: '2' }, [], null, { closed: .001, opening: 1, hold: 2 }])
    assert.throws(() => gate({ fps: 12, phaseSeconds }));
  assert.throws(() => gate({ phaseSeconds: { closed: 1, opening: 1, hold: .1 } }), /too short/);
});

test('encoded frame plans retain all action, minimum holds and exact selected source times', () => {
  const m = gate({ fps: 12, phaseSeconds: { closed: 1, opening: 1, hold: 2 } }).motion;
  const normal = planClipRetiming(m);
  assert.deepEqual(normal.sourceFrames, Array.from({ length: 48 }, (_, i) => i));
  const slower = planClipRetiming(m, { startFrame: 6, endFrame: 42, rate: .5, outputFps: 24, readHoldSeconds: 3 });
  assert.equal(slower.outputFrames, 144);
  assert.deepEqual(slower.sourceFrames.slice(0, 8), [6, 6, 6, 6, 7, 7, 7, 7]);
  assert.equal(slower.sourceFrames.at(-1), 41);
  assert.equal(slower.sourceSeconds[0], .5);
  assert.equal(slower.phases.at(-1).duration, 3);
  assert.equal(slower.loopIntent, false);
  assert.throws(() => planClipRetiming(m, { startFrame: 15 }), /declared hold/);
  assert.throws(() => planClipRetiming(m, { startFrame: 30 }), /remove opening/);
  assert.throws(() => planClipRetiming(m, { endFrame: 8 }), /remove opening/);
  assert.throws(() => planClipRetiming(m, { rate: 4, readHoldSeconds: 1 }), /reading hold/);
  assert.throws(() => planClipRetiming(m, { rate: -1 }), /rate/);
  assert.throws(() => planClipRetiming({ ...m, poseSamples: [0, 1] }), /differs/);
  const loop = sculptureConfig('petal-reveal').motion;
  assert.equal(planClipRetiming(loop).loopIntent, true);
  assert.throws(() => planClipRetiming(loop, { startFrame: 1 }), /declared hold/);
  assert.throws(() => planClipRetiming(loop, { readHoldSeconds: 1 }), /reading hold/);
});

test('malformed phase partitions are rejected before preparing outputs', () => {
  const original = GATE;
  for (const mutate of [c => { c.phases[0].id = undefined; }, c => { c.phases[1].start = .21; }, c => { c.phases[2].id = 'closed'; }, c => { c.phases[2].end = .99; }, c => { c.phases[1].minSeconds = -1; }, c => { c.phases[1].role = 'cycle'; }]) {
    const c = structuredClone(original); mutate(c);
    assert.throws(() => motionManifest(c, { frames: 48, fps: 12, loop: false }));
  }
});

test('the sculpture CLI retimes a recipe with a declared phase contract', () => {
  const seconds = { question: 1, insertion: 1, answer: 2 };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-phase-cli-'));
  const file = path.join(dir, 'timing.json'); fs.writeFileSync(file, JSON.stringify(seconds));
  const result = spawnSync(process.execPath, ['engine/cli.mjs', 'sculpture', 'gap-bridge', '--fps', '12', '--phase-seconds', file, '--dry-run'], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).motion.phases.map(p => [p.id, p.startFrame, p.endFrame]), [['question', 0, 12], ['insertion', 12, 24], ['answer', 24, 48]]);
});
