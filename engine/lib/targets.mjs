// What a person pointed at, in the cut they watched, as exact words of the recording. Each word
// of an imported recording has an identity: its index in the source transcript. Cuts, splits,
// merges, shifted times, undo and restore never change it, and two passages with the same
// wording never share it. So a note or a time in an old revision is resolved to identities,
// and the film as it is now is searched for those, never for the same text.
import fs from 'node:fs';
import { loadRevision } from './revisions.mjs';
import { objectFile } from './store.mjs';
import { anchorAt } from './notes.mjs';
import { isRecorded, keptWords, sentenceAround, ensureTranscript } from './recording.mjs';

/** A revision's recorded words in film order: [{beat, k, index, w, t0, t1}] (film clock). */
export function revisionWords(root, revision) {
  const { meta, timeline } = loadRevision(root, revision);
  const stored = rel => {
    const o = meta.inputs?.[rel];
    const file = o && objectFile(root, o);
    return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };
  // The transcript never changes once written; a revision made before it existed reads today's.
  const transcript = stored('source/words.json') ?? ensureTranscript(root);
  const out = [];
  for (const b of timeline.beats) {
    const m = stored(`assets/vo/${b.id}.json`);
    if (!isRecorded(m) || !b.words.length) continue;
    const kept = keptWords(m, transcript);
    if (kept.length !== b.words.length)
      throw new Error(`${revision}: the words of ${b.id} do not match its recording; they cannot be identified safely.`);
    b.words.forEach((w, k) => out.push({ beat: b.id, k, index: kept[k].index, w: w.w, t0: w.t0, t1: w.t1 }));
  }
  return out;
}

/**
 * The sentence under a note's anchor (or a time) in the revision it was made on, as transcript
 * identities. Range notes cover several sentences: name the words instead.
 */
export function sentenceAt(root, { revision, anchor }) {
  if (anchor.to != null) throw new Error('A range note covers more than one sentence: name the words to cut with --words.');
  const words = revisionWords(root, revision);
  const mine = words.map((w, i) => [w, i]).filter(([w]) => w.beat === anchor.beat);
  if (!mine.length) throw new Error(`${anchor.beat} has no recorded words in ${revision}; nothing to cut there.`);
  // The word under the playhead, else the next one in that beat, else its last (as the note quoted).
  const [, at] = mine.find(([w]) => anchor.at >= w.t0 && anchor.at < w.t1) ?? mine.find(([w]) => w.t0 >= anchor.at) ?? mine.at(-1);
  const [a, b] = sentenceAround(words, at);
  const span = words.slice(a, b + 1);
  return { source: span.map(w => w.index), text: span.map(w => w.w).join(' '), beats: [...new Set(span.map(w => w.beat))], revision };
}

/** The sentence spoken at `at` seconds into a revision. */
export function sentenceAtTime(root, { revision, at }) {
  return sentenceAt(root, { revision, anchor: anchorAt(loadRevision(root, revision).timeline, at) });
}
