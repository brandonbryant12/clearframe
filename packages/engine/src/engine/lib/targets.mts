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
import { isRecord } from './errors.mjs';
import { decodeStoryboard } from '../schemas.mjs';
import {
  isRecorded,
  keptWords,
  sentenceAround,
  ensureTranscript,
  slicePieces,
} from './recording.mjs';
import { decodeTranscript, voMetaOrNull } from './recording-model.mjs';
import type { RevisionMeta } from './revisions.mjs';
import type {
  EditAuthor,
  Piece,
  RecordedMeta,
  Transcript,
} from './recording.mjs';

/** A recorded word of a revision in film order, with its transcript identity. */
export interface RevisionWord {
  beat: string;
  k: number;
  index: number;
  w: string;
  t0: number;
  t1: number;
}
/** Transcript identities of a sentence, its text, and the beats it spans. */
export interface SentenceTarget {
  source: number[];
  text: string;
  beats: string[];
  revision: string;
}
/** What a revision played of the recording, per beat: transcript words and source sample spans. */
export interface ProtectedSource {
  [beatId: string]: { words: number[]; spans: number[][] };
}
export interface CurrentRemoval {
  id: string;
  samples: number[];
  by: EditAuthor | null;
  beat: string;
}
export interface CurrentBeat {
  id: string;
  meta: RecordedMeta;
  spans: number[][];
}
export interface CurrentSource {
  words: Set<number>;
  spans: number[][];
  removals: CurrentRemoval[];
  beats: CurrentBeat[];
  transcript?: Transcript;
  fps: number;
}

const samplesOf = (pieces: Piece[]): number[][] =>
  pieces.flatMap((p) => ('pad' in p ? [] : [[p.from, p.to]]));

