import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as Schema from 'effect/Schema';

import type {
  HeardWord,
  WhisperTranscript,
  HeardTranscript,
  TranscribeWordsOptions,
} from './contracts.mjs';

/**
 * whisper.cpp (`whisper-cli`, MIT) with a local ggml model, when one is installed: the same
 * Whisper weights on the GPU, about ten times faster than the Python CLI and with a fraction of
 * its CPU, which matters when several films align at once. The model is the file named by
 * CLEARFRAME_WHISPER_MODEL, or ggml-base(.en).bin in ~/.cache/whisper-cpp
 * (huggingface.co/ggerganov/whisper.cpp). Returns null without both.
 */
export function whisperCpp(language = 'en'): string | null {
  if (spawnSync('whisper-cli', ['--help'], { encoding: 'utf8' }).status !== 0)
    return null;
  const env = process.env.CLEARFRAME_WHISPER_MODEL;
  if (env) return fs.existsSync(env) ? env : null;
  const dir = path.join(os.homedir(), '.cache/whisper-cpp');
  const names =
    language === 'en'
      ? ['ggml-base.en.bin', 'ggml-base.bin']
      : ['ggml-base.bin'];
  return (
    names.map((n) => path.join(dir, n)).find((f) => fs.existsSync(f)) ?? null
  );
}

export function whisperAvailable(language = 'en'): boolean {
  return (
    !!whisperCpp(language) ||
    spawnSync('whisper', ['--help'], { encoding: 'utf8' }).status === 0
  );
}

export const CppSchema = Schema.Struct({
  transcription: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        text: Schema.optionalKey(Schema.String),
        offsets: Schema.Struct({ from: Schema.Finite, to: Schema.Finite }),
      }),
    ),
  ),
});

export const decodeCpp = Schema.decodeUnknownSync(CppSchema);

export const WhisperSchema: Schema.Codec<WhisperTranscript> =
  Schema.StructWithRest(
    Schema.Struct({
      segments: Schema.optionalKey(
        Schema.Array(
          Schema.StructWithRest(
            Schema.Struct({
              words: Schema.optionalKey(Schema.Array(Schema.Unknown)),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  );

export const decodeWhisper = Schema.decodeUnknownSync(WhisperSchema);

const cppWordList = (file: string): HeardWord[] =>
  (decodeCpp(JSON.parse(fs.readFileSync(file, 'utf8'))).transcription ?? [])
    .map((s) => ({
      word: String(s.text ?? '').trim(),
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
    }))
    .filter((w) => w.word && !/^\[.*\]$/.test(w.word));

/**
 * whisper.cpp, one word per segment (`-ml 1 -sow`), for each WAV in one run (the model loads
 * once); each file's words are on its own clock, written beside it as FILE.json. Null when it
 * fails, so the Python CLI is tried.
 */
export function cppWordsEach(
  cpp: string,
  wavs: readonly string[],
  language: string,
): HeardTranscript[] | null {
  const r = spawnSync(
    'whisper-cli',
    [
      '-m',
      cpp,
      '-l',
      language,
      '-ml',
      '1',
      '-sow',
      '-oj',
      '-np',
      ...wavs.flatMap((wav) => ['-f', wav]),
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0 || !wavs.every((wav) => fs.existsSync(`${wav}.json`)))
    return null;
  const provider = `whisper.cpp-${path.basename(cpp).replace(/^ggml-|\.bin$/g, '')}`;
  return wavs.map((wav) => ({ words: cppWordList(`${wav}.json`), provider }));
}

/**
 * Words heard in each of several 16 kHz mono WAVs, in one recognizer run, each on its own clock,
 * as `timedWords` reads them, plus which recognizer measured them. Takes are transcribed apart,
 * never joined: across a silence inserted between takes, whisper.cpp collapsed each take's
 * first words onto one zero-length instant, which left them unmeasured.
 */
export function transcribeEach(
  wavs: readonly string[],
  { model = 'base', language = 'en', dir }: TranscribeWordsOptions,
): HeardTranscript[] {
  if (!wavs.length) return [];
  const cpp = model === 'base' ? whisperCpp(language) : null;
  const fromCpp = cpp ? cppWordsEach(cpp, wavs, language) : null;
  if (fromCpp) return fromCpp;
  const r = spawnSync(
    'whisper',
    [
      ...wavs,
      '--model',
      model,
      '--word_timestamps',
      'True',
      '--output_format',
      'json',
      '--output_dir',
      dir,
      '--fp16',
      'False',
      '--language',
      language,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0)
    throw new Error(`whisper failed: ${(r.stderr || r.stdout).slice(-800)}`);
  return wavs.map((wav) => ({
    words: decodeWhisper(
      JSON.parse(
        fs.readFileSync(
          path.join(dir, `${path.basename(wav).replace(/\.[^.]+$/, '')}.json`),
          'utf8',
        ),
      ),
    ),
    provider: `whisper-${model}`,
  }));
}

/** Words heard in one 16 kHz mono WAV (see `transcribeEach`). */
export function transcribeWords(
  wav: string,
  options: TranscribeWordsOptions,
): HeardTranscript {
  const [heard] = transcribeEach([wav], options);
  if (!heard) throw new Error(`whisper heard nothing in ${wav}`);
  return heard;
}
