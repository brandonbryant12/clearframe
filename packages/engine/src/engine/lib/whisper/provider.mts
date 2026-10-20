import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as Schema from 'effect/Schema';

import type {
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

/** whisper.cpp, one word per segment (`-ml 1 -sow`); null when it fails, so the Python CLI is tried. */
export function cppWords(
  cpp: string,
  wav: string,
  language: string,
  dir: string,
): HeardTranscript | null {
  const out = path.join(dir, 'cpp');
  const r = spawnSync(
    'whisper-cli',
    [
      '-m',
      cpp,
      '-f',
      wav,
      '-l',
      language,
      '-ml',
      '1',
      '-sow',
      '-oj',
      '-of',
      out,
      '-np',
    ],
    {
      encoding: 'utf8',
    },
  );
  if (r.status !== 0 || !fs.existsSync(`${out}.json`)) return null;
  const segments =
    decodeCpp(JSON.parse(fs.readFileSync(`${out}.json`, 'utf8')))
      .transcription ?? [];
  const words = segments
    .map((s) => ({
      word: String(s.text ?? '').trim(),
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
    }))
    .filter((w) => w.word && !/^\[.*\]$/.test(w.word));
  return {
    words,
    provider: `whisper.cpp-${path.basename(cpp).replace(/^ggml-|\.bin$/g, '')}`,
  };
}

/**
 * Words heard in a 16 kHz mono WAV, with their times, as `timedWords` reads them, plus which
 * recognizer measured them. whisper.cpp splits its output one word per segment (`-ml 1 -sow`);
 * the Python CLI reports words inside segments.
 */
export function transcribeWords(
  wav: string,
  { model = 'base', language = 'en', dir }: TranscribeWordsOptions,
): HeardTranscript {
  const cpp = model === 'base' ? whisperCpp(language) : null;
  const fromCpp = cpp ? cppWords(cpp, wav, language, dir) : null;
  if (fromCpp) return fromCpp;
  const r = spawnSync(
    'whisper',
    [
      wav,
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
  const json = path.join(
    dir,
    `${path.basename(wav).replace(/\.[^.]+$/, '')}.json`,
  );
  return {
    words: decodeWhisper(JSON.parse(fs.readFileSync(json, 'utf8'))),
    provider: `whisper-${model}`,
  };
}
