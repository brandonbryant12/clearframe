// Measured word timings for a narration take: paid Gemini transcription of the take, timed words
// supplied from elsewhere, or a recording imported with its own clock.
import fs from 'node:fs';
import path from 'node:path';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import type { Word } from '../domain.mjs';
import { WordSchema } from '../schemas.mjs';
import { errorMessage, isRecord, record } from './errors.mjs';
import { loadStoryboard, paths } from './project.mjs';
import { tokenize } from './timing.mjs';
import { audioHash, normalizeWords, validateWords } from './word-timing.mjs';
import { ffmpeg, hashOf, readJSON, writeJSON, wavDuration } from './util.mjs';
import { audioBound, readNarration } from './speech-meta.mjs';
import { postEffect } from '../../skills/gemini-tts/scripts/gemini.mjs';
import {
  ProviderReplyError,
  runProvider,
  validated,
} from '../../skills/gemini-tts/scripts/provider-http.mjs';
import {
  deleteFileEffect,
  uploadAudioEffect,
  waitFileEffect,
} from './google-files.mjs';

export interface TranscriptionRequest {
  model: 'gemini-3.5-transcribe';
  input: { type: 'audio'; uri: string; mime_type: 'audio/wav' }[];
  generation_config: {
    transcription_config: {
      mode: { type: 'verbatim'; timestamp_granularities: ['word'] };
    };
  };
}
export const transcriptionRequest = (uri: string): TranscriptionRequest => ({
  model: 'gemini-3.5-transcribe',
  input: [{ type: 'audio', uri, mime_type: 'audio/wav' }],
  generation_config: {
    transcription_config: {
      mode: { type: 'verbatim', timestamp_granularities: ['word'] },
    },
  },
});

export interface TranscribeOptions {
  beat?: string | undefined;
  budget?: number | null | undefined;
  force?: boolean | undefined;
}
/** A take about to be sent: its beat, its file, and the audio hash it must still have afterwards. */
interface PendingTake {
  beat: string;
  file: string;
  before: string;
}
type TranscriptionPlan = { cached: Word[] } | { take: PendingTake };

const decodeWords = Schema.decodeUnknownSync(Schema.Array(WordSchema));

/** Refuse, reuse measured words for this exact audio, or name the take to send (within budget). */
function planTranscription(
  root: string,
  { beat, budget, force = false }: TranscribeOptions,
): TranscriptionPlan {
  const sb = loadStoryboard(root),
    b = sb.beats.find((x) => x.id === beat);
  if (!beat || !b?.vo) throw new Error('Choose a narrated beat with --beat');
  const file = path.join(paths(root).vo, `${beat}.wav`),
    meta = readNarration(path.join(paths(root).vo, `${beat}.json`))?.meta;
  if (!fs.existsSync(file) || !meta || meta.textHash !== hashOf(b.vo))
    throw new Error('Record or import the current narration before alignment');
  const before = audioHash(file),
    estimate = ((wavDuration(file) ?? 0) / 60) * 0.005;
  if (
    !force &&
    meta.alignment?.kind === 'measured' &&
    meta.alignment.audioHash === before
  ) {
    try {
      return {
        cached: validateWords(
          [...decodeWords(meta.words)],
          tokenize(b.vo),
          wavDuration(file) ?? 0,
        ),
      };
    } catch {}
  }
  const limit = budget ?? sb.budget;
  if (limit != null && estimate > limit)
    throw new Error('Estimated transcription cost exceeds the budget');
  return { take: { beat, file, before } };
}

/** Local work after the paid call; a failure keeps its own message. */
const afterCall = <A,>(run: () => A) =>
  Effect.try({
    try: run,
    catch: (cause) =>
      new ProviderReplyError({ message: errorMessage(cause), cause }),
  });

const statusOf = (result: unknown): string | undefined =>
  isRecord(result) && typeof result.status === 'string'
    ? result.status
    : undefined;

/** Upload, transcribe and align one take; the upload is deleted however the work ends. */
const transcribeTake = (root: string, take: PendingTake) =>
  Effect.acquireUseRelease(
    uploadAudioEffect(take.file),
    (uploaded) =>
      Effect.gen(function* () {
        yield* waitFileEffect(uploaded.name);
        const result = yield* postEffect(
          '/interactions',
          transcriptionRequest(uploaded.uri),
          { retries: 0 },
        );
        const status = statusOf(result);
        if (status !== 'completed')
          return yield* new ProviderReplyError({
            message: `Transcription ${status ?? 'incomplete'}`,
          });
        // Retain the paid result even on a transcript mismatch so it can be reviewed/imported.
        yield* afterCall(() =>
          writeJSON(
            path.join(paths(root).vo, `${take.beat}.transcription.json`),
            result,
          ),
        );
        if (yield* afterCall(() => audioHash(take.file) !== take.before))
          return yield* new ProviderReplyError({
            message:
              'Recording changed during transcription; align the new take',
          });
        return yield* afterCall(() =>
          alignSpeech(root, {
            beat: take.beat,
            words: result,
            provider: 'gemini-3.5-transcribe',
          }),
        );
      }),
    (uploaded) =>
      deleteFileEffect(uploaded.name).pipe(
        Effect.catch(() =>
          Effect.sync(() =>
            console.warn(
              'Uploaded speech cleanup failed; Google Files expires it after 48 hours.',
            ),
          ),
        ),
      ),
  );

