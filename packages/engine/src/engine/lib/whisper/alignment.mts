import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { record } from '../errors.mjs';
import { loadStoryboard, paths } from '../project.mjs';
import { tokenize } from '../timing.mjs';
import { alignScript } from '../word-align.mjs';
import type { AlignedWord } from '../word-align.mjs';
import { audioHash } from '../word-timing.mjs';
import { readJSON, writeJSON, wavDuration } from '../util.mjs';
import { timedWords } from '../ingest.mjs';

import type {
  Take,
  AlignReport,
  HeardTranscript,
  WhisperAlignOptions,
} from './contracts.mjs';
import {
  currentTakes,
  measuredAtImport,
  nothingToAlign,
  whisperWavs,
} from './takes.mjs';
import { whisperAvailable, transcribeEach } from './provider.mjs';

/** Whether a recognizer result holds any word (timedWords refuses an empty transcript). */
export const wordsHeard = (words: HeardTranscript['words']): boolean =>
  Array.isArray(words)
    ? words.length > 0
    : (words.segments ?? []).some((s) => (s.words ?? []).length > 0);

/** Script words on the take's clock: inside it, ordered, each starting after the last ends. */
export function fitToTake(
  words: readonly AlignedWord[],
  duration: number,
): AlignedWord[] {
  const clamped = words.map((w) => ({
    w: w.w,
    t0: Math.min(w.t0, duration - 0.02),
    t1: Math.min(w.t1, duration),
  }));
  return clamped.map((w, k, a) => ({
    ...w,
    t0: k ? Math.max(w.t0, a[k - 1].t1) : w.t0,
  }));
}

export const interpolatedStatus = (
  interpolated: number,
  words: readonly AlignedWord[],
): string =>
  `${interpolated} word(s) interpolated (estimated): ${words
    .filter((w) => w.estimated)
    .slice(0, 6)
    .map((w) => `"${w.w}"`)
    .join(
      ', ',
    )}. Whisper heard something else there; reword the line so it is said as written (spell a figure the way it is spoken, or the reverse) and record it again`;

/** Map one take's script onto the words heard in it (on its own clock), and record them. */
export function alignTake(
  x: Take,
  heard: readonly AlignedWord[],
  provider: string,
): AlignReport {
  const duration = wavDuration(x.wav) ?? 0;
  const mine = heard.map((w) => ({
    ...w,
    t1: Math.max(0.02, Math.min(duration, w.t1)),
  }));
  if (!mine.length) return { id: x.id, status: 'nothing heard' };
  const { words, interpolated } = alignScript(
    tokenize(x.vo).map((t) => t.w),
    mine,
  );
  const fitted = fitToTake(words, duration);
  const misfit = fitted.filter((w) => w.t1 <= w.t0);
  if (misfit.length)
    return {
      id: x.id,
      status: `timings did not fit the take: ${misfit.length} word(s) heard past its end (${duration.toFixed(2)} s), first "${misfit[0].w}" at ${misfit[0].t0.toFixed(2)} s. The take is shorter than its words: re-record the voice for this beat (voice --draft) so narration and audio match`,
    };
  const meta = record(readJSON(x.metaFile), x.metaFile);
  writeJSON(x.metaFile, {
    ...meta,
    words: fitted,
    alignment: {
      kind: interpolated ? 'estimated' : 'measured',
      provider,
      audioHash: audioHash(x.wav),
      ...(interpolated ? { interpolatedWords: interpolated } : {}),
      createdAt: new Date().toISOString(),
    },
  });
  return {
    id: x.id,
    status: interpolated ? interpolatedStatus(interpolated, words) : 'measured',
  };
}

/** Measure word timings for every current narration take (or `--beat`) with local Whisper. */
export async function whisperAlign(
  root: string,
  { beat, model = 'base', language, force = false }: WhisperAlignOptions = {},
): Promise<AlignReport[]> {
  if (!whisperAvailable())
    throw new Error(
      'Local Whisper is not installed. Install it (brew install openai-whisper, or pip install openai-whisper), or use align --transcribe (paid) or --words.',
    );
  const sb = loadStoryboard(root),
    P = paths(root);
  const takes = currentTakes(sb, P.vo, beat);
  // Measuring an imported slice alone again only loses words at its edges.
  const kept = force ? [] : takes.filter(measuredAtImport);
  const todo = takes.filter((x) => !kept.includes(x));
  if (kept.length && !todo.length)
    return kept.map((x) => ({
      id: x.id,
      status:
        'measured from the recording at import (kept; --force re-measures the slice alone)',
    }));
  if (!todo.length) throw nothingToAlign(root, sb, P.vo, beat);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-whisper-'));
  try {
    // Each take is heard on its own clock in one recognizer run: takes joined with silence lost
    // the first words after every gap.
    const wavs = await whisperWavs(
      todo.map((x) => x.wav),
      tmp,
    );
    const heardEach = transcribeEach(wavs, {
      model,
      language: language ?? sb.voice.language ?? 'en',
      dir: tmp,
    });
    const report = todo.map((x, i) => {
      const heard = heardEach[i];
      return heard && wordsHeard(heard.words)
        ? alignTake(x, timedWords(heard.words), heard.provider)
        : { id: x.id, status: 'nothing heard' };
    });
    return [
      ...kept.map((x) => ({
        id: x.id,
        status: 'measured from the recording at import (kept)',
      })),
      ...report,
    ];
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
