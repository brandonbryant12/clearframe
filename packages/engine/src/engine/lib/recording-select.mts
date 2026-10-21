// Finding the recorded words an edit names, and planning removals that keep beats on whole frames.
import { wordKey } from './word-timing.mjs';
import { editParts, isRecorded, readEdits } from './recording-model.mjs';
import { keptWords } from './recording-slices.mjs';
import type { Removal, Transcript, VoMeta } from './recording-model.mjs';
import type { KeptWord, SourceAudio } from './recording-slices.mjs';
import type { Beat, Storyboard } from '../domain.mjs';

export interface ContextBeat {
  b: Beat;
  index: number;
  meta: VoMeta | null;
}
/** The project as recording edits see it: the storyboard, the master and every beat's metadata. */
export interface EditContext {
  sb: Storyboard;
  fps: number;
  transcript: Transcript;
  src: SourceAudio;
  beats: ContextBeat[];
}
/** A recorded word of the film as it plays now: its beat, and its place among that beat's words. */
export interface FilmWord extends KeptWord {
  beat: string;
  k: number;
}
export interface WordPos {
  beat: string;
  k: number;
}
/** What to cut: transcript identities, exact positions, a phrase (optionally within beats), or a sentence. */
export interface Selection {
  source?: number[];
  label?: string;
  from?: WordPos;
  to?: WordPos;
  words?: string;
  within?: string[];
  nth?: number;
  beat?: string;
  sentence?: number;
}
export interface PlannedRemoval {
  samples: number[];
  pad: number;
}
interface Timed {
  t0: number;
  t1: number;
}

