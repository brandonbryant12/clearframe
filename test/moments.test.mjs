// Named moments: one event, many responses, retimed together with their sounds.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveMoments, momentSpec } from '../film/moments.mjs';
import { createJob } from '../film/production.mjs';
import { soundDesign } from '../film/sound.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const words = { lands: 1.4, rings: 2.2 };
const word = w => { if (!(w in words)) throw new Error(`Spoken cue "${w}" not found`); return words[w]; };

test('moments resolve words, seconds and chains; loops, unknown names and late moments are refused', () => {
  const t = resolveMoments({ LAND: 'lands', RING: { cue: 'LAND', after: 0.3 }, EARLY: { cue: 'LAND', after: -0.2 }, OPEN: { at: 0.5 } }, { word, dur: 6 });
  assert.equal(t.get('LAND'), 1.4);
  assert.ok(Math.abs(t.get('RING') - 1.7) < 1e-9 && Math.abs(t.get('EARLY') - 1.2) < 1e-9);
  assert.equal(t.get('OPEN'), 0.5);
  assert.throws(() => resolveMoments({ A: { cue: 'B' }, B: { cue: 'A', after: 1 } }, { word, dur: 6 }), /moments loop: A → B → A/);
  assert.throws(() => momentSpec({ A: { cue: 'NOPE' } }), /names no moment of this beat \(A\)/);
  assert.throws(() => momentSpec({ A: { say: 'lands', at: 1 } }), /exactly one of/);
  assert.throws(() => resolveMoments({ A: 'missing' }, { word, dur: 6 }), /not found/);
  assert.throws(() => resolveMoments({ A: { at: 7 } }, { word, dur: 6 }), /after the beat ends/);
});

function job(t, vo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-moments-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), {
    version: 2, title: 'Moments', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false, sfx: 'normal',
    beats: [{ id: 'land', block: 'canvas', vo, props: {
      moments: { LAND: 'lands', SETTLE: { cue: 'LAND', after: 0.4 } },
      elements: [
        // The step is there from the cut, so the picture keeps pace with the voice before the landing.
        { id: 'step', type: 'rect', x: 600, y: 700, w: 600, h: 24, fill: 'ink', at: 0, enter: 'none' },
        { id: 'box', type: 'rect', x: 800, y: 500, w: 200, h: 200, fill: 'accent', cue: 'LAND', sound: 'thud',
          keys: [{ cue: 'LAND', after: -0.1, dur: 0.1, scaleY: 0.8 }, { cue: 'SETTLE', dur: 0.3, scaleY: 1, sound: 'tick' }] },
        { id: 'ring', type: 'circle', cx: 900, cy: 600, r: 160, fill: 'none', stroke: 'accent', width: 4, cue: 'LAND', after: 0.05, exitCue: 'SETTLE', exitAfter: 0.5 },
        { id: 'word', type: 'text', text: 'Landed', x: 900, y: 860, size: 60, anchor: 'middle', cue: 'SETTLE' },
      ] } }],
  });
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}

test('every response lands on its moment, and moves with it (sounds included) when the word moves', t => {
  const early = job(t, 'The parcel lands on the step and the bell rings once.');
  const late = job(t, 'After a long and careful journey across the whole city the parcel finally lands, and the bell rings once.');
  for (const { errors } of [early, late]) assert.deepEqual(errors, []);
  const parts = j => {
    const els = Object.fromEntries(j.job.beats[0].props.elements.map(e => [e.id, e]));
    return { els, land: els.box.at };
  };
  const a = parts(early), b = parts(late);
  for (const { els, land } of [a, b]) {
    assert.ok(Math.abs(els.box.keys[0].at - (land - 0.1)) < 1e-9, 'a negative after anticipates the moment');
    assert.ok(Math.abs(els.box.keys[1].at - (land + 0.4)) < 1e-9, 'a chained moment follows its parent');
    assert.ok(Math.abs(els.ring.at - (land + 0.05)) < 1e-9 && Math.abs(els.ring.exitAt - (land + 0.9)) < 1e-9);
    assert.ok(Math.abs(els.word.at - (land + 0.4)) < 1e-9, 'text on a moment takes it exactly (no word lead)');
    assert.equal(els.box.cue, undefined, 'the job carries seconds, not names');
  }
  assert.ok(b.land - a.land > 1, 'a later word moves the moment');
  const sounds = j => soundDesign(j.job, 'normal').filter(c => ['thud', 'tick'].includes(c.name)).map(c => [c.name, +c.t.toFixed(3)]);
  assert.deepEqual(sounds(early), [['thud', +a.land.toFixed(3)], ['tick', +(a.land + 0.4).toFixed(3)]]);
  assert.deepEqual(sounds(late), [['thud', +b.land.toFixed(3)], ['tick', +(b.land + 0.4).toFixed(3)]], 'the sounds move with the picture');
});

