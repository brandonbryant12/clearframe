import fs from 'node:fs';

import { readPCM } from '../levels.mjs';

import { errorMessage } from '../errors.mjs';
import { wavPath } from '../recording-model.mjs';
import type { RecordingSlice } from '../recording-model.mjs';

import type { SourceAudio, SliceSamples, PlacedPiece } from './contracts.mjs';
import { slicePieces, pieceLength, isPad } from './pieces.mjs';

export const RAMP = 0.004;

export function scale(buf: Buffer, sample: number, k: number): void {
  const off = sample * 2;
  if (off < 0 || off + 2 > buf.length) return;
  buf.writeInt16LE(Math.round(buf.readInt16LE(off) * k), off);
}

/**
 * The samples a beat's slice holds: its pieces of the master in order, inserted silence, and
 * fades at the joins removals made. A pure function of the master and the metadata.
 */
export function slicePCM(
  meta: { source: RecordingSlice },
  src: Pick<SourceAudio, 'rate' | 'pcm' | 'samples'>,
  fps: number,
): SliceSamples {
  const { rate, pcm } = src,
    pieces = slicePieces(meta, { rate, fps });
  const length = pieces.reduce((n, p) => n + pieceLength(p), 0);
  const out = Buffer.alloc(length * 2);
  const ramp = Math.round(RAMP * rate);
  let at = 0;
  const placed: PlacedPiece[] = [];
  for (const [i, p] of pieces.entries()) {
    if (!isPad(p)) {
      const avail = Math.max(0, Math.min(p.to, src.samples) - p.from);
      if (avail > 0) pcm.copy(out, at * 2, p.from * 2, (p.from + avail) * 2);
      // Fade only at joins made by a removal: the beat's own edges stay bit-exact.
      const n = p.to - p.from,
        r = Math.min(ramp, n >> 1);
      fadeJoin(out, at, n, r, i, pieces.length);
      placed.push({ ...p, at });
    }
    at += pieceLength(p);
  }
  return { out, placed, length };
}

/**
 * Whether a beat's WAV holds exactly the samples its metadata declares from the master
 * (`src`, from loadSource): null when it does, otherwise what is wrong. The metadata alone
 * says what a beat should play; this checks what it does play.
 */
export function sliceProblem(
  root: string,
  id: string,
  meta: { source: RecordingSlice },
  src: SourceAudio,
  fps: number,
): string | null {
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
    return errorMessage(e);
  }
  return actual.rate === src.rate && actual.pcm.equals(expected)
    ? null
    : `${rel} does not hold the samples of source/recording.wav its metadata declares`;
}

export function fadeJoin(
  out: Buffer,
  at: number,
  length: number,
  ramp: number,
  index: number,
  count: number,
): void {
  if (index > 0)
    for (let sample = 0; sample < ramp; sample++)
      scale(out, at + sample, sample / ramp);
  if (index < count - 1)
    for (let sample = 0; sample < ramp; sample++)
      scale(out, at + length - 1 - sample, sample / ramp);
}
