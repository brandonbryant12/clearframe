#!/usr/bin/env node
// Gemini text-to-speech — gemini-3.8-flash-tts via the Interactions API (Node ≥ 22).
//
// Contract (verified against ai.google.dev, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
//     response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
//     generation_config: { speech_config: [{ voice: "Charon" }] } }
//   → steps[type=model_output].content[type=audio] = { mime_type, data (base64), sample_rate, channels }
//   Unary responses default to audio/wav (24 kHz, mono, s16le, with RIFF header). audio/l16 is headerless PCM.
//
// Usage:
//   node tts.mjs --text "Seventy percent is not a promise." --voice Charon --style "calm, measured" --out vo.wav
//   node tts.mjs --text "..." --dry-run          # print the request body, call nothing
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import { errorMessage } from '../../../engine/lib/errors.mjs';
import { API, interaction, outputBlocksEffect, postEffect } from './gemini.mjs';
import type { PostOptions } from './gemini.mjs';
import {
  ProviderReplyError,
  runProvider,
  validated,
} from './provider-http.mjs';
import { wavFromPcm } from './wav.mjs';

export { API, outputBlocks, post } from './gemini.mjs';

export interface TtsModel {
  outPerM: number;
  note: string;
}
export const MODELS = {
  'gemini-3.8-flash-tts': {
    outPerM: 9.0,
    note: 'GA · newest · most expressive',
  },
  'gemini-3.8-flash-lite-tts': { outPerM: 6.0, note: 'GA · cheapest' },
} satisfies Readonly<Record<string, TtsModel>>;
const modelsById = new Map<string, TtsModel>(Object.entries(MODELS));
export const VOICES = {
  Zephyr: 'Bright',
  Puck: 'Upbeat',
  Charon: 'Informative',
  Kore: 'Firm',
  Fenrir: 'Excitable',
  Leda: 'Youthful',
  Orus: 'Firm',
  Aoede: 'Breezy',
  Callirrhoe: 'Easy-going',
  Autonoe: 'Bright',
  Enceladus: 'Breathy',
  Iapetus: 'Clear',
  Umbriel: 'Easy-going',
  Algieba: 'Smooth',
  Despina: 'Smooth',
  Erinome: 'Clear',
  Algenib: 'Gravelly',
  Rasalgethi: 'Informative',
  Laomedeia: 'Upbeat',
  Achernar: 'Soft',
  Alnilam: 'Firm',
  Schedar: 'Even',
  Gacrux: 'Mature',
  Pulcherrima: 'Forward',
  Achird: 'Friendly',
  Zubenelgenubi: 'Casual',
  Vindemiatrix: 'Gentle',
  Sadachbia: 'Lively',
  Sadaltager: 'Knowledgeable',
  Sulafat: 'Warm',
};

/** One line of a performance: its words, a short delivery note and (in a cast) who says it. */
export interface SpeechPart {
  text?: string | null | undefined;
  style?: string | null | undefined;
  speaker?: string | undefined;
}
/** A cast member: the speaker id the parts name and the Gemini voice that speaks for them. */
export interface CastVoice {
  speaker: string;
  voice: string;
}
export interface SpeechRequestOptions {
  text?: string | null | undefined;
  parts?: readonly SpeechPart[] | null | undefined;
  voice?: string | undefined;
  style?: string | undefined;
  cast?: readonly CastVoice[] | null | undefined;
  model?: string | undefined;
  language?: string | undefined;
  sampleRate?: number | undefined;
  format?: string | undefined;
}
export type SynthesizeOptions = SpeechRequestOptions & PostOptions;

interface SpeechMetadata {
  type: 'speech_metadata';
  style?: string;
  speaker?: string;
}
export interface SpeechContent {
  type: 'text';
  text: string;
  annotations?: SpeechMetadata[];
}
interface SpeakerVoice {
  voice: string;
  language?: string;
}
interface ConversationConfig {
  mode: 'conversational';
  speakers: { speaker: string; voice: string; language?: string }[];
}
export interface SpeechRequest {
  model: string;
  input: { type: 'user_input'; content: SpeechContent[] }[];
  response_format: { type: 'audio'; mime_type: string; sample_rate: number };
  generation_config: { speech_config: SpeakerVoice[] | ConversationConfig };
}

function speechContent(
  list: readonly SpeechPart[],
  style: string | undefined,
  cast: SpeechRequestOptions['cast'],
): SpeechContent[] {
  return list.map((p) => {
    const part: SpeechContent = { type: 'text', text: p.text ?? '' };
    const partStyle = p.style ?? style;
    const meta: SpeechMetadata = {
      type: 'speech_metadata',
      ...(partStyle ? { style: partStyle } : {}),
      ...(cast && p.speaker ? { speaker: p.speaker } : {}),
    };
    if (Object.keys(meta).length > 1) part.annotations = [meta];
    return part;
  });
}

function speechConfig(
  list: readonly SpeechPart[],
  voice: string,
  cast: SpeechRequestOptions['cast'],
  language: string | undefined,
): SpeakerVoice[] | ConversationConfig {
  if (cast?.length) {
    const known = new Set(cast.map((c) => c.speaker));
    for (const p of list)
      if (p.speaker === undefined || !known.has(p.speaker))
        throw new Error(`part speaker "${p.speaker}" is not in the cast`);
    return {
      mode: 'conversational',
      speakers: cast.map((c) => ({
        speaker: c.speaker,
        voice: c.voice,
        ...(language ? { language } : {}),
      })),
    };
  }
  const speaker: SpeakerVoice = { voice };
  if (language) speaker.language = language;
  return [speaker];
}

