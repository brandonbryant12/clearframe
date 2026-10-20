#!/usr/bin/env node
// Runway Dev video generation (Seedance 2.5 / 2.0, Gen-4.5). Node ≥ 22.
//
// Contract (verified against docs.dev.runwayml.com/api.md, 2026-10-04):
//   POST https://api.dev.runwayml.com/v1/image_to_video | /v1/text_to_video
//   headers: Authorization: Bearer $RUNWAYML_API_SECRET, X-Runway-Version: 2024-11-06
//   body (per model): { model, promptText, promptImage?: [{uri, position: "first"|"last"}], ratio, duration, seed?, audio? }
//   → { id }; poll GET /v1/tasks/{id} until SUCCEEDED (output[0] is a temporary URL) or FAILED (failure, failureCode).
//   Images: data URIs up to 5 MB, else POST /v1/uploads {filename, type:"ephemeral"} → multipart POST → runwayUri.
//   Moderated outputs fail with failureCode SAFETY.* and cost 0 credits, but repeated moderation can suspend an account.
//
// Usage:
//   node runway.mjs --prompt "..." --image first.png [--last last.png] --seconds 5 --out clip.mp4
//   node runway.mjs --prompt "..." --model gen4.5 --seconds 5 --dry-run
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
  runProvider,
  sendRequest,
  syncIo,
  validated,
  withTimeout,
} from '../../gemini-tts/scripts/provider-http.mjs';
import { buildRequest, estimateCost } from './runway-request.mjs';
import type { RunwayRequestOptions } from './runway-request.mjs';
import { imageUriEffect } from './runway-media.mjs';
import { call, API, REQUEST_TIMEOUT_MS } from './runway-http.mjs';

/** The fields of a Runway task this script reads. */
export interface RunwayTask {
  id?: string;
  status?: string;
  failure?: string;
  failureCode?: string;
  output?: readonly string[];
}

export const TaskSchema: Schema.Codec<RunwayTask> = Schema.Struct({
  id: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(Schema.String),
  failure: Schema.optionalKey(Schema.String),
  failureCode: Schema.optionalKey(Schema.String),
  output: Schema.optionalKey(Schema.Array(Schema.String)),
});

export const decodeTask = Schema.decodeUnknownOption(TaskSchema);

export const task = (json: unknown): RunwayTask =>
  Option.getOrElse(decodeTask(json), (): RunwayTask => ({}));

export const FINISHED: readonly string[] = ['SUCCEEDED', 'FAILED', 'CANCELLED'];

export function failureMessage(
  id: string | undefined,
  status: RunwayTask,
): string {
  const moderated = String(status.failureCode ?? '').startsWith('SAFETY');
  return moderated
    ? `Runway moderation blocked task ${id} (${status.failureCode}). No credits were charged, but repeated blocks can suspend the account: reframe the subject (wider, from behind, less face-forward) or route this shot to another provider.`
    : `Runway task ${id} ${status.status}: ${status.failure ?? ''} ${status.failureCode ?? ''}`.trim();
}

export interface RunwayRunOptions {
  key?: string | undefined;
  out?: string | undefined;
  pollMs?: number | undefined;
  timeoutMs?: number | undefined;
  onPoll?: ((status: RunwayTask) => void) | undefined;
}

export interface RunwayResult {
  file: string;
  taskId: string | undefined;
}

/** Generate a clip through the injected provider transport. Moderation failures say so plainly. */
export const generateVideoEffect = (
  opts: RunwayRequestOptions,
  {
    key = process.env.RUNWAYML_API_SECRET,
    out = 'clip.mp4',
    pollMs = 6_000,
    timeoutMs = 30 * 60_000,
    onPoll,
  }: RunwayRunOptions = {},
) =>
  Effect.gen(function* () {
    if (!key)
      return yield* new ProviderRequestError({
        message: 'RUNWAYML_API_SECRET is not set',
      });
    const images: string[] = [];
    for (const f of opts.images ?? [])
      images.push(yield* imageUriEffect(f, key));
    const { endpoint, body } = yield* validated(() =>
      buildRequest({ ...opts, images }),
    );
    const created = task(
      yield* call(`${API}${endpoint}`, 'POST', key, JSON.stringify(body)),
    );
    const status = yield* pollUntilSettled(created, {
      settled: (s) => FINISHED.includes(s.status ?? ''),
      next: Effect.map(call(`${API}/v1/tasks/${created.id}`, 'GET', key), task),
      pollMs,
      timeoutMs,
      timedOut: () => `Timed out waiting for Runway task ${created.id}`,
      onPoll,
    });
    if (status.status !== 'SUCCEEDED')
      return yield* new ProviderReplyError({
        message: failureMessage(created.id, status),
      });
    const output = status.output?.[0];
    if (!output)
      return yield* new ProviderReplyError({
        message: `Runway task ${created.id} returned no output`,
      });
    const res = yield* sendRequest(output, {}).pipe(
      withTimeout(REQUEST_TIMEOUT_MS, 'Runway download'),
    );
    if (!res.ok)
      return yield* new ProviderStatusError({
        status: res.status,
        message: `Download failed: ${res.status}`,
      });
    yield* syncIo('Saving the Runway clip', () => {
      fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      fs.writeFileSync(out, replyBytes(res));
    });
    const result: RunwayResult = { file: out, taskId: created.id };
    return result;
  });

/** Generate a clip; resolves with { file, taskId }. Moderation failures say so plainly. */
export const generateVideo = (
  opts: RunwayRequestOptions,
  options: RunwayRunOptions = {},
): Promise<RunwayResult> => runProvider(generateVideoEffect(opts, options));

export async function main(): Promise<void> {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      model: { type: 'string', default: 'seedance2_5' },
      image: { type: 'string' },
      last: { type: 'string' },
      aspect: { type: 'string', default: '16:9' },
      resolution: { type: 'string', default: '720p' },
      seconds: { type: 'string', default: '5' },
      seed: { type: 'string' },
      out: { type: 'string', default: 'clip.mp4' },
      'dry-run': { type: 'boolean' },
    },
  });
  const images = [v.image, v.last].filter((f): f is string => Boolean(f));
  const opts = {
    prompt: v.prompt,
    model: v.model,
    aspect: v.aspect,
    resolution: v.resolution,
    seconds: +v.seconds,
    seed: v.seed,
    images,
  };
  if (v['dry-run']) {
    const { endpoint, body } = buildRequest({
      ...opts,
      images: opts.images.map(() => 'data:<image>'),
    });
    console.log(
      `POST ${API}${endpoint}\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`,
    );
    return;
  }
  const { file } = await generateVideo(opts, {
    out: v.out,
    onPoll: (s) => process.stdout.write(s.status === 'RUNNING' ? '.' : '·'),
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
export { API } from './runway-http.mjs';
export { VERSION } from './runway-http.mjs';
export type { RunwayModel } from './runway-request.mjs';
export { MODELS } from './runway-request.mjs';
export { ratioFor } from './runway-request.mjs';
export type { RunwayRequestOptions } from './runway-request.mjs';
export type { RunwayBody } from './runway-request.mjs';
export { buildRequest } from './runway-request.mjs';
export { estimateCost } from './runway-request.mjs';
export { imageUriEffect } from './runway-media.mjs';
export { imageUri } from './runway-media.mjs';
