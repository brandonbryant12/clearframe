// What a person pointed at, in the cut they watched, as exact words of the recording. Each word
// of an imported recording has an identity: its index in the source transcript. Cuts, splits,
// merges, shifted times, undo and restore never change it, and two passages with the same
// wording never share it. So a note or a time in an old revision is resolved to identities,
// and the film as it is now is searched for those, never for the same text.
import fs from 'node:fs';
import { loadRevision } from './revisions.mjs';
import { objectFile } from './store.mjs';
import { hashOf } from './util.mjs';
import { anchorAt } from './anchor.mjs';
import { isRecorded, keptWords, sentenceAround, ensureTranscript, slicePieces } from './recording.mjs';

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

// ------------------------------------------------------------------ what a keep protects

/**
 * What a revision played of the recording, beat by beat: {beat: {words: [transcript index],
 * spans: [[from, to] source samples]}}, limited to `beats` (null: every recorded beat). A keep
 * protects exactly this, whatever the beats are called later (splits, merges) or wherever they
 * sit in time. Projects without an imported recording have nothing here.
 */
export function protectedSource(root, revision, beats = null) {
  const { meta, timeline } = loadRevision(root, revision);
  const stored = rel => {
    const o = meta.inputs?.[rel];
    const file = o && objectFile(root, o);
    return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  };
  let transcript = stored('source/words.json');
  if (!transcript) {
    if (!fs.existsSync(`${root}/source/recording.wav`)) return {};
    transcript = ensureTranscript(root);
  }
  const out = {};
  for (const b of timeline.beats) {
    if (beats && !beats.includes(b.id)) continue;
    const m = stored(`assets/vo/${b.id}.json`);
    if (!isRecorded(m)) continue;
    out[b.id] = {
      words: keptWords(m, transcript).map(w => w.index),
      spans: slicePieces(m, { rate: transcript.rate, fps: timeline.fps })
        .filter(p => p.pad == null)
        .map(p => [p.from, p.to]),
    };
  }
  return out;
}

/** What the film plays now: kept transcript words, source pieces, and removal records with who made them. */
export function currentSource(root) {
  const sb = JSON.parse(fs.readFileSync(`${root}/storyboard.json`, 'utf8'));
  if (!fs.existsSync(`${root}/source/recording.wav`)) return { words: new Set(), spans: [], removals: [] };
  const transcript = ensureTranscript(root),
    fps = sb.format?.fps ?? 30;
  const words = new Set(),
    spans = [],
    removals = [];
  for (const b of sb.beats) {
    let m = null;
    try {
      m = JSON.parse(fs.readFileSync(`${root}/assets/vo/${b.id}.json`, 'utf8'));
    } catch {}
    // A beat plays its recording only while its text still matches it (an edited vo plays nothing).
    if (!isRecorded(m) || m.textHash !== hashOf(b.vo ?? '')) continue;
    for (const w of keptWords(m, transcript)) words.add(w.index);
    for (const p of slicePieces(m, { rate: transcript.rate, fps })) if (p.pad == null) spans.push([p.from, p.to]);
    for (const r of m.source.removed ?? []) removals.push({ id: r.id, samples: r.samples, by: r.by ?? null, beat: b.id });
  }
  return { words, spans, removals, transcript };
}

/** Parts of [from, to] not covered by any of `spans`. */
export function uncovered([from, to], spans) {
  const out = [];
  let at = from;
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (b <= at) continue;
    if (a >= to) break;
    if (a > at) out.push([at, Math.min(a, to)]);
    at = Math.max(at, b);
    if (at >= to) break;
  }
  if (at < to) out.push([at, to]);
  return out;
}
