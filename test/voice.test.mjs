// Voice takes: one continuous Gemini take per film, read as one text with one style.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planTakes, snapToPauses, takeSpec } from '../engine/lib/takes.mjs';
import { buildRequest } from '../skills/gemini-tts/scripts/tts.mjs';
import { mosaicSpec } from '../film/canvas.mjs';

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

test('a draft take records again when its respellings or speed change; a real take does not', () => {
  const spec = (voice, provider) => JSON.stringify(takeSpec(film(voice), planTakes(film(voice))[0], provider));
  assert.notEqual(spec({}, 'local'), spec({ pronounce: { Seven: 'Sev-en' } }, 'local'));
  assert.notEqual(spec({}, 'local'), spec({ wpm: 170 }, 'local'));
  assert.equal(spec({}, 'gemini'), spec({ pronounce: { Seven: 'Sev-en' }, wpm: 170 }, 'gemini'));
});

test('a take is cut in the pause between lines even when a short first word is misplaced across it', () => {
  // Alignment put "And new" before the pause; the voice said them after it.
  const per = [
    { start: 0.2, end: 2.9, words: [{ w: 'families', t0: 2.4, t1: 2.9 }] },
    { start: 2.95, end: 5, words: [{ w: 'And', t0: 2.95, t1: 3.02 }, { w: 'new', t0: 3.02, t1: 3.1 }, { w: 'this', t0: 3.8, t1: 4 }, { w: 'year', t0: 4, t1: 4.4 }] },
  ];
  const [a, b] = snapToPauses(per, [{ start: 0.2, end: 3.1 }, { start: 3.52, end: 5 }]);
  assert.equal(a.end, 3.1);
  assert.equal(b.start, 3.52);
  assert.ok(b.words[0].t0 >= 3.52 && b.words[0].estimated && b.words[1].estimated);
  assert.equal(b.words[2].t0, 3.8, 'a word the alignment placed well keeps its time');
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
