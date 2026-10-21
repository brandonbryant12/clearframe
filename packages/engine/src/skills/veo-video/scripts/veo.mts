#!/usr/bin/env node
// Veo 3.1 video generation (long-running operation). Node ≥ 22.
// Default: veo-3.1-lite-generate-preview at 720p for 4 s — the cheapest Veo ($0.05/s → $0.20 a clip).
//
// Contract (verified against ai.google.dev/gemini-api/docs/veo, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning   header: x-goog-api-key
//   { instances: [{ prompt, image?: { inlineData: { mimeType, data } }, lastFrame?: { inlineData: {...} } }],
//     parameters: { aspectRatio: "16:9"|"9:16", resolution: "720p"|"1080p"|"4k", durationSeconds: 4|6|8 (integer),
//                   personGeneration?: "allow_all" (text→video) | "allow_adult" (image→video), seed? } }
//   → { name: "<operation>" }; poll GET /v1beta/{name} until done:true
//   → response.generateVideoResponse.generatedSamples[0].video.uri ; download it WITH the x-goog-api-key header (follow redirects)
//   Notes: 1080p/4k require 8 s; Lite has no 4k; output MP4 24 fps with native audio (always on);
//   files are kept on the server for 2 days; negativePrompt is not documented — put exclusions in the prompt.
//
// Usage:
//   node veo.mjs --prompt "Slow aerial drift over a city at dawn, soft haze, no text" --seconds 4 --out clip.mp4
//   node veo.mjs --prompt "Gentle parallax push-in" --image still.jpg --out clip.mp4       # image → video
//   node veo.mjs --prompt "..." --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { errorMessage } from '../../../engine/lib/errors.mjs';
import {
  pollUntilSettled,
  ProviderReplyError,
  ProviderRequestError,
  ProviderStatusError,
  replyBytes,
  replyJson,
  replyText,
  runProvider,
  sendRequest,
  syncIo,
  validated,
  withTimeout,
} from '../../gemini-tts/scripts/provider-http.mjs';
import { buildRequest, printable, estimateCost } from './veo-request.mjs';
import type { VeoRequestOptions } from './veo-request.mjs';

export const API =
  process.env.GEMINI_API_BASE ??
  'https://generativelanguage.googleapis.com/v1beta';

export const REQUEST_TIMEOUT_MS = 180_000;

/** The fields of a long-running operation this script reads. */
export interface VeoOperation {
  name?: string;
  done?: boolean;
  error?: unknown;
  response?: unknown;
}

export const OperationSchema: Schema.Codec<VeoOperation> = Schema.Struct({
  name: Schema.optionalKey(Schema.String),
  done: Schema.optionalKey(Schema.Boolean),
  error: Schema.optionalKey(Schema.Unknown),
  response: Schema.optionalKey(Schema.Unknown),
});

export const decodeOperation = Schema.decodeUnknownOption(OperationSchema);

export const operation = (json: unknown): VeoOperation =>
  Option.getOrElse(decodeOperation(json), (): VeoOperation => ({}));

export const SampleUriSchema = Schema.Struct({
  generateVideoResponse: Schema.Struct({
    generatedSamples: Schema.NonEmptyArray(
      Schema.Struct({ video: Schema.Struct({ uri: Schema.String }) }),
    ),
  }),
});

export const decodeSampleUri = Schema.decodeUnknownOption(SampleUriSchema);

export const sampleUri = (response: unknown): string | undefined =>
  Option.getOrUndefined(
    Option.map(
      decodeSampleUri(response),
      (r) => r.generateVideoResponse.generatedSamples[0].video.uri,
    ),
  );

export const decodeErrorBody = Schema.decodeUnknownOption(
  Schema.Struct({ error: Schema.Struct({ message: Schema.String }) }),
);

export const call = (
  url: string,
  method: 'GET' | 'POST',
  key: string,
  body?: string,
) =>
  Effect.gen(function* () {
    const reply = yield* sendRequest(url, {
      method,
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body }),
    }).pipe(withTimeout(REQUEST_TIMEOUT_MS, 'Veo request'));
    const json = replyJson(reply);
    if (!reply.ok) {
      const message = Option.getOrUndefined(
        Option.map(decodeErrorBody(json), (e) => e.error.message),
      );
      return yield* new ProviderStatusError({
        status: reply.status,
        message: `Veo ${reply.status}: ${message ?? replyText(reply).slice(0, 400)}`,
      });
    }
    return json;
  });

