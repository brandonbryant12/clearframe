// A take's words, beat by beat: the boundary between two beats moved into the pause the voice
// made there, and each beat's words fitted to its own slice of the take.
import type { TimeRange } from '../domain.mjs';
import type { AlignedWord } from './word-align.mjs';
import { round } from './util.mjs';

/** Known [start, end] seconds of each part inside a take. */
export type PartBounds = [number, number][];
/** A beat's stretch of a take, and its words on the take's clock (null until measured). */
export interface BeatSpan {
  start: number;
  end: number;
  words: AlignedWord[] | null;
}

/**
 * A beat's words on its own slice clock: ordered, never overlapping, each at least 20 ms, all
 * inside the slice. A word clamped at the slice end used to collapse to zero length, which the
 * renderer refuses as an invalid cue.
 */
export function fitWords(
  words: readonly AlignedWord[],
  start: number,
  sliceDur: number,
): AlignedWord[] {
  const out: AlignedWord[] = words.map((w) => ({
    w: w.w,
    t0: Math.max(0, w.t0 - start),
    t1: Math.min(sliceDur, w.t1 - start),
    ...(w.estimated ? { estimated: true } : {}),
  }));
  const min = Math.min(0.02, sliceDur / Math.max(1, out.length));
  for (let k = 0; k < out.length; k++) {
    if (k) out[k].t0 = Math.max(out[k].t0, out[k - 1].t1);
    out[k].t1 = Math.max(out[k].t1, out[k].t0 + min);
  }
  for (let k = out.length - 1; k >= 0; k--) {
    const next = k + 1 < out.length ? out[k + 1].t0 : sliceDur;
    out[k].t1 = Math.min(out[k].t1, next);
    out[k].t0 = Math.min(out[k].t0, out[k].t1 - min);
  }
  return out.map((w) => ({
    ...w,
    t0: round(Math.max(0, w.t0), 4),
    t1: round(w.t1, 4),
  }));
}

/** The pause between two beats that the cut moves into: near where the words put it, inside both
 *  beats' outer edges; nearer is better, and a longer pause is likelier to be the one between lines. */
function pauseBetween(
  gaps: readonly TimeRange[],
  a: BeatSpan,
  b: BeatSpan,
  reach: number,
): TimeRange | undefined {
  const mid = (a.end + b.start) / 2;
  const score = (g: TimeRange): number =>
    Math.abs((g.start + g.end) / 2 - mid) - 0.5 * (g.end - g.start);
  return gaps
    .filter(
      (g) =>
        Math.abs((g.start + g.end) / 2 - mid) <= reach &&
        g.start > a.start &&
        g.end < b.end,
    )
    .sort((x, y) => score(x) - score(y))[0];
}

/**
 * Move each boundary between a take's beats into the real pause nearest it (one of at least
 * `shortest` seconds, within `reach` of where the words put it). Alignment can misplace a short
 * first word ("And", "Or") across the pause between lines, and a cut set by the words then
 * slices it into the line before; the pause is where the line actually changes. Words left on
 * the wrong side of it are spread over the speech beside the pause and marked estimated.
 */
export function snapToPauses(
  perBeat: BeatSpan[],
  segments: readonly TimeRange[],
  { reach = 1.2, shortest = 0.25 }: { reach?: number; shortest?: number } = {},
): BeatSpan[] {
  const gaps = segments
    .slice(1)
    .map((s, i) => ({ start: segments[i].end, end: s.start }))
    .filter((g) => g.end - g.start >= shortest);
  for (let i = 0; i + 1 < perBeat.length; i++) {
    const [a, b] = [perBeat[i], perBeat[i + 1]];
    const best = pauseBetween(gaps, a, b, reach);
    if (!best) continue;
    [a.end, b.start] = [best.start, best.end];
    if (a.words) a.words = respreadTail(a.words, a.start, a.end);
    if (b.words) b.words = respreadHead(b.words, b.start, b.end);
  }
  return perBeat;
}

/** Spread words over [t0, t1] by their letters, marked estimated. */
function span(list: readonly AlignedWord[], t0: number, t1: number): void {
  const letters = list.reduce((k, w) => k + Math.max(1, w.w.length), 0);
  let t = t0;
  for (const w of list) {
    const d = ((t1 - t0) * Math.max(1, w.w.length)) / letters;
    Object.assign(w, { t0: t, t1: t + d, estimated: true });
    t += d;
  }
}

/** Spread the words at the head of a line that start before `from` over the speech after it. */
function respreadHead(
  words: readonly AlignedWord[],
  from: number,
  to: number,
): AlignedWord[] {
  const out = words.map((w) => ({ ...w }));
  const n = out.length;
  let m = 0;
  while (m < n && out[m].t0 < from - 0.01) m++;
  if (!m) return out;
  const until =
    m < n ? Math.max(out[m].t0, from + 0.08 * m) : Math.min(to, from + 0.3 * m);
  span(out.slice(0, m), from, until);
  for (let k = m; k < n; k++) out[k].t0 = Math.max(out[k].t0, out[k - 1].t1);
  return out;
}

/** Spread the words at the tail of a line that end after `to` over the speech before it. */
function respreadTail(
  words: readonly AlignedWord[],
  from: number,
  to: number,
): AlignedWord[] {
  const out = words.map((w) => ({ ...w }));
  const n = out.length;
  let j = n;
  while (j > 0 && out[j - 1].t1 > to + 0.01) j--;
  if (j === n) return out;
  const after =
    j > 0
      ? Math.min(out[j - 1].t1, to - 0.08 * (n - j))
      : Math.max(from, to - 0.3 * (n - j));
  span(out.slice(j), after, to);
  for (let k = j - 1; k >= 0; k--)
    out[k].t1 = Math.min(out[k].t1, out[k + 1].t0);
  return out;
}
