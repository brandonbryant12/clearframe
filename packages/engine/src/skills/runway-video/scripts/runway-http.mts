import * as Effect from 'effect/Effect';

import { isRecord } from '../../../engine/lib/errors.mjs';
import {
  ProviderStatusError,
  replyJson,
  replyText,
  sendRequest,
  withTimeout,
} from '../../gemini-tts/scripts/provider-http.mjs';

export const API =
  process.env.RUNWAY_API_BASE ?? 'https://api.dev.runwayml.com';

export const VERSION = '2024-11-06';

export const REQUEST_TIMEOUT_MS = 180_000;

/** Runway's error text: its `error` field as written, else the start of the body. */
export const runwayError = (json: unknown, text: string): string =>
  isRecord(json) && json.error != null
    ? String(json.error)
    : text.slice(0, 400);

export const call = (
  url: string,
  method: 'GET' | 'POST',
  key: string,
  body?: string,
) =>
  Effect.gen(function* () {
    const reply = yield* sendRequest(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        'X-Runway-Version': VERSION,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body }),
    }).pipe(withTimeout(REQUEST_TIMEOUT_MS, 'Runway request'));
    const json = replyJson(reply);
    if (!reply.ok)
      return yield* new ProviderStatusError({
        status: reply.status,
        message: `Runway ${reply.status}: ${runwayError(json, replyText(reply))}`,
      });
    return json;
  });
