// Captions to a broadcast standard: segmentation, line breaks and timing from measured words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { captionCues, captionLines, toSRT } from '../engine/lib/timing.mjs';

/** Words spoken at an even pace (0.3 s a word, a longer gap after each sentence). */
function timed(text, start = 0) {
  let t = start;
  return text.split(' ').map(w => {
    const word = { w, t0: t, t1: t + 0.26 };
    t += /[.!?]$/.test(w) ? 0.65 : 0.3;
    return word;
  });
}
const film = (beats, size = { width: 1920, height: 1080 }) => ({ fps: 30, ...size, beats });

test('captions hold a sentence each, in two balanced lines that never end on a leaning word', () => {
  const words = timed(
    'Between August 4th and August 19th, the shares in the portfolio fell 6.4 percent. So the next day, the committee rebalanced, buying shares after the drop. Same medical.',
  );
  const cues = captionCues(film([{ start: 0, end: 30, vo: { words } }]));
  for (const c of cues) {
    assert.ok(c.lines.length <= 2 && c.lines.every(l => l.length <= 42), JSON.stringify(c.lines));
    assert.ok(!c.lines.some(l => /\b(the|of|to|a|and)$/i.test(l)), `a line ends on a leaning word: ${JSON.stringify(c.lines)}`);
  }
  assert.ok(cues.some(c => c.text === 'Same medical.'), 'a short sentence keeps its own caption');
  assert.ok(!cues.some(c => /percent\. So/.test(c.text)), 'sentences are not run together');
  assert.deepEqual(captionLines('Your employer adds 4% when you save 5%.'.split(' ')), ['Your employer adds 4% when you save 5%.'], 'one line when it fits');
});

test('captions stay up long enough to read, 2 frames apart, and end at the cut', () => {
  const beats = [
    { start: 0, end: 2, vo: { words: timed('Yes.', 0.1) } },
    { start: 2, end: 6, vo: { words: timed('Next year is a copy of this one. Same dental.', 2.05) } },
  ];
  const cues = captionCues(film(beats));
  for (const [i, c] of cues.entries()) {
    const beat = beats.find(b => c.start >= b.start && c.start < b.end);
    assert.ok(c.end <= beat.end + 1e-9, 'never across a cut');
    assert.ok(c.end - c.start >= 5 / 6 - 1e-9 || cues[i + 1]?.start - c.end <= 2 / 30 + 1e-9 || c.end === beat.end, `${c.text} is too short to read`);
    if (cues[i + 1]) assert.ok(cues[i + 1].start - c.end >= 2 / 30 - 1e-9, 'two frames between captions');
  }
  assert.match(toSRT(cues), /\n.+\n/, 'sidecars carry the same lines');
});

test('a vertical frame keeps captions narrower', () => {
  const words = timed('Your welcome email has a temporary password, so sign in to Harbor Hub and change it.');
  const cues = captionCues(film([{ start: 0, end: 10, vo: { words } }], { width: 1080, height: 1920 }));
  assert.ok(cues.every(c => c.lines.every(l => l.length <= 28)), JSON.stringify(cues.map(c => c.lines)));
});
