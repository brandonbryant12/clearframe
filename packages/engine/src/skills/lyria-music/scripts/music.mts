#!/usr/bin/env node
// Lyria music via the Interactions API — lyria-3.5 (songs up to a couple of minutes) or lyria-3-clip-preview (30 s).
// Node ≥ 22.
//
// Contract (MP3 path checked against ai.google.dev, 2026-09-28):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model: "lyria-3.5", input: "<prompt>" | [ {type:"text",text}, {type:"image",mime_type,data} ...≤10 ],
//     response_format: { type: "audio" } } // Use the MP3 default; do not send a WAV MIME override.
//   → steps[type=model_output].content[] = { type:"text", text:"<lyrics / structure>" }, { type:"audio", mime_type, data }
//   Output: 44.1 kHz stereo. Duration is steered IN THE PROMPT ("about 70 seconds") and with timestamped sections
//   ("[0:00 - 0:08] Intro: ..."). Say "Instrumental only, no vocals." for beds. No negative prompt or seed documented.
//   Pricing: lyria-3.5 $0.08/song, lyria-3-clip-preview $0.04/clip (paid tier only). Output is SynthID-watermarked.
//
// Usage:
//   node music.mjs --prompt "Minimal ambient electronic, 84 BPM, in D major, soft Rhodes and warm synth pads" --seconds 70 --out bed.mp3
//   node music.mjs --prompt "..." --section "0:00-0:08|sparse intro, single pad" --section "0:08-0:55|steady pulse, leaves room for voice" --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import { errorMessage } from '../../../engine/lib/errors.mjs';
import {
  API,
  outputBlocksEffect,
  outputText,
  postEffect,
} from '../../gemini-tts/scripts/gemini.mjs';
import type { PostOptions } from '../../gemini-tts/scripts/gemini.mjs';
import {
  ProviderReplyError,
  runProvider,
  validated,
} from '../../gemini-tts/scripts/provider-http.mjs';

export interface LyriaModel {
  price: number;
  note: string;
}
export const MODELS = {
  'lyria-3.5': { price: 0.08, note: 'full tracks, duration steered by prompt' },
  'lyria-3-clip-preview': {
    price: 0.04,
    note: 'always 30 s — cheap for auditioning a style',
  },
} satisfies Readonly<Record<string, LyriaModel>>;
const modelLookup = new Map<string, LyriaModel>(Object.entries(MODELS));

const mmss = (s: number): string => {
  const n = Math.round(s);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/** A timestamped stretch of the score, in film seconds. */
export interface MusicSection {
  from: number;
  to: number;
  text: string;
}
export interface PromptIntent {
  style?: string | undefined;
  bpm?: number | string | undefined;
  key?: string | undefined;
  seconds?: number | undefined;
  sections?: readonly MusicSection[] | undefined;
  instrumental?: boolean | undefined;
  ending?: string | undefined;
}

/**
 * Compose a Lyria prompt from structured intent. Sections: [{ from, to, text }] in seconds.
 * Keeps musical instructions separate from any lyrics (we use instrumental beds).
 */
export function composePrompt({
  style,
  bpm,
  key,
  seconds,
  sections = [],
  instrumental = true,
  ending = 'end cleanly on a sustained chord, no fade-out',
}: PromptIntent): string {
  const lines: string[] = [];
  lines.push(
    [style, bpm ? `${bpm} BPM` : null, key ? `in ${key}` : null]
      .filter(Boolean)
      .join(', ') + '.',
  );
  if (instrumental) lines.push('Instrumental only, no vocals.');
  if (seconds) lines.push(`Duration: about ${Math.round(seconds)} seconds.`);
  lines.push(
    'Mix: understated and spacious — it sits under a spoken voiceover, so keep the midrange clear and avoid busy melodies.',
  );
  for (const s of sections)
    lines.push(`[${mmss(s.from)} - ${mmss(s.to)}] ${s.text}`);
  if (ending) lines.push(`Ending: ${ending}.`);
  return lines.join('\n');
}

export interface MusicRequestOptions {
  prompt?: string | undefined;
  model?: string | undefined;
  format?: string | undefined;
  images?: readonly string[] | undefined;
}
export type GenerateMusicOptions = MusicRequestOptions & PostOptions;
export type MusicInput =
  | string
  | (
      | { type: 'text'; text: string }
      | { type: 'image'; mime_type: string; data: string }
    )[];
export interface MusicRequest {
  model: string;
  input: MusicInput;
  response_format: { type: 'audio' };
}

export function buildRequest({
  prompt,
  model = 'lyria-3.5',
  format = 'mp3',
  images = [],
}: MusicRequestOptions): MusicRequest {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (format !== 'mp3')
    throw new Error(
      'Lyria music requests support MP3 only; convert the generated MP3 locally if you need WAV.',
    );
  if (images.length > 10)
    throw new Error('Lyria supports at most 10 image references');
  const input: MusicInput = images.length
    ? [
        { type: 'text', text: prompt },
        ...images.map((f) => ({
          type: 'image' as const,
          mime_type: /\.png$/i.test(f) ? 'image/png' : 'image/jpeg',
          data: fs.readFileSync(f).toString('base64'),
        })),
      ]
    : prompt;
  return { model, input, response_format: { type: 'audio' } };
}

export const estimateCost = ({
  model = 'lyria-3.5',
}: { model?: string | undefined } = {}): number =>
  modelLookup.get(model)?.price ?? 0.08;

const EXTENSIONS = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
} satisfies Readonly<Record<string, string>>;
const extensionsLookup = new Map(Object.entries(EXTENSIONS));

