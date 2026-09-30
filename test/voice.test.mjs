// Voice takes: one continuous Gemini take per film, read as one text with one style.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTakes, takeSpec } from '../engine/lib/takes.mjs';
import { buildRequest } from '../skills/gemini-tts/scripts/tts.mjs';
import { mosaicSpec } from '../fframes/canvas.mjs';

const film = (voice = {}) => ({
  voice: { voice: 'Charon', style: 'warm, curious', wpm: 150, takes: 'film', ...voice },
  beats: [
    { id: 'a', chapter: 'one', vo: 'Seven degrees.', style: 'intrigued' },
    { id: 'b', chapter: 'two', vo: 'It is only a few degrees, right?' },
    { id: 'c', chapter: 'three', vo: 'But after sunset, it can reach seven.', style: 'slower' },
  ],
});

test('a film is one continuous take read with the film style, whatever its chapters', () => {
  const sb = film();
  const takes = planTakes(sb);
  assert.equal(takes.length, 1);
  const spec = takeSpec(sb, takes[0], 'gemini');
  assert.deepEqual(new Set(spec.parts.map(p => p.style)), new Set(['warm, curious']));
  const req = buildRequest({ parts: [{ text: spec.parts.map(p => p.text).join('\n\n'), style: spec.style }] });
  assert.equal(req.input[0].content.length, 1);
  assert.equal(req.input[0].content[0].annotations[0].style, 'warm, curious');
});

test('chapter takes and per-beat styles are still available on request', () => {
  assert.equal(planTakes(film({ takes: 'chapter' })).length, 3);
  const sb = film({ perBeatStyle: true });
  assert.equal(takeSpec(sb, planTakes(sb)[0], 'gemini').parts[0].style, 'intrigued');
});

test('mosaic specs accept the andamento, build and recolour options and reject nonsense', () => {
  const fail = m => {
    throw new Error(m);
  };
  const ok = mosaicSpec(
    {
      tile: 12,
      flow: 'contour',
      build: 'fly',
      from: [0, 0],
      glint: 0.3,
      recolor: [{ say: 'dark', fill: 'accent', share: 0.12 }],
    },
    'm',
    fail,
  );
  assert.equal(ok.flow, 'contour');
  assert.throws(() => mosaicSpec({ flow: 'spiral' }, 'm', fail), /flow/);
  assert.throws(() => mosaicSpec({ recolor: [{ fill: 'accent' }] }, 'm', fail), /say/);
  assert.throws(() => mosaicSpec({ glint: 3 }, 'm', fail), /glint/);
});
