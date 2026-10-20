import path from 'node:path';
import { ffmpeg, round, writeJSON } from '../util.mjs';
import { audioHash } from '../word-timing.mjs';

import { timedWords, scriptTurns, scriptedWords } from '../ingest-words.mjs';
import type { TranscriptWord, ScriptedWords } from '../ingest-words.mjs';

export function extractMaster(
  audio: string,
  master: string,
  from: number,
  to: number | undefined,
): Promise<string> {
  return ffmpeg([
    '-y',
    ...(from ? ['-ss', String(from)] : []),
    ...(to != null ? ['-to', String(to)] : []),
    '-i',
    path.resolve(audio),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '48000',
    '-c:a',
    'pcm_s16le',
    master,
  ]);
}

/** The transcript's words moved onto the cut recording's clock and clipped to its length. */
export function recordingWords(
  wordsInput: unknown,
  script: unknown,
  from: number,
  duration: number,
): { words: TranscriptWord[]; scripted: ScriptedWords | null } {
  const scripted = script
    ? scriptedWords(timedWords(wordsInput), scriptTurns(script))
    : null;
  const labelled = scripted ? scripted.words : timedWords(wordsInput);
  const words = labelled
    .map((w) => ({ ...w, t0: w.t0 - from, t1: w.t1 - from }))
    .filter((w) => w.t0 >= -0.02 && w.t1 <= duration + 0.05)
    .map((w) => ({ ...w, t0: Math.max(0, w.t0), t1: Math.min(duration, w.t1) }))
    .filter((w) => w.t1 > w.t0);
  if (!words.length)
    throw new Error('No timed words fall inside the selected range.');
  return { words, scripted };
}

// The transcript on the recording's own clock, and where that clock starts in the original:
// recording edits (cut, split, merge) rebuild beats from these, never from beat text.
export function writeTranscript(
  root: string,
  o: {
    audio: string;
    master: string;
    rate: number;
    fps: number;
    from: number;
    to?: number;
    duration: number;
    words: TranscriptWord[];
  },
): void {
  writeJSON(path.join(root, 'source', 'words.json'), {
    version: 1,
    file: 'source/recording.wav',
    rate: o.rate,
    fps: o.fps,
    offset: o.from,
    duration: round(o.duration, 4),
    words: o.words.map((w) => ({
      w: w.w,
      t0: round(w.t0, 4),
      t1: round(w.t1, 4),
      ...(w.speaker != null ? { speaker: w.speaker } : {}),
      ...(w.estimated ? { estimated: true } : {}),
    })),
  });
  writeJSON(path.join(root, 'source', 'recording.json'), {
    file: 'source/recording.wav',
    input: path.basename(o.audio),
    offset: o.from,
    ...(o.to != null ? { to: o.to } : {}),
    rate: o.rate,
    duration: round(o.duration, 4),
    sha256: audioHash(o.master),
  });
}
