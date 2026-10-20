import { round } from '../util.mjs';

import type {
  RecordingSlice,
  Removal,
  Transcript,
} from '../recording-model.mjs';

import type {
  Piece,
  PadPiece,
  Clock,
  SegmentMap,
  KeptWord,
} from './contracts.mjs';

export const isPad = (p: Piece): p is PadPiece => 'pad' in p;

export const pieceLength = (p: Piece): number =>
  isPad(p) ? p.pad : p.to - p.from;

/** Samples per frame; ingest resamples to 48 kHz, which every supported frame rate divides. */
export function framing(
  meta: { source: RecordingSlice },
  rate: number,
  fps: number,
): number {
  if (meta.source.fps != null && meta.source.fps !== fps)
    throw new Error(
      `Beat audio was cut at ${meta.source.fps} fps; the film is now ${fps} fps. Re-ingest at this rate.`,
    );
  const spf = rate / fps;
  if (!Number.isInteger(spf))
    throw new Error(
      `A ${rate} Hz recording does not divide into ${fps} fps frames.`,
    );
  return spf;
}

/** The beat's span on the source clock, in frames: [first, end). */
export function spanFrames(
  meta: { source: RecordingSlice },
  fps: number,
): number[] {
  if (Array.isArray(meta.source.span)) return meta.source.span;
  const offset = meta.source.offset ?? 0;
  return [
    Math.round((meta.source.start - offset) * fps),
    Math.round((meta.source.end - offset) * fps),
  ];
}

/** What the slice plays, in order: source sample ranges and inserted silence. */
export function slicePieces(
  meta: { source: RecordingSlice },
  { rate, fps }: Clock,
): Piece[] {
  const spf = framing(meta, rate, fps),
    [f0, f1] = spanFrames(meta, fps);
  let pos = f0 * spf;
  const end = f1 * spf,
    pieces: Piece[] = [];
  for (const r of [...(meta.source.removed ?? [])].sort(
    (x, y) => x.samples[0] - y.samples[0],
  )) {
    const [a, b] = r.samples;
    if (!(a >= pos && b <= end && b > a))
      throw new Error(
        `Removal ${r.id} lies outside its beat or overlaps another.`,
      );
    if (a > pos) pieces.push({ from: pos, to: a });
    if (r.pad) pieces.push({ pad: r.pad });
    pos = b;
  }
  if (end > pos) pieces.push({ from: pos, to: end });
  const length = pieces.reduce((n, p) => n + pieceLength(p), 0);
  if (length % spf)
    throw new Error('A beat slice must last a whole number of frames.');
  return pieces;
}

/** Film-relative segments of a slice mapped to the source clock: [{at, from, to}] seconds. */
export function sourceSegments(
  meta: { source: RecordingSlice },
  { rate, fps }: Clock,
): SegmentMap[] {
  let at = 0;
  const out: SegmentMap[] = [];
  for (const p of slicePieces(meta, { rate, fps })) {
    if (!isPad(p))
      out.push({
        at: round(at / rate, 6),
        from: round(p.from / rate, 6),
        to: round(p.to / rate, 6),
      });
    at += pieceLength(p);
  }
  return out;
}

export const removedAt = (
  meta: { source: RecordingSlice },
  sample: number,
): Removal | undefined =>
  (meta.source.removed ?? []).find(
    (r) => sample >= r.samples[0] && sample < r.samples[1],
  );

/**
 * The beat's words that still play, on the source clock, with their transcript index (their
 * identity: it never changes through cuts, splits, merges, undo or restore). Metadata written
 * before beats recorded their share of the transcript is read by its span instead (such beats
 * had nothing cut).
 */
export function keptWords(
  meta: { source: RecordingSlice },
  transcript: Transcript,
): KeptWord[] {
  const rate = transcript.rate;
  if (!meta.source.words) {
    const fps = meta.source.fps ?? transcript.fps ?? 30;
    const [f0, f1] = spanFrames(
      {
        source: {
          ...meta.source,
          offset: meta.source.offset ?? transcript.offset ?? 0,
        },
      },
      fps,
    );
    return transcript.words
      .map((w, index) => ({ ...w, index }))
      .filter(
        (w) => (w.t0 + w.t1) / 2 >= f0 / fps && (w.t0 + w.t1) / 2 < f1 / fps,
      );
  }
  const [i0, i1] = meta.source.words;
  const out: KeptWord[] = [];
  for (let k = i0; k < i1; k++) {
    const w = transcript.words[k];
    if (!removedAt(meta, Math.round(((w.t0 + w.t1) / 2) * rate)))
      out.push({ ...w, index: k });
  }
  return out;
}

/** Film words with their source times, for anchoring a note or a cut at a time in a revision. */
export function sourceTime(
  meta: { source: RecordingSlice },
  sliceSeconds: number,
  { rate, fps }: Clock,
): number | null {
  for (const s of sourceSegments(meta, { rate, fps }).reverse())
    if (sliceSeconds >= s.at) return round(s.from + (sliceSeconds - s.at), 4);
  return null;
}
