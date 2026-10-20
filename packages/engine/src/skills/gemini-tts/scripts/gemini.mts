// The Gemini Interactions API shared by speech, image, music, Omni and transcription:
//   POST {API}{pathname}  header: x-goog-api-key  → { status, id, usage, steps: [{ type: "model_output", content: [...] }] }
// Requests that hit a rate limit or a 5xx are retried with exponential backoff (2 s, 4 s, 8 s …);
// anything else, including a transport failure or a timeout, is reported once.
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import { errorMessage } from '../../../engine/lib/errors.mjs';
import {
  ProviderReplyError,
  ProviderRequestError,
  ProviderStatusError,
  replyJson,
  replyText,
  runProvider,
  sendRequest,
  withTimeout,
} from './provider-http.mjs';

export const API =
  process.env.GEMINI_API_BASE ??
  'https://generativelanguage.googleapis.com/v1beta';

/** One content block of a model output: text, or inline/URI media. */
export interface OutputBlock {
  type: string;
  text?: string;
  data?: string;
  uri?: string;
  mime_type?: string;
  sample_rate?: number;
  channels?: number;
}
const OutputBlockSchema: Schema.Codec<OutputBlock> = Schema.Struct({
  type: Schema.String,
  text: Schema.optionalKey(Schema.String),
  data: Schema.optionalKey(Schema.String),
  uri: Schema.optionalKey(Schema.String),
  mime_type: Schema.optionalKey(Schema.String),
  sample_rate: Schema.optionalKey(Schema.Finite),
  channels: Schema.optionalKey(Schema.Finite),
});

interface InteractionStep {
  type?: string;
  content?: readonly unknown[];
}
/** The fields of an Interaction this engine reads; blocks are decoded one by one. */
export interface Interaction {
  status?: string;
  id?: string;
  error?: unknown;
  usage?: unknown;
  steps?: readonly InteractionStep[];
}
const InteractionSchema: Schema.Codec<Interaction> = Schema.Struct({
  status: Schema.optionalKey(Schema.String),
  id: Schema.optionalKey(Schema.String),
  error: Schema.optionalKey(Schema.Unknown),
  usage: Schema.optionalKey(Schema.Unknown),
  steps: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        type: Schema.optionalKey(Schema.String),
        content: Schema.optionalKey(Schema.Array(Schema.Unknown)),
      }),
    ),
  ),
});
const decodeInteraction = Schema.decodeUnknownOption(InteractionSchema);
const decodeBlock = Schema.decodeUnknownOption(OutputBlockSchema);

/** An Interaction response as far as it can be read; anything else reads as an empty one. */
export const interaction = (json: unknown): Interaction =>
  Option.getOrElse(decodeInteraction(json), (): Interaction => ({}));

/** Output blocks of a given type from an Interaction response. Throws for an unfinished interaction. */
export function outputBlocks(response: unknown, type: string): OutputBlock[] {
  const view = interaction(response);
  if (view.status && view.status !== 'completed') {
    throw new Error(
      `interaction ${view.status}${view.error ? `: ${JSON.stringify(view.error)}` : ''}`,
    );
  }
  return (view.steps ?? [])
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .flatMap((c) => Option.toArray(decodeBlock(c)))
    .filter((c) => c.type === type);
}

const ErrorBodySchema = Schema.Struct({
  error: Schema.Struct({ message: Schema.String }),
});
const decodeErrorBody = Schema.decodeUnknownOption(ErrorBodySchema);
const providerMessage = (json: unknown): string | undefined =>
  Option.getOrUndefined(
    Option.map(decodeErrorBody(json), (e) => e.error.message),
  );

export interface PostOptions {
  readonly key?: string | undefined;
  readonly retries?: number | undefined;
  readonly timeoutMs?: number | undefined;
}
const RETRYABLE: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/** POST a JSON body to the Interactions API; succeeds with the parsed reply (null when not JSON). */
export function postEffect<B>(
  pathname: string,
  body: B,
  options: PostOptions = {},
) {
  const {
    key = process.env.GEMINI_API_KEY,
    retries = 4,
    timeoutMs = 180_000,
  } = options;
  const attempt = (apiKey: string) =>
    Effect.gen(function* () {
      const reply = yield* sendRequest(`${API}${pathname}`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      }).pipe(withTimeout(timeoutMs, 'Gemini request'));
      const json = replyJson(reply);
      if (reply.ok) return json;
      return yield* new ProviderStatusError({
        status: reply.status,
        message: `Gemini ${reply.status}: ${providerMessage(json) ?? replyText(reply).slice(0, 400)}`,
      });
    });
  return Effect.gen(function* () {
    if (!key)
      return yield* new ProviderRequestError({
        message: 'GEMINI_API_KEY is not set',
      });
    return yield* attempt(key).pipe(
      Effect.retry({
        schedule: Schedule.exponential(Duration.millis(2000)),
        times: retries,
        while: (e) =>
          e._tag === 'ProviderStatusError' && RETRYABLE.has(e.status),
      }),
    );
  });
}

/** Promise adapter for {@link postEffect}. */
export const post = <B,>(
  pathname: string,
  body: B,
  options: PostOptions = {},
): Promise<unknown> => runProvider(postEffect(pathname, body, options));

/** The text blocks of a reply joined by lines (model notes, lyrics, structure). */
export const outputText = (response: unknown): string =>
  outputBlocks(response, 'text')
    .map((t) => t.text)
    .join('\n');

/** `outputBlocks` inside an Effect: an unfinished interaction fails with its message. */
export const outputBlocksEffect = (response: unknown, type: string) =>
  Effect.try({
    try: () => outputBlocks(response, type),
    catch: (cause) =>
      new ProviderReplyError({ message: errorMessage(cause), cause }),
  });