export interface GeneratedMusic {
  data: Buffer;
  mimeType: string;
  ext: string;
  text: string;
}

/** Generate music through the injected provider transport. */
export const generateMusicEffect = (opts: GenerateMusicOptions) =>
  Effect.gen(function* () {
    const body = yield* validated(() => buildRequest(opts));
    const json = yield* postEffect('/interactions', body, {
      timeoutMs: 600_000,
      ...opts,
    });
    const audio = (yield* outputBlocksEffect(json, 'audio')).at(-1);
    if (!audio?.data)
      return yield* new ProviderReplyError({
        message: `No audio in response (prompt may have been filtered): ${JSON.stringify(json).slice(0, 400)}`,
      });
    const mime = String(audio.mime_type ?? 'audio/mpeg')
      .toLowerCase()
      .split(';')[0]
      .trim();
    const ext = extensionsLookup.get(mime);
    if (!ext)
      return yield* new ProviderReplyError({
        message: `Unsupported Lyria audio MIME type: ${mime}`,
      });
    const data = Buffer.from(audio.data, 'base64');
    if (!data.length)
      return yield* new ProviderReplyError({
        message: 'Lyria returned empty audio',
      });
    const music: GeneratedMusic = {
      data,
      mimeType: mime,
      ext,
      text: outputText(json),
    };
    return music;
  });

/** Generate music. Resolves with { data, mimeType, ext, text }. */
export const generateMusic = (
  opts: GenerateMusicOptions,
): Promise<GeneratedMusic> => runProvider(generateMusicEffect(opts));

/** "0:00-0:08|sparse intro" → { from: 0, to: 8, text: "sparse intro" }. */
function parseSection(s: string): MusicSection {
  const [range, text] = s.split('|');
  const [a, b] = range
    .split('-')
    .map((x) => x.split(':').reduce((acc, n) => acc * 60 + parseFloat(n), 0));
  return { from: a, to: b, text };
}

async function main(): Promise<void> {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      style: { type: 'string' },
      bpm: { type: 'string' },
      key: { type: 'string' },
      seconds: { type: 'string' },
      section: { type: 'string', multiple: true, default: [] },
      model: { type: 'string', default: 'lyria-3.5' },
      format: { type: 'string', default: 'mp3' },
      image: { type: 'string', multiple: true, default: [] },
      out: { type: 'string', default: 'music.mp3' },
      'dry-run': { type: 'boolean' },
    },
  });
  const sections = v.section.map(parseSection);
  const structured = Boolean(
    v.style || v.bpm || v.key || v.seconds || sections.length,
  );
  const prompt = structured
    ? composePrompt({
        style: v.style ?? v.prompt,
        bpm: v.bpm,
        key: v.key,
        seconds: v.seconds ? Number(v.seconds) : undefined,
        sections,
      })
    : v.prompt;
  const opts: GenerateMusicOptions = {
    prompt,
    model: v.model,
    format: v.format,
    images: v.image,
  };
  if (v['dry-run']) {
    console.log(
      `POST ${API}/interactions\n${JSON.stringify(buildRequest(opts), null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`,
    );
    return;
  }
  const r = await generateMusic(opts);
  const out = v.out.replace(/\.(wav|mp3|ogg)$/i, '') + `.${r.ext}`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, r.data);
  if (r.text) fs.writeFileSync(out.replace(/\.\w+$/, '.txt'), r.text);
  console.log(`wrote ${out} (${r.mimeType})`);
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
