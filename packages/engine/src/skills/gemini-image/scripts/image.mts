#!/usr/bin/env node
// Gemini native image generation ("Nano Banana 2") via the Interactions API (Node ≥ 22).
//
// Contract (verified against ai.google.dev, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model: "gemini-3.1-flash-image",
//     input: [ { type: "text", text }, { type: "image", mime_type: "image/png", data: <base64> } ...refs ],
//     response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "16:9", image_size: "2K" } }
//   → steps[type=model_output].content[type=image] = { mime_type, data (base64) }
//   aspect_ratio: 1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9 (+ 1:4 4:1 1:8 8:1 on 3.1 Flash)
//   image_size: "512" (3.1 Flash only) | "1K" | "2K" | "4K" (uppercase K). Lite is 1K only.
//   Imagen was shut down on the Gemini API (Aug 2026) — do not use imagen-* models.
//
// Usage:
//   node image.mjs --prompt "..." --aspect 16:9 --size 2K --out assets/img/texture.jpg
//   node image.mjs --prompt "..." --ref style.png --ref layout.png --out out.jpg
//   node image.mjs --prompt "..." --dry-run
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

export interface ImageModel {
  price: Readonly<Record<string, number>>;
  note: string;
}
export const MODELS = {
  'gemini-3.1-flash-image': {
    price: { 512: 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    note: 'Nano Banana 2 · default',
  },
  'gemini-3.1-flash-lite-image': {
    price: { '1K': 0.0336 },
    note: 'Nano Banana 2 Lite · cheapest · 1K only · weak at multi-reference',
  },
  'gemini-3-pro-image': {
    price: { '1K': 0.134, '2K': 0.134, '4K': 0.24 },
    note: 'Nano Banana Pro · premium',
  },
} satisfies Readonly<Record<string, ImageModel>>;
const modelLookup = new Map<string, ImageModel>(Object.entries(MODELS));
const ASPECTS: readonly string[] = [
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
  '1:4',
  '4:1',
  '1:8',
  '8:1',
];
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} satisfies Readonly<Record<string, string>>;
const mimeLookup = new Map(Object.entries(MIME));

export interface ImageRequestOptions {
  prompt?: string | undefined;
  model?: string | undefined;
  aspect?: string | undefined;
  size?: string | undefined;
  refs?: readonly string[] | undefined;
}
export type GenerateImageOptions = ImageRequestOptions & PostOptions;

export type ImageInput =
  | { type: 'text'; text: string }
  | { type: 'image'; mime_type: string; data: string };
export interface ImageRequest {
  model: string;
  input: ImageInput[];
  response_format: {
    type: 'image';
    mime_type: 'image/jpeg';
    aspect_ratio: string;
    image_size: string;
  };
}

export function buildRequest({
  prompt,
  model = 'gemini-3.1-flash-image',
  aspect = '16:9',
  size = '2K',
  refs = [],
}: ImageRequestOptions): ImageRequest {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!ASPECTS.includes(aspect))
    throw new Error(`aspect must be one of ${ASPECTS.join(' ')}`);
  let imageSize = String(size).toUpperCase().replace(/^512$/, '512');
  if (model.includes('lite') && imageSize !== '1K') imageSize = '1K';
  if (imageSize === '512' && model !== 'gemini-3.1-flash-image')
    imageSize = '1K';
  const input: ImageInput[] = [{ type: 'text', text: prompt }];
  for (const ref of refs) {
    const ext = path.extname(ref).toLowerCase();
    input.push({
      type: 'image',
      mime_type: mimeLookup.get(ext) ?? 'image/png',
      data: fs.readFileSync(ref).toString('base64'),
    });
  }
  return {
    model,
    input,
    response_format: {
      type: 'image',
      mime_type: 'image/jpeg',
      aspect_ratio: aspect,
      image_size: imageSize,
    },
  };
}

export function estimateCost({
  model = 'gemini-3.1-flash-image',
  size = '2K',
}: {
  model?: string | undefined;
  size?: string | undefined;
}): number {
  const p: Readonly<Record<string, number>> =
    modelLookup.get(model)?.price ?? {};
  return p[String(size).toUpperCase()] ?? p['1K'] ?? 0.1;
}

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
  text: string;
}

/** Generate one image through the injected provider transport. */
export const generateImageEffect = (opts: GenerateImageOptions) =>
  Effect.gen(function* () {
    const body = yield* validated(() => buildRequest(opts));
    const json = yield* postEffect('/interactions', body, opts);
    const img = (yield* outputBlocksEffect(json, 'image')).at(-1);
    if (!img?.data)
      return yield* new ProviderReplyError({
        message: `No image in response (possibly filtered): ${JSON.stringify(json).slice(0, 400)}`,
      });
    const image: GeneratedImage = {
      data: Buffer.from(img.data, 'base64'),
      mimeType: img.mime_type ?? 'image/jpeg',
      text: outputText(json),
    };
    return image;
  });

/** Generate one image. Resolves with { data, mimeType, text }. */
export const generateImage = (
  opts: GenerateImageOptions,
): Promise<GeneratedImage> => runProvider(generateImageEffect(opts));

/** A request body for printing: reference images are replaced by their size. */
const printable = (body: ImageRequest): ImageRequest => ({
  ...body,
  input: body.input.map((p) =>
    p.type === 'image' ? { ...p, data: `<${p.data.length} base64 chars>` } : p,
  ),
});

async function main(): Promise<void> {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      model: { type: 'string', default: 'gemini-3.1-flash-image' },
      aspect: { type: 'string', default: '16:9' },
      size: { type: 'string', default: '2K' },
      ref: { type: 'string', multiple: true, default: [] },
      out: { type: 'string', default: 'image.jpg' },
      'dry-run': { type: 'boolean' },
    },
  });
  const opts: GenerateImageOptions = {
    prompt: v.prompt,
    model: v.model,
    aspect: v.aspect,
    size: v.size,
    refs: v.ref,
  };
  if (v['dry-run']) {
    const body = printable(buildRequest(opts));
    console.log(
      `POST ${API}/interactions\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(3)}`,
    );
    return;
  }
  const r = await generateImage(opts);
  fs.mkdirSync(path.dirname(path.resolve(v.out)), { recursive: true });
  fs.writeFileSync(v.out, r.data);
  console.log(
    `wrote ${v.out} (${r.mimeType})${r.text ? `\nmodel note: ${r.text}` : ''}`,
  );
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