const sentenceEnd = (w: string): boolean => /[.!?]["')\]”’]*$/.test(w);
const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

/**
 * A removal around words i..j of a beat: from inside the pause before them to inside the pause
 * after, a whole number of frames long, kept clear of other words and earlier removals.
 * Returns {samples: [a, b], pad} or null when the words cannot be cut without touching others.
 */
export function planRemoval({
  kept,
  i,
  j,
  span,
  removed = [],
  rate,
  fps,
}: {
  kept: Timed[];
  i: number;
  j: number;
  span: number[];
  removed?: Pick<Removal, 'samples'>[];
  rate: number;
  fps: number;
}): PlannedRemoval | null {
  const spf = rate / fps;
  const [S, E] = [span[0] / fps, span[1] / fps];
  const ends = removed
    .map((r) => r.samples[1] / rate)
    .filter((t) => t <= kept[i].t0 + 1e-9);
  const starts = removed
    .map((r) => r.samples[0] / rate)
    .filter((t) => t >= kept[j].t1 - 1e-9);
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
    const as = Math.round(
      clamp(a0, Math.max(lo1, lo2 - L), Math.min(hi1, hi2 - L)) * rate,
    );
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
export function planPause(
  g0: number,
  g1: number,
  keep: number,
  { rate, fps }: { rate: number; fps: number },
): PlannedRemoval | null {
  const frame = 1 / fps,
    L = Math.floor((g1 - g0 - keep) / frame + 1e-9) * frame;
  if (L < frame) return null;
  const as = Math.round((g0 + (g1 - g0 - L) / 2) * rate);
  return { samples: [as, as + Math.round(L * fps) * (rate / fps)], pad: 0 };
}

/** Find a phrase among the recorded words; with `beat`, it must start in that beat. */
export function findPhrase(
  words: { w: string; beat: string }[],
  phrase: unknown,
  { beat, nth }: { beat?: string; nth?: number } = {},
): number[] {
  const q = String(phrase).split(/\s+/).map(wordKey).filter(Boolean);
  if (!q.length) throw new Error('Give the words to cut.');
  const hits: number[][] = [];
  for (let i = 0; i + q.length <= words.length; i++)
    if (
      (!beat || words[i].beat === beat) &&
      q.every((key, j) => wordKey(words[i + j].w) === key)
    )
      hits.push([i, i + q.length - 1]);
  if (!hits.length)
    throw new Error(
      `“${String(phrase)}” is not in ${beat ? `beat ${beat}` : 'the recording'} as it plays now.`,
    );
  if (hits.length > 1 && nth == null)
    throw new Error(
      `“${String(phrase)}” occurs ${hits.length} times (${hits.map(([i]) => words[i].beat).join(', ')}); add --beat or --nth N.`,
    );
  const pick: number[] | undefined = hits[nth == null ? 0 : nth - 1];
  if (!pick)
    throw new Error(
      `There are only ${hits.length} occurrences of “${String(phrase)}”.`,
    );
  return pick;
}

/** The whole sentence around word index i of the film's words (it may cross beats). */
export function sentenceAround(words: { w: string }[], i: number): number[] {
  let a = i,
    b = i;
  while (a > 0 && !sentenceEnd(words[a - 1].w)) a--;
  while (b < words.length - 1 && !sentenceEnd(words[b].w)) b++;
  return [a, b];
}

/** Recorded words of the film in order: [{beat, k (index among the beat's kept words), w, t0, t1}]. */
export function filmWords(ctx: EditContext): FilmWord[] {
  const out: FilmWord[] = [];
  for (const x of ctx.beats)
    if (isRecorded(x.meta))
      keptWords(x.meta, ctx.transcript).forEach((w, k) =>
        out.push({ ...w, beat: x.b.id, k }),
      );
  return out;
}

/** Which edits removed transcript words (by index): cut ids, for telling the person why. */
function removedBy(
  root: string,
  ctx: EditContext,
  indices: number[],
): string[] {
  const ids = new Set<string>();
  const mids = indices.map((i) => {
    const w = ctx.transcript.words[i];
    return Math.round(((w.t0 + w.t1) / 2) * ctx.transcript.rate);
  });
  for (const x of ctx.beats) {
    if (!isRecorded(x.meta)) continue;
    for (const r of x.meta.source.removed ?? [])
      if (mids.some((mid) => mid >= r.samples[0] && mid < r.samples[1]))
        ids.add(r.id);
  }
  for (const e of readEdits(root))
    for (const p of editParts(e)) {
      const span = p.meta?.source?.words;
      if (p.deleted && span && indices.some((i) => i >= span[0] && i < span[1]))
        ids.add(e.id);
    }
  return [...ids];
}

// Words named by their identity in the source transcript (what a note or a time in a
// revision pointed at). They must all still play, together; nothing is searched for.
function selectBySource(
  root: string,
  ctx: EditContext,
  words: FilmWord[],
  source: number[],
  label?: string,
): number[] {
  const want = new Set(source);
  const at = words
    .map((w, i) => (want.has(w.index) ? i : -1))
    .filter((i) => i >= 0);
  const what = label ?? 'Those words';
  if (!at.length) {
    const by = removedBy(root, ctx, source);
    throw new Error(
      `${what} no longer play in the film${by.length ? ` (removed by ${by.join(', ')})` : ''}; nothing was cut.`,
    );
  }
  if (at.length !== want.size) {
    const by = removedBy(
      root,
      ctx,
      source.filter((i) => !words.some((w) => w.index === i)),
    );
    throw new Error(
      `Part of ${what.toLowerCase()} was already cut${by.length ? ` (${by.join(', ')})` : ''}; point at what is left instead. Nothing was cut.`,
    );
  }
  if (at[at.length - 1] - at[0] !== at.length - 1)
    throw new Error(
      `${what} are no longer together in the film; nothing was cut.`,
    );
  return [at[0], at[at.length - 1]];
}

// A phrase inside the beats a note is about now; never anywhere else in the film.
function selectWithin(
  words: FilmWord[],
  phrase: string,
  within: string[],
  nth: number | undefined,
): number[] {
  const inside = new Set(within);
  const hits: number[][] = [];
  const q = String(phrase).split(/\s+/).map(wordKey).filter(Boolean);
  for (let i = 0; i + q.length <= words.length; i++)
    if (
      q.every((key, j) => wordKey(words[i + j].w) === key) &&
      words.slice(i, i + q.length).some((w) => inside.has(w.beat))
    )
      hits.push([i, i + q.length - 1]);
  if (!hits.length)
    throw new Error(
      `“${phrase}” is not in ${[...inside].join(', ')} as it plays now; nothing was cut.`,
    );
  if (hits.length > 1 && nth == null)
    throw new Error(
      `“${phrase}” occurs ${hits.length} times in ${[...inside].join(', ')}; add --nth N.`,
    );
  const pick: number[] | undefined = hits[nth == null ? 0 : nth - 1];
  if (!pick)
    throw new Error(
      `There are only ${hits.length} occurrences of “${phrase}” there.`,
    );
  return pick;
}

function selectSentence(
  words: FilmWord[],
  beat: string | undefined,
  sentence: number,
): number[] {
  const inBeat = words
    .map((w, i): [FilmWord, number] => [w, i])
    .filter(([w]) => w.beat === beat);
  if (!inBeat.length) throw new Error(`Beat ${beat} has no recorded words.`);
  const starts = inBeat.filter(
    ([, i]) =>
      i === 0 || sentenceEnd(words[i - 1].w) || words[i - 1].beat !== beat,
  );
  const first: [FilmWord, number] | undefined = starts[sentence - 1];
  if (!first)
    throw new Error(`Beat ${beat} has ${starts.length} sentence start(s).`);
  return sentenceAround(words, first[1]);
}

/** Resolve a selection to film-word indices [a, b]. */
export function select(
  ctx: EditContext,
  words: FilmWord[],
  sel: Selection,
  root: string,
): number[] {
  if (sel.source)
    return selectBySource(root, ctx, words, sel.source, sel.label);
  if (sel.from && sel.to) {
    // Exact words: {beat, k} (k counts the beat's words as they play now), inclusive.
    const at = (p: WordPos): number =>
      words.findIndex((w) => w.beat === p.beat && w.k === p.k);
    const [a, b] = [at(sel.from), at(sel.to)];
    if (a < 0 || b < 0 || b < a)
      throw new Error('Those words are not in the recording as it plays now.');
    return [a, b];
  }
  if (sel.words && sel.within)
    return selectWithin(words, sel.words, sel.within, sel.nth);
  if (sel.words) return findPhrase(words, sel.words, sel);
  if (sel.sentence != null)
    return selectSentence(words, sel.beat, sel.sentence);
  throw new Error(
    'Choose what to cut: --words "…", --sentence N with --beat, or --at TIME.',
  );
}