/**
 * Build the documented request body. `style` is a SHORT delivery note ("calm, measured"); the
 * text is read verbatim. A continuous take passes `parts` ([{text, style, speaker}]): one
 * request, one performance, each part with its own delivery note. Two or more speakers use the
 * conversational mode with `cast` ([{speaker, voice}]) and `speech_metadata.speaker` per part.
 */
export function buildRequest({
  text,
  parts,
  voice = 'Charon',
  style,
  cast,
  model = 'gemini-3.8-flash-tts',
  language,
  sampleRate = 24000,
  format = 'audio/wav',
}: SpeechRequestOptions): SpeechRequest {
  const list: readonly SpeechPart[] = parts ?? [{ text, style }];
  if (!list.length || list.some((p) => !p.text?.trim()))
    throw new Error('text is required');
  const content = speechContent(list, style, cast);
  const speech_config = speechConfig(list, voice, cast, language);
  return {
    model,
    input: [{ type: 'user_input', content }],
    response_format: {
      type: 'audio',
      mime_type: format,
      sample_rate: sampleRate,
    },
    generation_config: { speech_config },
  };
}

/** Rough cost: audio out is 25 tokens/second. Text input is negligible. */
export function estimateCost({
  seconds,
  model = 'gemini-3.8-flash-tts',
}: {
  seconds: number;
  model?: string | undefined;
}): number {
  return ((seconds * 25) / 1e6) * (modelsById.get(model)?.outPerM ?? 9);
}

/** Speech as a RIFF WAV (any PCM reply is wrapped), or the provider's own bytes for another format. */
export interface WavSpeech {
  wav: Buffer;
  data?: undefined;
  mimeType: 'audio/wav';
  usage: unknown;
}
export interface OtherSpeech {
  wav?: undefined;
  data: Buffer;
  mimeType: string;
  usage: unknown;
}
export type SynthesizedSpeech = WavSpeech | OtherSpeech;

/** Synthesize speech through the injected provider transport. */
export const synthesizeEffect = (opts: SynthesizeOptions) =>
  Effect.gen(function* () {
    const body = yield* validated(() => buildRequest(opts));
    const json = yield* postEffect('/interactions', body, opts);
    const audio = (yield* outputBlocksEffect(json, 'audio')).at(-1);
    if (!audio?.data)
      return yield* new ProviderReplyError({
        message: `No audio in response: ${JSON.stringify(json).slice(0, 400)}`,
      });
    const { usage } = interaction(json);
    const buf = Buffer.from(audio.data, 'base64');
    const mime = String(audio.mime_type ?? 'audio/wav').toLowerCase();
    if (mime.startsWith('audio/l16') || mime.includes('pcm')) {
      const rate = Number(
        mime.match(/rate=(\d+)/)?.[1] ?? audio.sample_rate ?? 24000,
      );
      const speech: SynthesizedSpeech = {
        wav: wavFromPcm(buf, rate, audio.channels ?? 1),
        mimeType: 'audio/wav',
        usage,
      };
      return speech;
    }
    if (!mime.includes('wav') && buf.toString('ascii', 0, 4) !== 'RIFF') {
      const other: SynthesizedSpeech = { data: buf, mimeType: mime, usage };
      return other;
    }
    const wav: SynthesizedSpeech = { wav: buf, mimeType: 'audio/wav', usage };
    return wav;
  });

/** Synthesize speech. Resolves with { wav, mimeType, usage } (or { data, mimeType } for a non-WAV reply). */
export const synthesize = (
  opts: SynthesizeOptions,
): Promise<SynthesizedSpeech> => runProvider(synthesizeEffect(opts));

async function main(): Promise<void> {
  const { values: v } = parseArgs({
    options: {
      text: { type: 'string' },
      file: { type: 'string' },
      voice: { type: 'string', default: 'Charon' },
      style: { type: 'string' },
      model: { type: 'string', default: 'gemini-3.8-flash-tts' },
      language: { type: 'string' },
      out: { type: 'string', default: 'speech.wav' },
      'dry-run': { type: 'boolean' },
      'list-voices': { type: 'boolean' },
    },
  });
  if (v['list-voices']) {
    for (const [n, d] of Object.entries(VOICES))
      console.log(`${n.padEnd(14)} ${d}`);
    return;
  }
  const text = v.text ?? (v.file ? fs.readFileSync(v.file, 'utf8') : null);
  const opts: SynthesizeOptions = {
    text,
    voice: v.voice,
    style: v.style,
    model: v.model,
    language: v.language,
  };
  if (v['dry-run']) {
    console.log(
      `POST ${API}/interactions\n${JSON.stringify(buildRequest(opts), null, 2)}`,
    );
    return;
  }
  const r = await synthesize(opts);
  fs.mkdirSync(path.dirname(path.resolve(v.out)), { recursive: true });
  fs.writeFileSync(v.out, r.wav ?? r.data);
  console.log(`wrote ${v.out} (${r.mimeType})`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((e: unknown) => {
    console.error(errorMessage(e));
    process.exit(1);
  });
}
