// Recording edits: cut words, sentences and pauses out of an imported recording, split and
// merge its beats, and undo any of it. A beat's audio is a declared view of the untouched
// master (source/recording.wav): its frame-aligned span minus removed sample ranges, rebuilt
// from the master on every change. So an edit can be undone exactly, and measured word
// timings stay measured: kept words move by exact sample counts, nothing is re-estimated.
// Removals sit inside pauses and are whole frames long, so beats still tile the timeline.
import fs from 'node:fs';
import path from 'node:path';
import { parsePCM, readPCM } from './levels.mjs';
import { hashOf, pcmToWav, round } from './util.mjs';
import { audioHash, wordKey } from './word-timing.mjs';
import { checkId, nextId, readJSONFile, reviewPath, sha256, sha256File, withLock, writeJSONAtomic } from './store.mjs';

export const SOURCE = 'source/recording.wav';
const RAMP = 0.004; // seconds faded at each join, inside the pause, so a join never clicks

const metaPath = (root, id) => path.join(root, 'assets', 'vo', `${checkId('beat', id)}.json`);
const wavPath = (root, id) => path.join(root, 'assets', 'vo', `${checkId('beat', id)}.wav`);
const readStoryboard = root => readJSONFile(path.join(root, 'storyboard.json'));
const readMeta = (root, id) => readJSONFile(metaPath(root, id), null);
/** A beat that replays a slice of the ingested recording. */
export const isRecorded = meta => meta?.provider === 'imported' && meta?.source?.file === SOURCE;
const sentenceEnd = w => /[.!?]["')\]”’]*$/.test(w);

// ------------------------------------------------------------------ the source

export function loadSource(root) {
  const file = path.join(root, SOURCE);
  if (!fs.existsSync(file))
    throw new Error('No source/recording.wav: recording edits work on projects made with ingest --audio.');
  const bytes = fs.readFileSync(file);
  const { rate, pcm } = parsePCM(bytes, SOURCE);
  return { file, rate, pcm, samples: pcm.length / 2, sha: sha256(bytes) };
}

/**
 * The master as it is: its SHA-256, and whether source/recording.json (written at ingest)
 * still describes it. Every beat is rebuilt from this file, so a replaced master is caught
 * by its bytes, even when its record was left as it was.
 */
export function masterState(root, sha) {
  const file = path.join(root, SOURCE);
  if (!fs.existsSync(file)) return { sha: null, recorded: null, problem: 'source/recording.wav is missing' };
  sha ??= sha256File(file);
  const recorded = readJSONFile(path.join(root, 'source', 'recording.json'), null)?.sha256 ?? null;
  return {
    sha,
    recorded,
    problem: recorded && recorded !== sha ? 'source/recording.wav does not match source/recording.json: the recording was replaced or damaged' : null,
  };
}

/**
 * The recording's transcript on its own clock (seconds into source/recording.wav). Ingest
 * writes it with each beat's share; a project ingested before that is rebuilt once from its
 * still-unedited beat metadata.
 */
export function ensureTranscript(root) {
  const file = path.join(root, 'source', 'words.json');
  const existing = readJSONFile(file, null);
  if (existing) return existing;
  const sb = readStoryboard(root),
    fps = sb.format?.fps ?? 30;
  const beats = sb.beats.map(b => ({ b, meta: readMeta(root, b.id) })).filter(x => isRecorded(x.meta));
  if (!beats.length) throw new Error('No beat replays source/recording.wav; nothing to edit.');
  if (beats.some(x => x.meta.source.removed?.length))
    throw new Error('source/words.json is missing but beats were already edited; restore it from a revision.');
  const { rate, samples } = loadSource(root);
  const offset = Math.min(...beats.map(x => x.meta.source.start));
  const words = [];
  for (const { b, meta } of beats) {
    const f0 = Math.round((meta.source.start - offset) * fps),
      f1 = Math.round((meta.source.end - offset) * fps),
      start = f0 / fps,
      i0 = words.length;
    for (const w of meta.words ?? [])
      words.push({
        w: w.w,
        t0: round(start + w.t0, 4),
        t1: round(start + w.t1, 4),
        ...(b.speaker ? { speaker: b.speaker } : {}),
        ...(meta.alignment?.kind === 'measured' ? {} : { estimated: true }),
      });
    meta.source = { ...meta.source, offset, fps, span: [f0, f1], words: [i0, words.length] };
    writeJSONAtomic(metaPath(root, b.id), meta);
  }
  const transcript = { version: 1, file: SOURCE, rate, fps, offset, duration: round(samples / rate, 4), words };
  writeJSONAtomic(file, transcript);
  if (!fs.existsSync(path.join(root, 'source', 'recording.json')))
    writeJSONAtomic(path.join(root, 'source', 'recording.json'), {
      file: SOURCE,
      input: (sb.sources?.find(s => s.id === 'recording')?.title ?? '').replace(/^Recording:\s*/, '') || null,
      offset,
      rate,
      duration: transcript.duration,
      sha256: sha256File(path.join(root, SOURCE)),
      note: 'Rebuilt from beat metadata; offset is where this file starts in the original recording.',
    });
  return transcript;
}

/** Samples per frame; ingest resamples to 48 kHz, which every supported frame rate divides. */
function framing(meta, rate, fps) {
  if (meta.source.fps != null && meta.source.fps !== fps)
    throw new Error(`Beat audio was cut at ${meta.source.fps} fps; the film is now ${fps} fps. Re-ingest at this rate.`);
  const spf = rate / fps;
  if (!Number.isInteger(spf)) throw new Error(`A ${rate} Hz recording does not divide into ${fps} fps frames.`);
  return spf;
}

/** The beat's span on the source clock, in frames: [first, end). */
export function spanFrames(meta, fps) {
  if (Array.isArray(meta.source.span)) return meta.source.span;
  const offset = meta.source.offset ?? 0;
  return [Math.round((meta.source.start - offset) * fps), Math.round((meta.source.end - offset) * fps)];
}

/** What the slice plays, in order: source sample ranges and inserted silence. */
export function slicePieces(meta, { rate, fps }) {
  const spf = framing(meta, rate, fps),
    [f0, f1] = spanFrames(meta, fps);
  let pos = f0 * spf;
  const end = f1 * spf,
    pieces = [];
  for (const r of [...(meta.source.removed ?? [])].sort((x, y) => x.samples[0] - y.samples[0])) {
    const [a, b] = r.samples;
    if (!(a >= pos && b <= end && b > a)) throw new Error(`Removal ${r.id} lies outside its beat or overlaps another.`);
    if (a > pos) pieces.push({ from: pos, to: a });
    if (r.pad) pieces.push({ pad: r.pad });
    pos = b;
  }
  if (end > pos) pieces.push({ from: pos, to: end });
  const length = pieces.reduce((n, p) => n + (p.pad ?? p.to - p.from), 0);
  if (length % spf) throw new Error('A beat slice must last a whole number of frames.');
  return pieces;
}

/** Film-relative segments of a slice mapped to the source clock: [{at, from, to}] seconds. */
export function sourceSegments(meta, { rate, fps }) {
  let at = 0;
  const out = [];
  for (const p of slicePieces(meta, { rate, fps })) {
    const n = p.pad ?? p.to - p.from;
    if (p.pad == null) out.push({ at: round(at / rate, 6), from: round(p.from / rate, 6), to: round(p.to / rate, 6) });
    at += n;
  }
  return out;
}

const removedAt = (meta, sample) => (meta.source.removed ?? []).find(r => sample >= r.samples[0] && sample < r.samples[1]);

/**
 * The beat's words that still play, on the source clock, with their transcript index (their
 * identity: it never changes through cuts, splits, merges, undo or restore). Metadata written
 * before beats recorded their share of the transcript is read by its span instead (such beats
 * had nothing cut).
 */
export function keptWords(meta, transcript) {
  const rate = transcript.rate;
  if (!meta.source.words) {
    const fps = meta.source.fps ?? transcript.fps ?? 30;
    const [f0, f1] = spanFrames({ source: { ...meta.source, offset: meta.source.offset ?? transcript.offset ?? 0 } }, fps);
    return transcript.words
      .map((w, index) => ({ ...w, index }))
      .filter(w => (w.t0 + w.t1) / 2 >= f0 / fps && (w.t0 + w.t1) / 2 < f1 / fps);
  }
  const [i0, i1] = meta.source.words;
  const out = [];
  for (let k = i0; k < i1; k++) {
    const w = transcript.words[k];
    if (!removedAt(meta, Math.round(((w.t0 + w.t1) / 2) * rate))) out.push({ ...w, index: k });
  }
  return out;
}

/**
 * The samples a beat's slice holds: its pieces of the master in order, inserted silence, and
 * fades at the joins removals made. A pure function of the master and the metadata.
 */
export function slicePCM(meta, src, fps) {
  const { rate, pcm } = src,
    pieces = slicePieces(meta, { rate, fps });
  const length = pieces.reduce((n, p) => n + (p.pad ?? p.to - p.from), 0);
  const out = Buffer.alloc(length * 2);
  const ramp = Math.round(RAMP * rate);
  let at = 0;
  const placed = [];
  for (const [i, p] of pieces.entries()) {
    if (p.pad == null) {
      const avail = Math.max(0, Math.min(p.to, src.samples) - p.from);
      if (avail > 0) pcm.copy(out, at * 2, p.from * 2, (p.from + avail) * 2);
      // Fade only at joins made by a removal: the beat's own edges stay bit-exact.
      const n = p.to - p.from,
        r = Math.min(ramp, n >> 1);
      if (i > 0) for (let s = 0; s < r; s++) scale(out, at + s, s / r);
      if (i < pieces.length - 1) for (let s = 0; s < r; s++) scale(out, at + n - 1 - s, s / r);
      placed.push({ ...p, at });
    }
    at += p.pad ?? p.to - p.from;
  }
  return { out, placed, length };
}

/**
 * Whether a beat's WAV holds exactly the samples its metadata declares from the master
 * (`src`, from loadSource): null when it does, otherwise what is wrong. The metadata alone
 * says what a beat should play; this checks what it does play.
 */
export function sliceProblem(root, id, meta, src, fps) {
  const rel = `assets/vo/${id}.wav`,
    file = wavPath(root, id);
  if (!fs.existsSync(file)) return `${rel} is missing`;
  let actual, expected;
  try {
    actual = readPCM(file);
  } catch {
    return `${rel} is not 16-bit mono PCM audio`;
  }
  try {
    expected = slicePCM(meta, src, fps).out;
  } catch (e) {
    return e.message;
  }
  return actual.rate === src.rate && actual.pcm.equals(expected) ? null : `${rel} does not hold the samples of source/recording.wav its metadata declares`;
}

/** Rebuild a beat's WAV, words, text and alignment from the master and its removals. */
function rebuild(root, id, meta, src, transcript, fps) {
  const { rate } = src;
  const { out, placed, length } = slicePCM(meta, src, fps);
  fs.writeFileSync(wavPath(root, id), pcmToWav(out, { sampleRate: rate }));
  const duration = length / rate;
  const kept = keptWords(meta, transcript);
  const words = kept.map(w => {
    const mid = Math.round(((w.t0 + w.t1) / 2) * rate),
      p = placed.find(x => mid >= x.from && mid < x.to) ?? placed.at(-1);
    const shift = (p.at - p.from) / rate;
    return {
      w: w.w,
      t0: round(Math.max(0, w.t0 + shift), 4),
      t1: round(Math.min(duration, w.t1 + shift), 4),
    };
  });
  for (let k = 0; k < words.length; k++) {
    if (k && words[k].t0 < words[k - 1].t1) words[k].t0 = words[k - 1].t1;
    if (words[k].t1 <= words[k].t0) words[k].t1 = round(words[k].t0 + 0.01, 4);
  }
  const text = words.map(w => w.w).join(' ');
  const estimated = kept.filter(w => w.estimated).length;
  const was = meta.alignment ?? {};
  const measured = was.kind === 'measured' && !estimated;
  Object.assign(meta, {
    textHash: hashOf(text),
    text,
    duration,
    words,
    alignment: {
      kind: measured ? 'measured' : 'estimated',
      provider: String(was.provider ?? 'imported-transcript').replace(/ \(source edit\)$/, '') + ' (source edit)',
      audioHash: audioHash(wavPath(root, id)),
      ...(estimated ? { interpolatedWords: estimated } : {}),
    },
  });
  writeJSONAtomic(metaPath(root, id), meta);
  return { text, duration, words };
}
function scale(buf, sample, k) {
  const off = sample * 2;
  if (off < 0 || off + 2 > buf.length) return;
  buf.writeInt16LE(Math.round(buf.readInt16LE(off) * k), off);
}

// ------------------------------------------------------------------ planning removals

/**
 * A removal around words i..j of a beat: from inside the pause before them to inside the pause
 * after, a whole number of frames long, kept clear of other words and earlier removals.
 * Returns {samples: [a, b], pad} or null when the words cannot be cut without touching others.
 */
export function planRemoval({ kept, i, j, span, removed = [], rate, fps }) {
  const spf = rate / fps,
    clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const [S, E] = [span[0] / fps, span[1] / fps];
  const ends = removed.map(r => r.samples[1] / rate).filter(t => t <= kept[i].t0 + 1e-9);
  const starts = removed.map(r => r.samples[0] / rate).filter(t => t >= kept[j].t1 - 1e-9);
  const lo1 = Math.max(i > 0 ? kept[i - 1].t1 : S, ...ends),
    hi1 = kept[i].t0;
  const lo2 = kept[j].t1,
    hi2 = Math.min(j < kept.length - 1 ? kept[j + 1].t0 : E, ...starts);
  if (hi1 < lo1 - 1e-9 || hi2 < lo2 - 1e-9) return null;
  // Keep half of each surrounding pause; at a beat edge, take the edge pause too.
  const a0 = i > 0 ? (lo1 + hi1) / 2 : lo1,
    b0 = j < kept.length - 1 ? (lo2 + hi2) / 2 : hi2;
  const mLo = Math.max(1, Math.ceil((lo2 - hi1) * fps - 1e-6)),
    mHi = Math.floor((hi2 - lo1) * fps + 1e-6);
  if (mHi >= mLo) {
    const m = clamp(Math.round((b0 - a0) * fps), mLo, mHi),
      L = m / fps;
    const as = Math.round(clamp(a0, Math.max(lo1, lo2 - L), Math.min(hi1, hi2 - L)) * rate);
    return { samples: [as, as + m * spf], pad: 0 };
  }
  // Pauses shorter than a frame: cut around the words and pad the join with under a frame of
  // silence, so the beat still lasts whole frames.
  const as = Math.round(clamp(a0, lo1, hi1) * rate),
    bs = Math.round(clamp(b0, lo2, hi2) * rate);
  const m = Math.floor((bs - as) / spf);
  return m < 1 ? null : { samples: [as, bs], pad: bs - as - m * spf };
}

/** Shorten a pause [g0, g1] (seconds) to about `keep` seconds; whole frames, centred. */
export function planPause(g0, g1, keep, { rate, fps }) {
  const frame = 1 / fps,
    L = Math.floor((g1 - g0 - keep) / frame + 1e-9) * frame;
  if (L < frame) return null;
  const as = Math.round((g0 + (g1 - g0 - L) / 2) * rate);
  return { samples: [as, as + Math.round(L * fps) * (rate / fps)], pad: 0 };
}

// ------------------------------------------------------------------ operations

function context(root) {
  const sb = readStoryboard(root),
    fps = sb.format?.fps ?? 30;
  const transcript = ensureTranscript(root);
  const src = loadSource(root);
  // Beats are rebuilt from the master: never from one that is not the recording ingested.
  const { problem } = masterState(root, src.sha);
  if (problem) throw new Error(`${problem}. Recording edits rebuild beats from it, so nothing was changed; restore it from a revision (restore DIR rNNN).`);
  if (src.rate !== transcript.rate) throw new Error('source/recording.wav does not match source/words.json.');
  const beats = sb.beats.map((b, index) => ({ b, index, meta: readMeta(root, b.id) }));
  return { sb, fps, transcript, src, beats };
}

/** Recorded words of the film in order: [{beat, k (index among the beat's kept words), w, t0, t1}]. */
function filmWords(ctx) {
  const out = [];
  for (const x of ctx.beats)
    if (isRecorded(x.meta)) keptWords(x.meta, ctx.transcript).forEach((w, k) => out.push({ ...w, beat: x.b.id, k }));
  return out;
}

/** Find a phrase among the recorded words; with `beat`, it must start in that beat. */
export function findPhrase(words, phrase, { beat, nth } = {}) {
  const q = String(phrase).split(/\s+/).map(wordKey).filter(Boolean);
  if (!q.length) throw new Error('Give the words to cut.');
  const hits = [];
  for (let i = 0; i + q.length <= words.length; i++)
    if ((!beat || words[i].beat === beat) && q.every((key, j) => wordKey(words[i + j].w) === key))
      hits.push([i, i + q.length - 1]);
  if (!hits.length) throw new Error(`“${phrase}” is not in ${beat ? `beat ${beat}` : 'the recording'} as it plays now.`);
  if (hits.length > 1 && nth == null)
    throw new Error(
      `“${phrase}” occurs ${hits.length} times (${hits.map(([i]) => words[i].beat).join(', ')}); add --beat or --nth N.`,
    );
  const pick = hits[nth == null ? 0 : nth - 1];
  if (!pick) throw new Error(`There are only ${hits.length} occurrences of “${phrase}”.`);
  return pick;
}

/** The whole sentence around word index i of the film's words (it may cross beats). */
export function sentenceAround(words, i) {
  let a = i,
    b = i;
  while (a > 0 && !sentenceEnd(words[a - 1].w)) a--;
  while (b < words.length - 1 && !sentenceEnd(words[b].w)) b++;
  return [a, b];
}

/** Which edits removed transcript words (by index): cut ids, for telling the person why. */
function removedBy(root, ctx, indices) {
  const ids = new Set();
  for (const x of ctx.beats)
    if (isRecorded(x.meta))
      for (const r of x.meta.source.removed ?? [])
        for (const i of indices) {
          const w = ctx.transcript.words[i],
            mid = Math.round(((w.t0 + w.t1) / 2) * ctx.transcript.rate);
          if (mid >= r.samples[0] && mid < r.samples[1]) ids.add(r.id);
        }
  for (const e of readEdits(root))
    for (const p of e.beats ?? [])
      if (p.deleted && p.meta?.source?.words && indices.some(i => i >= p.meta.source.words[0] && i < p.meta.source.words[1])) ids.add(e.id);
  return [...ids];
}

/** Resolve a selection to film-word indices [a, b]. */
function select(ctx, words, sel, root) {
  if (sel.source) {
    // Words named by their identity in the source transcript (what a note or a time in a
    // revision pointed at). They must all still play, together; nothing is searched for.
    const want = new Set(sel.source);
    const at = words.map((w, i) => (want.has(w.index) ? i : -1)).filter(i => i >= 0);
    const what = sel.label ?? 'Those words';
    if (!at.length) {
      const by = removedBy(root, ctx, sel.source);
      throw new Error(`${what} no longer play in the film${by.length ? ` (removed by ${by.join(', ')})` : ''}; nothing was cut.`);
    }
    if (at.length !== want.size) {
      const by = removedBy(root, ctx, sel.source.filter(i => !words.some(w => w.index === i)));
      throw new Error(`Part of ${what.toLowerCase()} was already cut${by.length ? ` (${by.join(', ')})` : ''}; point at what is left instead. Nothing was cut.`);
    }
    if (at.at(-1) - at[0] !== at.length - 1) throw new Error(`${what} are no longer together in the film; nothing was cut.`);
    return [at[0], at.at(-1)];
  }
  if (sel.from && sel.to) {
    // Exact words: {beat, k} (k counts the beat's words as they play now), inclusive.
    const at = p => words.findIndex(w => w.beat === p.beat && w.k === p.k);
    const [a, b] = [at(sel.from), at(sel.to)];
    if (a < 0 || b < 0 || b < a) throw new Error('Those words are not in the recording as it plays now.');
    return [a, b];
  }
  if (sel.words && sel.within) {
    // A phrase inside the beats a note is about now; never anywhere else in the film.
    const inside = new Set(sel.within);
    const hits = [];
    const q = String(sel.words).split(/\s+/).map(wordKey).filter(Boolean);
    for (let i = 0; i + q.length <= words.length; i++)
      if (q.every((key, j) => wordKey(words[i + j].w) === key) && words.slice(i, i + q.length).some(w => inside.has(w.beat)))
        hits.push([i, i + q.length - 1]);
    if (!hits.length) throw new Error(`“${sel.words}” is not in ${[...inside].join(', ')} as it plays now; nothing was cut.`);
    if (hits.length > 1 && sel.nth == null) throw new Error(`“${sel.words}” occurs ${hits.length} times in ${[...inside].join(', ')}; add --nth N.`);
    const pick = hits[sel.nth == null ? 0 : sel.nth - 1];
    if (!pick) throw new Error(`There are only ${hits.length} occurrences of “${sel.words}” there.`);
    return pick;
  }
  if (sel.words) return findPhrase(words, sel.words, sel);
  if (sel.sentence != null) {
    const inBeat = words.map((w, i) => [w, i]).filter(([w]) => w.beat === sel.beat);
    if (!inBeat.length) throw new Error(`Beat ${sel.beat} has no recorded words.`);
    const starts = inBeat.filter(([, i]) => i === 0 || sentenceEnd(words[i - 1].w) || words[i - 1].beat !== sel.beat);
    const first = starts[sel.sentence - 1];
    if (!first) throw new Error(`Beat ${sel.beat} has ${starts.length} sentence start(s).`);
    return sentenceAround(words, first[1]);
  }
  throw new Error('Choose what to cut: --words "…", --sentence N with --beat, or --at TIME.');
}

/**
 * Cut words (a phrase, a sentence) out of the recording. A beat left without words is removed
 * whole. Every change is one entry in review/edits.jsonl and can be undone with uncut.
 */
export function cutWords(root, sel, { by = { role: 'agent' }, note, dryRun = false } = {}) {
  return withLock(root, () => {
    const ctx = context(root),
      words = filmWords(ctx);
    const [a, b] = select(ctx, words, sel, root);
    const id = nextId('c', [...readEdits(root).map(e => e.id)]);
    const text = words
      .slice(a, b + 1)
      .map(w => w.w)
      .join(' ');
    const plan = [];
    for (const x of ctx.beats) {
      const mine = words.slice(a, b + 1).filter(w => w.beat === x.b.id);
      if (!mine.length) continue;
      const kept = keptWords(x.meta, ctx.transcript);
      const i = mine[0].k,
        j = mine.at(-1).k;
      if (i === 0 && j === kept.length - 1) {
        const f = spanFrames(x.meta, ctx.fps);
        const pieces = slicePieces(x.meta, { rate: ctx.src.rate, fps: ctx.fps });
        const lost = pieces.reduce((n, p) => n + (p.pad ?? p.to - p.from), 0);
        plan.push({
          beat: x.b.id,
          deleted: true,
          frames: lost / (ctx.src.rate / ctx.fps),
          seconds: round(lost / ctx.src.rate, 3),
          span: f,
          // What goes: every word the beat still plays and all the recording it plays.
          indices: kept.map(w => w.index),
          pieces: pieces.filter(p => p.pad == null).map(p => [p.from, p.to]),
        });
        continue;
      }
      const span = spanFrames(x.meta, ctx.fps);
      const r = planRemoval({ kept, i, j, span, removed: x.meta.source.removed ?? [], rate: ctx.src.rate, fps: ctx.fps });
      if (!r)
        throw new Error(`Cannot cut “${text}” in ${x.b.id} without touching the neighbouring words.`);
      plan.push({
        beat: x.b.id,
        removal: {
          id,
          kind: 'words',
          words: mine.map(w => w.w).join(' '),
          samples: r.samples,
          pad: r.pad,
          from: round(r.samples[0] / ctx.src.rate, 6),
          to: round(r.samples[1] / ctx.src.rate, 6),
        },
        frames: (r.samples[1] - r.samples[0] - r.pad) / (ctx.src.rate / ctx.fps),
        seconds: round((r.samples[1] - r.samples[0] - r.pad) / ctx.src.rate, 3),
        indices: mine.map(w => w.index),
      });
    }
    const frames = plan.reduce((s, p) => s + p.frames, 0);
    const report = { id, op: 'cut', words: text, beats: plan, frames, seconds: round(frames / ctx.fps, 3) };
    if (dryRun) return report;
    apply(root, ctx, report, { by, note });
    return report;
  });
}

/** Transcript identities of word ranges given by position ({beat, k}, inclusive) in the film now. */
export function identitiesOf(root, ranges) {
  const ctx = context(root),
    words = filmWords(ctx);
  return ranges.map(r => {
    const [a, b] = select(ctx, words, { from: r.from, to: r.to }, root);
    return words.slice(a, b + 1).map(w => w.index);
  });
}

/**
 * Several cuts as one: every selection is planned against the film as it is (a selection that
 * cannot be cut stops all of them), then applied by identity; if any fails part way, every
 * file goes back. Returns the reports, in order.
 */
export function cutAll(root, selections, opts = {}) {
  const plans = selections.map(sel => cutWords(root, sel, { ...opts, dryRun: true }));
  if (opts.dryRun) return plans;
  const beats = plans.flatMap(p => p.beats.map(b => b.beat));
  return atomically(root, touchedFiles(beats, ['source/words.json']), () => selections.map(sel => cutWords(root, sel, opts)));
}

/** Shorten every pause longer than `over` seconds to about `keep` (inside and between beats). */
export function tightenPauses(root, { over = 1.2, keep = 0.5, beats: only } = {}, { by = { role: 'agent' }, note, dryRun = false } = {}) {
  if (!(over > keep && keep >= 0.1)) throw new Error('--pauses-over must exceed --keep, and keep at least 0.1 s.');
  return withLock(root, () => {
    const ctx = context(root),
      { rate } = ctx.src,
      id = nextId('c', readEdits(root).map(e => e.id));
    const plan = [];
    const add = (x, r, words = '') =>
      r &&
      plan.push({
        beat: x.b.id,
        removal: { id, kind: 'pause', words, samples: r.samples, pad: 0, from: round(r.samples[0] / rate, 6), to: round(r.samples[1] / rate, 6) },
        frames: (r.samples[1] - r.samples[0]) / (rate / ctx.fps),
        seconds: round((r.samples[1] - r.samples[0]) / rate, 3),
        indices: [],
      });
    const recorded = ctx.beats.filter(x => isRecorded(x.meta) && (!only || only.includes(x.b.id)));
    for (const [n, x] of recorded.entries()) {
      const kept = keptWords(x.meta, ctx.transcript),
        span = spanFrames(x.meta, ctx.fps).map(f => f / ctx.fps);
      const clear = (g0, g1) => !(x.meta.source.removed ?? []).some(r => r.samples[0] / rate < g1 && r.samples[1] / rate > g0);
      for (let k = 1; k < kept.length; k++)
        if (kept[k].t0 - kept[k - 1].t1 > over && clear(kept[k - 1].t1, kept[k].t0))
          add(x, planPause(kept[k - 1].t1, kept[k].t0, keep, { rate, fps: ctx.fps }));
      // A pause across the cut to the next beat: take whole frames from both edges.
      const next = recorded[n + 1];
      if (!next || next.index !== x.index + 1 || !kept.length) continue;
      const nk = keptWords(next.meta, ctx.transcript);
      if (!nk.length) continue;
      const nspan = spanFrames(next.meta, ctx.fps).map(f => f / ctx.fps);
      if (Math.abs(span[1] - nspan[0]) > 1e-6) continue;
      const tail = span[1] - kept.at(-1).t1,
        head = nk[0].t0 - nspan[0];
      if (tail + head <= over || !clear(kept.at(-1).t1, span[1])) continue;
      const frame = 1 / ctx.fps,
        want = tail + head - keep;
      const x1 = Math.floor(Math.min(tail - keep / 2, want / 2) / frame + 1e-9) * frame;
      const y1 = Math.floor(Math.min(head - keep / 2, want - Math.max(0, x1)) / frame + 1e-9) * frame;
      const spf = rate / ctx.fps;
      if (x1 >= frame) {
        const end = Math.round(span[1] * ctx.fps) * spf;
        add(x, { samples: [end - Math.round(x1 * ctx.fps) * spf, end], pad: 0 });
      }
      if (y1 >= frame && !(next.meta.source.removed ?? []).some(r => r.samples[0] / rate < nk[0].t0)) {
        const start = Math.round(nspan[0] * ctx.fps) * spf;
        add(next, { samples: [start, start + Math.round(y1 * ctx.fps) * spf], pad: 0 });
      }
    }
    const report = {
      id,
      op: 'pauses',
      words: '',
      over,
      keep,
      beats: plan,
      frames: plan.reduce((s, p) => s + p.frames, 0),
      seconds: round(plan.reduce((s, p) => s + p.frames, 0) / ctx.fps, 3),
    };
    if (dryRun || !plan.length) return report;
    apply(root, ctx, report, { by, note });
    return report;
  });
}

/**
 * Run `fn`; if it throws, put every listed file back as it was (or remove it if it did not
 * exist). Edits touch several files (slices, metadata, the storyboard, the log): a failure part
 * way must not leave some of them changed.
 */
export function atomically(root, rels, fn) {
  const saved = [...new Set(rels)].map(rel => {
    const file = path.join(root, rel);
    return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
  });
  try {
    return fn();
  } catch (e) {
    for (const [file, data] of saved)
      if (data == null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, data);
    throw e;
  }
}
const touchedFiles = (beats, extra = []) => [
  'storyboard.json',
  'review/edits.jsonl',
  ...beats.flatMap(id => [`assets/vo/${id}.wav`, `assets/vo/${id}.json`]),
  ...extra,
];

/** Write a planned edit: removals into metadata, rebuilt slices, deleted beats, the log. */
function apply(root, ctx, report, opts) {
  return atomically(root, touchedFiles(report.beats.map(p => p.beat), ['source/words.json']), () => applyNow(root, ctx, report, opts));
}
function applyNow(root, ctx, report, { by, note }) {
  const sb = ctx.sb,
    entries = [],
    at = new Date().toISOString();
  if (report.beats.filter(p => p.deleted).length >= sb.beats.length) throw new Error('That would remove every beat.');
  const removals = new Map();
  for (const p of report.beats) {
    const x = ctx.beats.find(y => y.b.id === p.beat);
    if (p.deleted) {
      const i = sb.beats.findIndex(b => b.id === p.beat);
      entries.push({ beat: p.beat, deleted: true, after: sb.beats[i - 1]?.id ?? null, storyboard: sb.beats[i], meta: x.meta });
      sb.beats.splice(i, 1);
    } else removals.set(p.beat, [...(removals.get(p.beat) ?? []), p.removal]);
  }
  for (const [id, list] of removals) {
    const meta = structuredClone(ctx.beats.find(y => y.b.id === id).meta);
    meta.source.removed = [
      ...(meta.source.removed ?? []),
      ...list.map(r => ({ ...r, by, at, ...(note ? { note } : {}) })),
    ];
    const { text } = rebuild(root, id, meta, ctx.src, ctx.transcript, ctx.fps);
    sb.beats.find(b => b.id === id).vo = text;
    entries.push({ beat: id, removals: list.length });
  }
  writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
  logEdit(root, { id: report.id, op: report.op, words: report.words, seconds: report.seconds, beats: entries, by, ...(note ? { note } : {}) });
}

/** Undo a cut (or every removal in a beat): restore the words from the master. */
export function uncut(root, { id, beat } = {}, { by = { role: 'agent' } } = {}) {
  return withLock(root, () => {
    const ctx = context(root),
      sb = ctx.sb;
    const edits = readEdits(root);
    const undone = new Set(edits.filter(e => e.op === 'uncut').flatMap(e => e.of));
    let targets;
    if (id) {
      checkId('cut', id);
      const e = edits.find(x => x.id === id && ['cut', 'pauses'].includes(x.op));
      if (!e) throw new Error(`No cut ${id} in review/edits.jsonl.`);
      if (undone.has(id)) throw new Error(`${id} was already undone.`);
      targets = [e];
    } else if (beat) {
      const meta = readMeta(root, beat);
      if (!isRecorded(meta)) throw new Error(`${beat} does not replay the recording.`);
      const ids = new Set((meta.source.removed ?? []).map(r => r.id));
      targets = edits.filter(e => ids.has(e.id));
      if (!targets.length) throw new Error(`${beat} has nothing cut.`);
    } else throw new Error('uncut needs --cut ID or --beat ID.');
    const restored = [];
    for (const e of targets.reverse()) {
      for (const part of [...e.beats].reverse()) {
        if (beat && part.beat !== beat) continue;
        if (part.deleted) {
          if (sb.beats.some(b => b.id === part.beat)) continue;
          const after = part.after ? sb.beats.findIndex(b => b.id === part.after) : -1;
          if (part.after && after < 0)
            throw new Error(`${e.id} removed ${part.beat} after ${part.after}, which no longer exists; use restore instead.`);
          sb.beats.splice(after + 1, 0, part.storyboard);
          const meta = structuredClone(part.meta);
          rebuild(root, part.beat, meta, ctx.src, ctx.transcript, ctx.fps);
          sb.beats[after + 1].vo = meta.text;
          restored.push(part.beat);
          continue;
        }
        const meta = readMeta(root, part.beat);
        if (!meta || !sb.beats.some(b => b.id === part.beat))
          throw new Error(`${e.id} cut ${part.beat}, which has since been split, merged or removed; use restore instead.`);
        const before = meta.source.removed?.length ?? 0;
        meta.source.removed = (meta.source.removed ?? []).filter(r => r.id !== e.id);
        if (meta.source.removed.length === before) continue;
        const { text } = rebuild(root, part.beat, meta, ctx.src, ctx.transcript, ctx.fps);
        sb.beats.find(b => b.id === part.beat).vo = text;
        restored.push(part.beat);
      }
    }
    writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
    const entry = { id: nextId('u', edits.map(x => x.id)), op: 'uncut', of: targets.map(t => t.id), beats: restored, by };
    logEdit(root, entry);
    return entry;
  });
}

/** Split a recorded beat before a word (in the pause before it, on a frame boundary). */
export function splitBeat(root, { beat, at, nth }, { by = { role: 'agent' } } = {}) {
  return withLock(root, () => {
    const ctx = context(root),
      sb = ctx.sb;
    const x = ctx.beats.find(y => y.b.id === beat);
    if (!x) throw new Error(`No beat ${beat}.`);
    if (!isRecorded(x.meta)) throw new Error(`${beat} does not replay the recording; edit its vo text instead.`);
    const kept = keptWords(x.meta, ctx.transcript).map((w, k) => ({ ...w, beat, k }));
    const [k] = findPhrase(kept, at, { nth });
    if (k === 0) throw new Error('Split before a word that is not the first.');
    const { rate } = ctx.src,
      spf = rate / ctx.fps,
      [f0, f1] = spanFrames(x.meta, ctx.fps);
    const g0 = kept[k - 1].t1,
      g1 = kept[k].t0;
    // The frame boundary nearest the middle of the pause, staying inside it when one exists.
    let f = Math.round(((g0 + g1) / 2) * ctx.fps);
    if (f / ctx.fps < g0 && Math.ceil(g0 * ctx.fps - 1e-9) / ctx.fps <= g1) f = Math.ceil(g0 * ctx.fps - 1e-9);
    if (f / ctx.fps > g1 && Math.floor(g1 * ctx.fps + 1e-9) / ctx.fps >= g0) f = Math.floor(g1 * ctx.fps + 1e-9);
    if (!(f > f0 && f < f1)) throw new Error('No frame boundary to split at between those words.');
    if ((x.meta.source.removed ?? []).some(r => r.samples[0] < f * spf && r.samples[1] > f * spf))
      throw new Error('That pause was cut; split elsewhere or uncut it first.');
    const taken = new Set(sb.beats.map(b => b.id));
    const fresh = base => {
      for (let n = 0; ; n++) {
        const id = `${base}${n ? n + 1 : ''}`;
        if (!taken.has(id) && !fs.existsSync(metaPath(root, id))) {
          taken.add(id);
          return id;
        }
      }
    };
    const ids = [fresh(`${beat}a`), fresh(`${beat}b`)];
    // Transcript words before the split frame stay with the first part (cut ones included).
    let split = x.meta.source.words[0];
    while (split < x.meta.source.words[1] && (ctx.transcript.words[split].t0 + ctx.transcript.words[split].t1) / 2 < f / ctx.fps)
      split++;
    const parts = [
      [f0, f, [x.meta.source.words[0], split]],
      [f, f1, [split, x.meta.source.words[1]]],
    ].map(([a, b, w], n) => {
      const meta = structuredClone(x.meta);
      meta.source = {
        ...meta.source,
        span: [a, b],
        start: round(meta.source.offset + a / ctx.fps, 4),
        end: round(meta.source.offset + b / ctx.fps, 4),
        words: w,
        removed: (meta.source.removed ?? []).filter(r => r.samples[0] >= a * spf && r.samples[1] <= b * spf),
      };
      const { text } = rebuild(root, ids[n], meta, ctx.src, ctx.transcript, ctx.fps);
      const { id: _drop, was: _was, ...rest } = x.b;
      return { id: ids[n], ...rest, vo: text, was: [beat] };
    });
    sb.beats.splice(x.index, 1, ...parts);
    writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
    const entry = { id: nextId('p', readEdits(root).map(e => e.id)), op: 'split', beat, into: ids, by };
    logEdit(root, entry);
    return entry;
  });
}

/** Merge two adjacent recorded beats into the first; the second's picture is dropped. */
export function mergeBeats(root, { beats: [first, second] }, { by = { role: 'agent' } } = {}) {
  return withLock(root, () => {
    const ctx = context(root),
      sb = ctx.sb;
    const a = ctx.beats.find(y => y.b.id === first),
      b = ctx.beats.find(y => y.b.id === second);
    if (!a || !b) throw new Error(`No beat ${!a ? first : second}.`);
    if (b.index !== a.index + 1) throw new Error(`${first} and ${second} are not adjacent.`);
    if (!isRecorded(a.meta) || !isRecorded(b.meta)) throw new Error('Both beats must replay the recording.');
    if ((a.b.speaker ?? null) !== (b.b.speaker ?? null)) throw new Error('A beat has one speaker; these differ.');
    const spf = ctx.src.rate / ctx.fps;
    const [a0, a1] = spanFrames(a.meta, ctx.fps),
      [b0, b1] = spanFrames(b.meta, ctx.fps);
    if (b0 < a1) throw new Error('These beats overlap on the recording.');
    const meta = structuredClone(a.meta);
    const removed = [...(a.meta.source.removed ?? []), ...(b.meta.source.removed ?? [])];
    // Recording between them that no beat plays (a beat cut whole) stays out.
    if (b0 > a1)
      removed.push({ id: 'gap', kind: 'gap', words: '', samples: [a1 * spf, b0 * spf], pad: 0, from: round(a1 / ctx.fps, 6), to: round(b0 / ctx.fps, 6) });
    if (a.meta.source.words[1] > b.meta.source.words[0]) throw new Error('These beats share transcript words.');
    meta.source = {
      ...meta.source,
      span: [a0, b1],
      end: b.meta.source.end,
      words: [a.meta.source.words[0], b.meta.source.words[1]],
      removed,
    };
    if (b.meta.alignment?.kind !== 'measured') meta.alignment = { ...meta.alignment, kind: 'estimated' };
    const { text } = rebuild(root, first, meta, ctx.src, ctx.transcript, ctx.fps);
    const merged = { ...a.b, vo: text, was: [...new Set([...(a.b.was ?? []), first, second])] };
    sb.beats.splice(a.index, 2, merged);
    writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
    const entry = { id: nextId('m', readEdits(root).map(e => e.id)), op: 'merge', beats: [first, second], into: first, by, dropped: { [second]: b.b } };
    logEdit(root, entry);
    return entry;
  });
}

// ------------------------------------------------------------------ the edit log
// review/edits.jsonl, one line per edit: c001 cut, u001 uncut, p001 split, m001 merge,
// x001 a rejected candidate's restore (written by edit-loop.mjs).

export function readEdits(root) {
  const file = reviewPath(root, 'edits.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l));
}
function logEdit(root, entry) {
  const file = reviewPath(root, 'edits.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n');
}

/** Film words with their source times, for anchoring a note or a cut at a time in a revision. */
export function sourceTime(meta, sliceSeconds, { rate, fps }) {
  for (const s of sourceSegments(meta, { rate, fps }).reverse())
    if (sliceSeconds >= s.at) return round(s.from + (sliceSeconds - s.at), 4);
  return null;
}