test('an element naming an undeclared moment is refused, and an unused moment is reported', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-moments-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sb = { version: 2, title: 'Moments', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false,
    beats: [{ id: 'a', block: 'canvas', vo: 'It lands here.', props: { moments: { LAND: 'lands', SPARE: { at: 0.4 } },
      elements: [{ type: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'accent', cue: 'LANDS' }] } }] };
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  const { errors } = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  assert.match(errors.join('\n'), /cue "LANDS" names no moment \(this beat's moments: LAND, SPARE\)/);
  sb.beats[0].props.elements[0].cue = 'LAND';
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  const ok = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  assert.deepEqual(ok.errors, []);
  assert.match(ok.warnings.join('\n'), /moment SPARE is named but nothing lands on it/);
});

function build(t, beat) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-moments-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), { version: 2, title: 'Moments', format: { preset: 'landscape', fps: 30 }, theme: 'paper', captions: false, music: false, sfx: 'normal', beats: [beat] });
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}

test('pacing never moves a drawing off its named moment; the empty opening is reported instead', t => {
  // Codex's reproduction: LAND at 2 s, the box and its ring both on LAND, nothing earlier.
  const r = build(t, { id: 'a', block: 'canvas', vo: 'The parcel travels across the entire city and finally lands here.',
    props: { moments: { LAND: { at: 2 } }, elements: [
      { id: 'box', type: 'rect', x: 500, y: 400, w: 200, h: 200, fill: 'accent', cue: 'LAND', sound: 'thud' },
      { id: 'ring', type: 'circle', cx: 600, cy: 500, r: 140, fill: 'none', stroke: 'accent', cue: 'LAND', after: 0.05 }] } });
  assert.deepEqual(r.errors, []);
  const els = Object.fromEntries(r.job.beats[0].props.elements.map(e => [e.id, e]));
  assert.equal(els.box.at, 2, 'the box keeps its moment');
  assert.ok(Math.abs(els.ring.at - 2.05) < 1e-9, 'and its ring still lands with it');
  assert.match(r.warnings.join('\n'), /empty scene before the first drawing, which lands on a named moment and keeps its time/);
  assert.doesNotMatch(r.warnings.join('\n'), /pulled the first drawing/);
  assert.deepEqual(soundDesign(r.job, 'normal').filter(c => c.name === 'thud').map(c => c.t), [2], 'the sound stays on the event');
});

test('moment names are own properties, nested and stepped elements share the event clock, and a late key is refused', t => {
  assert.throws(() => momentSpec({ A: { cue: 'constructor' } }), /cue "constructor" names no moment of this beat \(A\)/);
  assert.throws(() => momentSpec({ A: { cue: 'toString', after: 1 } }), /names no moment/);
  const vo = 'The parcel lands on the step and the bell rings once.';
  const ground = { id: 'step', type: 'rect', x: 600, y: 700, w: 600, h: 24, fill: 'ink', at: 0, enter: 'none' };
  const r = build(t, { id: 'a', block: 'canvas', vo, props: { moments: { LAND: 'lands' }, elements: [ground,
    { id: 'g', type: 'group', at: 0, enter: 'none', children: [{ id: 'inner', type: 'circle', cx: 900, cy: 600, r: 40, fill: 'accent', cue: 'LAND' }] },
    { id: 'drawn', type: 'rect', x: 100, y: 100, w: 80, h: 80, fill: 'accent2', fps: 12, cue: 'LAND', sound: 'tick' }] } });
  assert.deepEqual(r.errors, []);
  const els = r.job.beats[0].props.elements, land = els.find(e => e.id === 'drawn').at;
  assert.equal(els.find(e => e.id === 'g').children[0].at, land, 'a child in a group lands on the same moment');
  // A drawing on twelves shows the moment on its next drawing, and its sound plays on that drawing.
  const tick = soundDesign(r.job, 'normal').find(c => c.name === 'tick').t;
  assert.ok(Math.abs(tick - Math.ceil(land * 12 - 1e-6) / 12) < 1e-6 && tick >= land);
  const late = build(t, { id: 'a', block: 'canvas', vo, props: { moments: { LAND: 'lands' }, elements: [ground,
    { id: 'box', type: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'accent', cue: 'LAND', keys: [{ cue: 'LAND', after: 9, dur: 0.3, x: 40 }] }] } });
  assert.match(late.errors.join('\n'), /keys\[0\] lands at .* \(moment LAND \+ 9 s\), after the beat ends/);
});