/** Paid transcription of one narrated beat, through the injected provider transport. */
export const transcribeSpeechEffect = (
  root: string,
  options: TranscribeOptions = {},
) =>
  Effect.flatMap(
    validated(() => planTranscription(root, options)),
    (plan) =>
      'cached' in plan
        ? Effect.succeed(plan.cached)
        : transcribeTake(root, plan.take),
  );
export const transcribeSpeech = (
  root: string,
  options: TranscribeOptions = {},
): Promise<Word[]> => runProvider(transcribeSpeechEffect(root, options));

export interface AlignInput {
  beat?: string | undefined;
  words: unknown;
  provider?: string | undefined;
}

/** Store timed words (any supported transcript JSON) as the measured timing of a beat's current take. */
export function alignSpeech(
  root: string,
  { beat, words, provider = 'imported' }: AlignInput,
): Word[] {
  const sb = loadStoryboard(root),
    b = sb.beats.find((x) => x.id === beat);
  if (!beat || !b?.vo)
    throw new Error('Choose a beat with narration using --beat');
  const P = paths(root),
    file = path.join(P.vo, `${beat}.wav`),
    metaFile = path.join(P.vo, `${beat}.json`);
  const narration = readNarration(metaFile);
  if (
    !fs.existsSync(file) ||
    !narration ||
    narration.meta.textHash !== hashOf(b.vo)
  )
    throw new Error('Record or import the current narration before alignment.');
  const duration = wavDuration(file) ?? narration.meta.duration;
  const normalized = validateWords(
    normalizeWords(words),
    tokenize(b.vo),
    audioBound(duration),
  );
  writeJSON(metaFile, {
    ...narration.raw,
    duration,
    words: normalized,
    alignment: {
      kind: 'measured',
      provider,
      audioHash: audioHash(file),
      createdAt: new Date().toISOString(),
    },
  });
  return normalized;
}

export interface ImportSpeechInput {
  beat?: string | undefined;
  audio: string;
  transcript?: string | undefined;
  words?: unknown;
}
export interface ImportedSpeech {
  duration: number;
  wordTiming: 'measured' | 'estimated';
}

/** Import a recording without trimming silence; supplied offsets retain the original clock. */
export async function importSpeech(
  root: string,
  { beat, audio, transcript, words }: ImportSpeechInput,
): Promise<ImportedSpeech> {
  // The storyboard is edited as written (only this beat's words change), not as loaded.
  const sb = record(
    readJSON(path.join(root, 'storyboard.json')),
    'storyboard.json',
  );
  const b = (Array.isArray(sb.beats) ? sb.beats : [])
    .filter(isRecord)
    .find((x) => x.id === beat);
  if (!b) throw new Error(`No beat ${beat}`);
  if (!transcript?.trim())
    throw new Error(
      'A transcript is required (plain text or derived from timed words).',
    );
  const P = paths(root);
  fs.mkdirSync(P.vo, { recursive: true });
  const out = path.join(P.vo, `${beat}.wav`),
    tmp = path.join(P.vo, `${beat}.import.wav`);
  try {
    await ffmpeg([
      '-y',
      '-i',
      path.resolve(audio),
      '-vn',
      '-ar',
      '48000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      tmp,
    ]);
    const duration = wavDuration(tmp);
    if (duration === null || !(duration > 0))
      throw new Error('Imported audio is empty');
    const normalized = words
      ? validateWords(normalizeWords(words), tokenize(transcript), duration)
      : null;
    fs.renameSync(tmp, out);
    const vo = transcript.trim();
    b.vo = vo;
    delete b.duration;
    writeJSON(path.join(root, 'storyboard.json'), sb);
    writeJSON(path.join(P.vo, `${beat}.json`), {
      provider: 'imported',
      textHash: hashOf(vo),
      text: vo,
      duration,
      ...(normalized
        ? {
            words: normalized,
            alignment: {
              kind: 'measured',
              provider: 'imported',
              audioHash: audioHash(out),
            },
          }
        : {}),
      createdAt: new Date().toISOString(),
    });
    return { duration, wordTiming: normalized ? 'measured' : 'estimated' };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