export interface VeoRunOptions {
  key?: string | undefined;
  out?: string | undefined;
  pollMs?: number | undefined;
  timeoutMs?: number | undefined;
  onPoll?: ((status: VeoOperation) => void) | undefined;
}

/** Generate a clip through the injected provider transport; succeeds with the local file path. */
export const generateVideoEffect = (
  opts: VeoRequestOptions,
  {
    key = process.env.GEMINI_API_KEY,
    out = 'clip.mp4',
    pollMs = 10_000,
    timeoutMs = 12 * 60_000,
    onPoll,
  }: VeoRunOptions = {},
) =>
  Effect.gen(function* () {
    if (!key)
      return yield* new ProviderRequestError({
        message: 'GEMINI_API_KEY is not set',
      });
    const model = opts.model ?? 'veo-3.1-lite-generate-preview';
    const body = yield* validated(() =>
      JSON.stringify(buildRequest({ ...opts, model })),
    );
    const created = yield* call(
      `${API}/models/${model}:predictLongRunning`,
      'POST',
      key,
      body,
    );
    const op = operation(created);
    const name = op.name;
    if (!name)
      return yield* new ProviderReplyError({
        message: `No operation name returned: ${JSON.stringify(created).slice(0, 300)}`,
      });
    const status = yield* pollUntilSettled(op, {
      settled: (s) => Boolean(s.done),
      next: Effect.map(call(`${API}/${name}`, 'GET', key), operation),
      pollMs,
      timeoutMs,
      timedOut: () => `Timed out waiting for ${name}`,
      onPoll,
    });
    if (status.error)
      return yield* new ProviderReplyError({
        message: `Veo operation failed: ${JSON.stringify(status.error)}`,
      });
    const uri = sampleUri(status.response);
    if (!uri)
      return yield* new ProviderReplyError({
        message: `No video in response (it may have been filtered): ${JSON.stringify(status.response ?? status).slice(0, 400)}`,
      });
    const res = yield* sendRequest(uri, {
      headers: { 'x-goog-api-key': key },
      redirect: 'follow',
    }).pipe(withTimeout(REQUEST_TIMEOUT_MS, 'Veo download'));
    if (!res.ok)
      return yield* new ProviderStatusError({
        status: res.status,
        message: `Download failed: ${res.status}`,
      });
    yield* syncIo('Saving the Veo clip', () => {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, replyBytes(res));
    });
    return out;
  });

/** Generate a clip; resolves with the local file path. */
export const generateVideo = (
  opts: VeoRequestOptions,
  options: VeoRunOptions = {},
): Promise<string> => runProvider(generateVideoEffect(opts, options));

export async function main(): Promise<void> {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      model: { type: 'string', default: 'veo-3.1-lite-generate-preview' },
      image: { type: 'string' },
      'last-frame': { type: 'string' },
      aspect: { type: 'string', default: '16:9' },
      resolution: { type: 'string', default: '720p' },
      seconds: { type: 'string', default: '4' },
      seed: { type: 'string' },
      out: { type: 'string', default: 'clip.mp4' },
      'dry-run': { type: 'boolean' },
    },
  });
  const opts = {
    prompt: v.prompt,
    model: v.model,
    image: v.image,
    lastFrame: v['last-frame'],
    aspect: v.aspect,
    resolution: v.resolution,
    seconds: +v.seconds,
    seed: v.seed,
  };
  if (v['dry-run']) {
    const body = printable(buildRequest(opts));
    console.log(
      `POST ${API}/models/${opts.model}:predictLongRunning\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`,
    );
    return;
  }
  const file = await generateVideo(opts, {
    out: v.out,
    onPoll: () => process.stdout.write('.'),
  });
  console.log(`\nwrote ${file}`);
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
export type { VeoModel } from './veo-request.mjs';
export { MODELS } from './veo-request.mjs';
export type { VeoRequestOptions } from './veo-request.mjs';
export type { VeoInstance } from './veo-request.mjs';
export type { VeoParameters } from './veo-request.mjs';
export type { VeoRequest } from './veo-request.mjs';
export { buildRequest } from './veo-request.mjs';
export { estimateCost } from './veo-request.mjs';