/** A revision's stored input, parsed (null when it has none). */
function storedInput(root: string, meta: RevisionMeta, rel: string): unknown {
  const o = meta.inputs?.[rel];
  const file = o && objectFile(root, o);
  return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
function storedTranscript(root: string, meta: RevisionMeta): Transcript | null {
  const raw = storedInput(root, meta, 'source/words.json');
  return raw == null ? null : decodeTranscript(raw);
}

/** A revision's recorded words in film order: [{beat, k, index, w, t0, t1}] (film clock). */
export function revisionWords(root: string, revision: string): RevisionWord[] {
  const { meta, timeline } = loadRevision(root, revision);
  // The transcript never changes once written; a revision made before it existed reads today's.
  const transcript = storedTranscript(root, meta) ?? ensureTranscript(root);
  const out: RevisionWord[] = [];
  for (const b of timeline.beats) {
    const m = voMetaOrNull(storedInput(root, meta, `assets/vo/${b.id}.json`));
    if (!isRecorded(m) || !b.words.length) continue;
    const kept = keptWords(m, transcript);
    if (kept.length !== b.words.length)
      throw new Error(
        `${revision}: the words of ${b.id} do not match its recording; they cannot be identified safely.`,
      );
    b.words.forEach((w, k) =>
      out.push({
        beat: b.id,
        k,
        index: kept[k].index,
        w: w.w,
        t0: w.t0,
        t1: w.t1,
      }),
    );
  }
  return out;
}

/**
 * The sentence under a note's anchor (or a time) in the revision it was made on, as transcript
 * identities. Range notes cover several sentences: name the words instead.
 */
export function sentenceAt(
  root: string,
  {
    revision,
    anchor,
  }: { revision: string; anchor: { to?: number; beat: string; at: number } },
): SentenceTarget {
  if (anchor.to != null)
    throw new Error(
      'A range note covers more than one sentence: name the words to cut with --words.',
    );
  const words = revisionWords(root, revision);
  const mine = words
    .map((w, i): [RevisionWord, number] => [w, i])
    .filter(([w]) => w.beat === anchor.beat);
  if (!mine.length)
    throw new Error(
      `${anchor.beat} has no recorded words in ${revision}; nothing to cut there.`,
    );
  // The word under the playhead, else the next one in that beat, else its last (as the note quoted).
  const [, at] =
    mine.find(([w]) => anchor.at >= w.t0 && anchor.at < w.t1) ??
    mine.find(([w]) => w.t0 >= anchor.at) ??
    mine[mine.length - 1];
  const [a, b] = sentenceAround(words, at);
  const span = words.slice(a, b + 1);
  return {
    source: span.map((w) => w.index),
    text: span.map((w) => w.w).join(' '),
    beats: [...new Set(span.map((w) => w.beat))],
    revision,
  };
}

/** The sentence spoken at `at` seconds into a revision. */
export function sentenceAtTime(
  root: string,
  { revision, at }: { revision: string; at: number },
): SentenceTarget {
  return sentenceAt(root, {
    revision,
    anchor: anchorAt(loadRevision(root, revision).timeline, at),
  });
}

// ------------------------------------------------------------------ what a keep protects

/**
 * What a revision played of the recording, beat by beat: {beat: {words: [transcript index],
 * spans: [[from, to] source samples]}}, limited to `beats` (null: every recorded beat). A keep
 * protects exactly this, whatever the beats are called later (splits, merges) or wherever they
 * sit in time. Projects without an imported recording have nothing here.
 */
export function protectedSource(
  root: string,
  revision: string,
  beats: string[] | null = null,
): ProtectedSource {
  const { meta, timeline } = loadRevision(root, revision);
  let transcript = storedTranscript(root, meta);
  if (!transcript) {
    if (!fs.existsSync(`${root}/source/recording.wav`)) return {};
    transcript = ensureTranscript(root);
  }
  const out: ProtectedSource = {};
  for (const b of timeline.beats) {
    if (beats && !beats.includes(b.id)) continue;
    const m = voMetaOrNull(storedInput(root, meta, `assets/vo/${b.id}.json`));
    if (!isRecorded(m)) continue;
    out[b.id] = {
      words: keptWords(m, transcript).map((w) => w.index),
      spans: samplesOf(
        slicePieces(m, { rate: transcript.rate, fps: timeline.fps }),
      ),
    };
  }
  return out;
}

/**
 * The recording a revision played: the SHA-256 of its source/recording.wav, read from the
 * stored object's name (revisions saved before the master was tracked: its recorded digest).
 */
export function revisionMaster(root: string, revision: string): string | null {
  const { meta } = loadRevision(root, revision);
  const object = meta.inputs?.['source/recording.wav'];
  if (object)
    return /\/([0-9a-f]{64})(?:\.[a-z0-9]+)?$/.exec(object)?.[1] ?? null;
  const record = storedInput(root, meta, 'source/recording.json');
  return isRecord(record) && typeof record.sha256 === 'string'
    ? record.sha256
    : null;
}

function beatMeta(root: string, id: string): RecordedMeta | null {
  try {
    const m = voMetaOrNull(
      JSON.parse(fs.readFileSync(`${root}/assets/vo/${id}.json`, 'utf8')),
    );
    return isRecorded(m) ? m : null;
  } catch {
    return null;
  }
}

/**
 * What the film plays now, as its metadata declares it: kept transcript words, source pieces
 * (all, and per beat with the beat's metadata), and removal records.
 */
export function currentSource(root: string): CurrentSource {
  const sb = decodeStoryboard(
    JSON.parse(fs.readFileSync(`${root}/storyboard.json`, 'utf8')),
  );
  const fps = sb.format?.fps ?? 30;
  if (!fs.existsSync(`${root}/source/recording.wav`))
    return { words: new Set(), spans: [], removals: [], beats: [], fps };
  const transcript = ensureTranscript(root);
  const words = new Set<number>(),
    spans: number[][] = [],
    removals: CurrentRemoval[] = [],
    beats: CurrentBeat[] = [];
  for (const b of sb.beats) {
    const m = beatMeta(root, b.id);
    // A beat plays its recording only while its text still matches it (an edited vo plays nothing).
    if (!m || m.textHash !== hashOf(b.vo ?? '')) continue;
    for (const w of keptWords(m, transcript)) words.add(w.index);
    const own = samplesOf(slicePieces(m, { rate: transcript.rate, fps }));
    spans.push(...own);
    beats.push({ id: b.id, meta: m, spans: own });
    for (const r of m.source.removed ?? [])
      removals.push({
        id: r.id,
        samples: r.samples,
        by: r.by ?? null,
        beat: b.id,
      });
  }
  return { words, spans, removals, beats, transcript, fps };
}

/** Parts of [from, to] not covered by any of `spans`. */
export function uncovered([from, to]: number[], spans: number[][]): number[][] {
  const out: number[][] = [];
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
