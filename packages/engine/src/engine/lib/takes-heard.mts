// Word timings for several takes in one local Whisper pass, mapped onto each take's script.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPCM } from './levels.mjs';
import { ffmpeg } from './util.mjs';
import { timedWords } from './ingest.mjs';
import { transcribeWords, whisperAvailable } from './whisper.mjs';
import { alignScript } from './word-align.mjs';
import type { AlignedWord, ScriptAlignment } from './word-align.mjs';

/** Each take's script alignment (null when it was not heard) and the recognizer that heard them. */
export interface HeardTakes {
  aligned: (ScriptAlignment | null)[];
  provider: string | null;
}

/** Silence between joined takes, in seconds. */
const GAP = 1.0;

/** Where each take starts on the joined clock. */
function takeOffsets(files: readonly string[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const f of files) {
    offsets.push(cursor);
    const { rate, pcm } = readPCM(f);
    cursor += pcm.length / 2 / rate + GAP;
  }
  return offsets;
}

/** The takes joined at 16 kHz with a second of silence after each. */
async function joinTakes(
  files: readonly string[],
  joined: string,
): Promise<void> {
  const filter =
    files
      .map((_, i) => `[${i}:a]aresample=16000,apad=pad_dur=${GAP}[a${i}]`)
      .join(';') +
    ';' +
    files.map((_, i) => `[a${i}]`).join('') +
    `concat=n=${files.length}:v=0:a=1[o]`;
  await ffmpeg([
    '-y',
    ...files.flatMap((f) => ['-i', f]),
    '-filter_complex',
    filter,
    '-map',
    '[o]',
    '-ac',
    '1',
    '-ar',
    '16000',
    joined,
  ]);
}

/** The heard words of the take starting at `start` (and ending at `end`), on its own clock. */
function wordsOfTake(
  heard: readonly AlignedWord[],
  start: number,
  end: number,
): AlignedWord[] {
  return heard
    .filter((w) => w.t0 >= start - GAP / 2 && w.t0 < end - GAP / 2)
    .map((w) => ({
      ...w,
      t0: Math.max(0, w.t0 - start),
      t1: Math.max(0.02, w.t1 - start),
    }));
}

/**
 * Word timings for several takes in one Whisper pass (the model loads once): takes are joined
 * with a second of silence, transcribed, split by offset and mapped onto each take's script.
 */
export async function heardWordsMany(
  files: readonly string[],
  tokenLists: readonly (readonly string[])[],
  language: string | undefined,
): Promise<HeardTakes> {
  const unheard: HeardTakes = {
    aligned: files.map(() => null),
    provider: null,
  };
  if (!files.length || !whisperAvailable()) return unheard;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-takew-'));
  try {
    const offsets = takeOffsets(files);
    const joined = path.join(tmp, 'takes.wav');
    await joinTakes(files, joined);
    process.stderr.write(
      `  measuring words with local Whisper (about a minute per minute of speech without whisper.cpp; longer while other work runs)…\n`,
    );
    let result: ReturnType<typeof transcribeWords>;
    try {
      result = transcribeWords(joined, {
        language: language ?? 'en',
        dir: tmp,
      });
    } catch {
      return unheard;
    }
    const heard = timedWords(result.words);
    const aligned = files.map((_, i) => {
      const end = i + 1 < offsets.length ? offsets[i + 1] : Infinity;
      const mine = wordsOfTake(heard, offsets[i], end);
      return mine.length ? alignScript(tokenLists[i], mine) : null;
    });
    return { aligned, provider: result.provider };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
