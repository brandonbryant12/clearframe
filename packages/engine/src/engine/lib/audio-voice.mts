// Voice audio: post-processing a take, finding where it speaks, aligning its words, and the
// free local draft voice.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TimeRange, Word } from '../domain.mjs';
import { alignWords } from './timing-speech.mjs';
import { ffmpeg, mediaDuration, round } from './util.mjs';

/** A take's speech: its length and where the voice is not silent. */
export interface SpeechSegments {
  duration: number;
  segments: TimeRange[];
}
export interface VoiceAnalysis extends SpeechSegments {
  words: Word[];
}
/** Respellings for the OS voice: written word → how to say it. Non-text values are ignored. */
export type Pronunciations = Readonly<Record<string, unknown>>;
export interface DraftVoiceOptions {
  wpm?: number;
  voice?: string;
  pronounce?: Pronunciations | null;
}

/** Trim leading/trailing silence (keeps a hair of room tone) and normalise to 24 kHz mono s16 WAV. */
export async function cleanVoice(input: string, output: string): Promise<void> {
  const tmp = `${output}.tmp.wav`;
  const trim =
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04';
  await ffmpeg([
    '-y',
    '-i',
    input,
    '-af',
    `${trim},areverse,${trim},areverse`,
    '-ar',
    '24000',
    '-ac',
    '1',
    '-c:a',
    'pcm_s16le',
    tmp,
  ]);
  fs.renameSync(tmp, output);
}

/** [start, end] silences reported by silencedetect; one still open at the end runs to `duration`. */
function silencesIn(stderr: string, duration: number): [number, number][] {
  const silences: [number, number][] = [];
  let open: number | null = null;
  for (const line of stderr.split('\n')) {
    const s = line.match(/silence_start: (-?[\d.]+)/);
    const e = line.match(/silence_end: ([\d.]+)/);
    if (s) open = Math.max(0, parseFloat(s[1]));
    if (e && open != null) {
      silences.push([open, parseFloat(e[1])]);
      open = null;
    }
  }
  if (open != null) silences.push([open, duration]);
  return silences;
}

/** Speech segments via ffmpeg silencedetect. */
export async function speechSegments(
  file: string,
  {
    noise = -38,
    minSilence = 0.14,
  }: { noise?: number; minSilence?: number } = {},
): Promise<SpeechSegments> {
  const duration: number = await mediaDuration(file);
  const stderr: string = await ffmpeg(
    [
      '-i',
      file,
      '-af',
      `silencedetect=noise=${noise}dB:d=${minSilence}`,
      '-f',
      'null',
      '-',
    ],
    {
      quiet: false,
    },
  );
  const segs: TimeRange[] = [];
  let cursor = 0;
  for (const [a, b] of silencesIn(stderr, duration)) {
    if (a > cursor) segs.push({ start: round(cursor), end: round(a) });
    cursor = b;
  }
  if (cursor < duration)
    segs.push({ start: round(cursor), end: round(duration) });
  return { duration, segments: segs };
}

/** Measure a voice take and align its words; returns metadata for assets/vo/<id>.json. */
export async function analyseVoice(
  file: string,
  text: string,
): Promise<VoiceAnalysis> {
  const { duration, segments } = await speechSegments(file);
  return {
    duration: round(duration),
    segments,
    words: alignWords(text, segments, duration),
  };
}

// ------------------------------------------------------------------ local drafts (free, offline)
/**
 * Text as the OS voice should read it: macOS `say` reads "the button: not Attach" as "button colon"
 * and skips an arrow, so a colon before a word and an arrow become a pause. The words are unchanged,
 * so their timings still match the narration.
 */
export const forOsVoice = (
  text: string,
  pronounce: Pronunciations | null | undefined = {},
): string => {
  let t = String(text);
  // `voice.pronounce` respells words the OS voice says wrong ("Alder": "All-der"); the narration,
  // its captions and its word timings keep the written word.
  for (const [word, said] of Object.entries(pronounce ?? {}))
    if (word && typeof said === 'string')
      t = t.replace(
        new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'),
        said,
      );
  return t.replace(/(\S):(?=\s)/g, '$1,').replace(/\s*(→|->|=>)\s*/g, ', ');
};

/** Milliseconds of silence macOS `say` leaves for an inline tag. */
const SAY_PAUSES = new Map<string, number>([
  ['short pause', 350],
  ['long pause', 800],
  ['breath', 250],
  ['sigh', 400],
]);

/** Speak `spoken` to an AIFF with macOS `say`. */
function sayTo(
  spoken: string,
  raw: string,
  wpm: number,
  voice: string | undefined,
): void {
  const args = ['-r', String(Math.round(wpm * 0.9)), '-o', raw];
  if (voice) args.unshift('-v', voice);
  const r = spawnSync('say', [...args, spoken]);
  if (r.status !== 0) throw new Error(`say failed: ${r.stderr}`);
}

/** Speak `spoken` to a WAV with espeak-ng (or espeak). */
function espeakTo(spoken: string, raw: string, wpm: number): void {
  const bin = ['espeak-ng', 'espeak'].find(
    (b) => spawnSync(b, ['--version']).status === 0,
  );
  if (!bin)
    throw new Error(
      'No local TTS found (need macOS `say` or espeak-ng). Use --provider gemini, or --silent.',
    );
  const r = spawnSync(bin, ['-s', String(wpm), '-w', raw, spoken]);
  if (r.status !== 0) throw new Error(`${bin} failed`);
}

/** Draft narration with the OS voice (macOS `say`, Linux `espeak-ng`/`espeak`). For timing only. */
export async function draftVoice(
  text: string,
  output: string,
  { wpm = 150, voice, pronounce }: DraftVoiceOptions = {},
): Promise<void> {
  const mac = process.platform === 'darwin';
  const spoken = forOsVoice(text, pronounce)
    .replace(/<([^>]+)>/g, (_: string, tag: string) => {
      const pause = mac ? SAY_PAUSES.get(tag.trim().toLowerCase()) : undefined;
      return pause ? ` [[slnc ${pause}]] ` : ' ';
    })
    .replace(/\|[^|]*\|/g, ' ');
  const tmpBase = path.join(os.tmpdir(), `cf-say-${process.pid}-${Date.now()}`);
  const raw = mac ? `${tmpBase}.aiff` : `${tmpBase}.wav`;
  if (mac) sayTo(spoken, raw, wpm, voice);
  else espeakTo(spoken, raw, wpm);
  await cleanVoice(raw, output);
  fs.rmSync(raw, { force: true });
}
