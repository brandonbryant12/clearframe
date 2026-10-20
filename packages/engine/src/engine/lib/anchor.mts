// Times and anchors: reading 2:13.4, and finding what is on screen and spoken at a moment of a
// revision's timeline. Shared by notes (where a note points) and targets (what a cut takes).
import type { Word } from '../domain.mjs';

/** A stretch of the film that plays a stretch of the source recording ([start, end] seconds each). */
export interface SourceSegment {
  film: [number, number];
  source: [number, number];
}
/** Where a beat's speech comes from in an imported recording. */
export interface BeatSource {
  file: string;
  offset: number;
  segments?: SourceSegment[];
}
/** A beat's fingerprints: what was authored, drawn, said and rendered. */
export interface AnchorPrints {
  authored: string;
  picture: string;
  words: string;
  rendered: string;
}
/** What anchoring reads from a revision's beat. */
export interface AnchorBeat {
  id: string;
  start: number;
  end: number;
  startFrame: number;
  frames: number;
  chapter?: string | null;
  words?: Word[];
  elements: string[];
  source?: BeatSource | null;
  prints: AnchorPrints;
}
/** What anchoring reads from a revision's timeline. */
export interface AnchorTimeline {
  duration: number;
  frames: number;
  fps: number;
  beats: readonly AnchorBeat[];
}
export interface AnchorOptions {
  to?: number;
  beat?: string;
  element?: string;
}
/** A neighbouring beat whose cut is close enough that the person may have meant it. */
export interface NearCut {
  beat: string;
  seconds: number;
}
/** Where a moment falls in a revision: its beat, the words around it, their place in the recording. */
export interface Anchor {
  beat: string;
  beats: string[];
  at: number;
  to?: number;
  beatTime: number;
  chapter: string | null;
  words: string;
  quoteAt?: number;
  source?: {
    file: string;
    from: number;
    to: number;
    original: [number, number];
  };
  element?: string;
  near?: NearCut[];
  prints: AnchorPrints;
}

const round = (n: number, d = 3): number => Math.round(n * 10 ** d) / 10 ** d;

// ------------------------------------------------------------------ time

/** 133.4, 2:13, 2:13.4 or 1:02:13.5 → seconds. */
export function parseTime(value: string | number): number {
  const s = String(value).trim();
  if (!/^(?:\d+(?::\d{1,2}){0,2}(?:\.\d*)?|\.\d+)$/.test(s))
    throw new Error(
      `Not a time: ${JSON.stringify(value)} (use 133.4 or 2:13.4)`,
    );
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
export function formatTime(t: number): string {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// ------------------------------------------------------------------ anchors

const sourceAt = (
  beat: Pick<AnchorBeat, 'source'>,
  t: number,
): number | null => {
  const s = beat.source?.segments?.find(
    (x) => t >= x.film[0] - 1e-6 && t <= x.film[1] + 1e-6,
  );
  return s ? round(s.source[0] + (t - s.film[0]), 3) : null;
};

/**
 * Where time `at` falls on a revision's timeline: the beat showing at that frame, the words
 * spoken around it, their time in the source recording, and any cut close enough that the
 * person may have meant the neighbouring beat (reported, never guessed).
 */
export function anchorAt(
  timeline: AnchorTimeline,
  at: number,
  { to, beat: forced, element }: AnchorOptions = {},
): Anchor {
  if (!(Number.isFinite(at) && at >= 0 && at < timeline.duration + 1e-6))
    throw new Error(
      `${formatTime(at)} is outside this revision (${formatTime(timeline.duration)} long).`,
    );
  if (to != null && !(to > at))
    throw new Error('A range must end after it starts.');
  const { beat, near } = locateAnchorBeat(timeline, at, forced);
  if (element != null && !beat.elements.includes(element))
    throw new Error(
      `${beat.id} has no element "${element}" (it has: ${beat.elements.join(', ') || 'none named'}).`,
    );
  const beats =
    to != null
      ? timeline.beats
          .filter((b) => b.start < to && b.end > at)
          .map((b) => b.id)
      : [beat.id];
  const quote = anchorWords(beat.words ?? [], at, to);
  const recording = anchorRecording(beat, quote);
  return {
    beat: beat.id,
    beats,
    at: round(at),
    ...(to != null ? { to: round(to) } : {}),
    beatTime: round(at - beat.start),
    chapter: beat.chapter ?? null,
    words: quote.map((w) => w.w).join(' '),
    ...(quote.length ? { quoteAt: round(quote[0].t0) } : {}),
    ...(recording ? { source: recording } : {}),
    ...(element != null ? { element } : {}),
    ...(near.length ? { near } : {}),
    prints: {
      authored: beat.prints.authored,
      picture: beat.prints.picture,
      words: beat.prints.words,
      rendered: beat.prints.rendered,
    },
  };
}

function locateAnchorBeat(
  timeline: AnchorTimeline,
  at: number,
  forced: string | undefined,
) {
  const frame = Math.min(
    timeline.frames - 1,
    Math.floor(at * timeline.fps + 1e-6),
  );
  let beat = timeline.beats.find(
    (b) => frame >= b.startFrame && frame < b.startFrame + b.frames,
  );
  const near: NearCut[] = [];
  for (const b of timeline.beats) {
    if (b === beat) continue;
    const edge = Math.min(Math.abs(at - b.end), Math.abs(at - b.start));
    if (edge <= 0.3) near.push({ beat: b.id, seconds: round(edge) });
  }
  if (forced) {
    const f = timeline.beats.find((b) => b.id === forced);
    if (!f) throw new Error(`No beat ${forced} in this revision.`);
    if (f !== beat && !near.some((n) => n.beat === forced))
      throw new Error(
        `${forced} is not on screen at ${formatTime(at)} in this revision (that is ${beat?.id ?? 'no beat'}).`,
      );
    beat = f;
  }
  if (!beat)
    throw new Error(
      `No beat is on screen at ${formatTime(at)} in this revision.`,
    );
  return { beat, near };
}

function anchorWords(
  words: Word[],
  at: number,
  to: number | undefined,
): Word[] {
  if (to != null)
    return words.filter((w) => w.t1 > at && w.t0 < to).slice(0, 12);
  let k = words.findIndex((w) => at >= w.t0 && at < w.t1);
  if (k < 0) k = words.findIndex((w) => w.t0 >= at);
  if (k < 0) k = words.length - 1;
  return words.slice(Math.max(0, k - 2), Math.min(words.length, k + 3));
}

function anchorRecording(
  beat: AnchorBeat,
  quote: Word[],
): Anchor['source'] | null {
  const source = beat.source;
  if (!quote.length || !source) return null;
  const from = sourceAt(beat, quote[0].t0);
  const until = sourceAt(beat, quote[quote.length - 1].t1);
  if (from == null || until == null) return null;
  return {
    file: source.file,
    from,
    to: until,
    original: [round(from + source.offset), round(until + source.offset)],
  };
}
