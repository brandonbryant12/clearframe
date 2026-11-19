// Gemini Omni video inserts via the Interactions API: ordered continuity frames, then the prompt;
// the MP4 comes back inline or as a Files API URI that is downloaded once it is ACTIVE.
import fs from 'node:fs';
import path from 'node:path';
import * as Effect from 'effect/Effect';
import {
  interaction,
  outputBlocksEffect,
  postEffect,
} from '../../gemini-tts/scripts/gemini.mjs';
import type { PostOptions } from '../../gemini-tts/scripts/gemini.mjs';
import {
  ProviderReplyError,
  runProvider,
  validated,
} from '../../gemini-tts/scripts/provider-http.mjs';
import { downloadVideoEffect } from '../../../engine/lib/google-files.mjs';
import type { WaitOptions } from '../../../engine/lib/google-files.mjs';

export const MODEL = 'gemini-omni-1.2-flash';
export const LEGACY_MODEL = 'gemini-omni-1.1-flash';
export const isOmni = (model: string) =>
  model === MODEL || model === LEGACY_MODEL;
const tokensPerSecond = new Map([
  ['360p', 1931],
  ['720p', 5792],
  ['1080p', 8688],
  ['4k', 17376],
]);

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} satisfies Readonly<Record<string, string>>;
const mimeLookup = new Map(Object.entries(MIME));

export interface OmniRequestOptions {
  prompt?: string | undefined;
  aspect?: string | undefined;
  resolution?: string | undefined;
  refs?: readonly string[] | undefined;
  previousInteractionId?: string | undefined;
  seconds?: number | undefined;
  model?: string | undefined;
}
export type OmniOptions = OmniRequestOptions & PostOptions & WaitOptions;
export type OmniInput =
  | { type: 'image'; mime_type: string; data: string }
  | { type: 'text'; text: string };
export interface OmniRequest {
  model: string;
  input: OmniInput[];
  response_format: {
    type: 'video';
    aspect_ratio: string;
    resolution: string;
    delivery: 'uri';
    duration?: string;
  };
  previous_interaction_id?: string;
}

export function buildRequest({
  prompt,
  aspect = '16:9',
  resolution = '720p',
  refs = [],
  previousInteractionId,
  seconds = 4,
  model = MODEL,
}: OmniRequestOptions): OmniRequest {
  if (!isOmni(model)) throw new Error(`Supported Omni model: ${MODEL}`);
  if (!prompt?.trim()) throw new Error('Omni needs a prompt');
  if (
    !['16:9', '9:16'].includes(aspect) ||
    !['360p', '720p', '1080p', '4k'].includes(resolution)
  )
    throw new Error('Unsupported Omni aspect or resolution');
  validateClip(model, seconds, refs.length, previousInteractionId);
  const input: OmniInput[] = refs.map((file) => {
    const mime = mimeLookup.get(path.extname(file).toLowerCase());
    if (!mime)
      throw new Error('Continuity references must be PNG, JPEG or WebP');
    return {
      type: 'image',
      mime_type: mime,
      data: fs.readFileSync(file).toString('base64'),
    };
  });
  input.push({ type: 'text', text: prompt });
  return {
    model,
    input,
    response_format: {
      type: 'video',
      aspect_ratio: aspect,
      resolution,
      delivery: 'uri',
      ...(model === MODEL ? { duration: `${seconds}s` } : {}),
    },
    ...(previousInteractionId
      ? { previous_interaction_id: previousInteractionId }
      : {}),
  };
}

export function validateClip(
  model: string,
  seconds: number,
  refs: number,
  previous?: string,
): void {
  const maxRefs = model === MODEL ? 6 : 2;
  if (refs > maxRefs)
    throw new Error(`${model} supports at most ${maxRefs} reference images`);
  if (model === MODEL) {
    const max = previous || refs === 2 ? 10 : 15;
    if (!Number.isInteger(seconds) || seconds < 3 || seconds > max)
      throw new Error(
        `This Omni shot needs a whole number of seconds between 3 and ${max}`,
      );
  } else if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 10)
    throw new Error(
      'Omni 1.1 shots must be longer than zero and at most 10 seconds',
    );
}

/** Estimated output cost. Input and thought tokens can add to the bill. */
export function estimateCost({
  seconds = 4,
  resolution = '720p',
  model = MODEL,
}: Pick<OmniRequestOptions, 'seconds' | 'resolution' | 'model'> = {}): number {
  if (!isOmni(model)) throw new Error(`Unsupported Omni model ${model}`);
  validateClip(model, seconds, 0);
  const tokens = tokensPerSecond.get(resolution);
  if (!tokens || (model === LEGACY_MODEL && resolution !== '720p'))
    throw new Error(
      `Unsupported budgeted resolution ${resolution} for ${model}`,
    );
  return (seconds * tokens * (model === MODEL ? 12 : 17.5)) / 1e6;
}

export interface OmniVideo {
  data: Buffer;
  interactionId: string | undefined;
  usage: unknown;
}

/** Generate one insert through the injected provider transport; the MP4 is checked for its `ftyp` box. */
export const generateVideoEffect = (opts: OmniOptions) =>
  Effect.gen(function* () {
    const body = yield* validated(() => buildRequest(opts));
    const result = yield* postEffect('/interactions', body, {
      ...opts,
      retries: 0,
      timeoutMs: 600_000,
    });
    const video = (yield* outputBlocksEffect(result, 'video')).at(-1);
    if (video?.mime_type !== 'video/mp4')
      return yield* new ProviderReplyError({
        message: 'Omni did not return an MP4',
      });
    let data: Buffer | null = null;
    if (video.data) data = Buffer.from(video.data, 'base64');
    else if (video.uri) data = yield* downloadVideoEffect(video.uri, opts);
    if (!data?.length || data.toString('ascii', 4, 8) !== 'ftyp')
      return yield* new ProviderReplyError({
        message: 'Omni returned empty or invalid MP4 data',
      });
    const { id, usage } = interaction(result);
    const made: OmniVideo = { data, interactionId: id, usage };
    return made;
  });

/** Generate one insert. Resolves with { data, interactionId, usage }. */
export const generateVideo = (opts: OmniOptions): Promise<OmniVideo> =>
  runProvider(generateVideoEffect(opts));
