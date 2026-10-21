import fs from 'node:fs';

import { hashOf, pcmToWav, round } from '../util.mjs';
import { audioHash } from '../word-timing.mjs';
import { writeJSONAtomic } from '../store.mjs';

import { metaPath, wavPath } from '../recording-model.mjs';
import type { RecordedMeta, Transcript } from '../recording-model.mjs';
import type { Word } from '../../domain.mjs';
import type { KeptWord, PlacedPiece, SourceAudio } from './contracts.mjs';
import { slicePCM } from './samples.mjs';
import { keptWords } from './pieces.mjs';

export function rebuiltWords(
  kept: KeptWord[],
  placed: PlacedPiece[],
  rate: number,
  duration: number,
): Word[] {
  const words = kept.map((w) => {
    const mid = Math.round(((w.t0 + w.t1) / 2) * rate),
      p =
        placed.find((x) => mid >= x.from && mid < x.to) ??
        placed[placed.length - 1];
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
  return words;
}

/** Rebuild a beat's WAV, words, text and alignment from the master and its removals. */
export function rebuild(
  root: string,
  id: string,
  meta: RecordedMeta,
  src: SourceAudio,
  transcript: Transcript,
  fps: number,
): { text: string; duration: number; words: Word[] } {
  const { rate } = src;
  const { out, placed, length } = slicePCM(meta, src, fps);
  fs.writeFileSync(wavPath(root, id), pcmToWav(out, { sampleRate: rate }));
  const duration = length / rate;
  const kept = keptWords(meta, transcript);
  const words = rebuiltWords(kept, placed, rate, duration);
  const text = words.map((w) => w.w).join(' ');
  const estimated = kept.filter((w) => w.estimated).length;
  const was = meta.alignment ?? {};
  const measured = was.kind === 'measured' && !estimated;
  Object.assign(meta, {
    textHash: hashOf(text),
    text,
    duration,
    words,
    alignment: {
      kind: measured ? 'measured' : 'estimated',
      provider:
        String(was.provider ?? 'imported-transcript').replace(
          / \(source edit\)$/,
          '',
        ) + ' (source edit)',
      audioHash: audioHash(wavPath(root, id)),
      ...(estimated ? { interpolatedWords: estimated } : {}),
    },
  });
  writeJSONAtomic(metaPath(root, id), meta);
  return { text, duration, words };
}
