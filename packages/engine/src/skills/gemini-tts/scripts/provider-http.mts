// One HTTP transport for the paid media providers (Gemini, Google Files, Veo, Runway). The live
// layer resolves `globalThis.fetch` on every request, so a stand-in transport (tests, a proxy) is
// a layer, and each request owns an AbortController that is aborted when its scope closes: a
// timeout or an interrupted run cancels the socket instead of leaving it to finish unseen.
import * as Clock from 'effect/Clock';
import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import { runCommandEffect } from '../../../engine/lib/command-scope.mjs';
import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { errorMessage } from '../../../engine/lib/errors.mjs';

/** A provider's reply, read to the end. */
export interface HttpReply {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly body: Uint8Array;
}

/** The request never produced a reply (DNS, refused connection, a stand-in transport that throws). */
export class ProviderTransportError extends Data.TaggedError(
  'ProviderTransportError',
)<{
  readonly url: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}
/** No reply (or no settled job) within the allowance. */
export class ProviderTimeoutError extends Data.TaggedError(
  'ProviderTimeoutError',
)<{
  readonly message: string;
  readonly timeoutMs: number;
}> {}
/** The provider answered with a non-success status. */
export class ProviderStatusError extends Data.TaggedError(
  'ProviderStatusError',
)<{
  readonly status: number;
  readonly message: string;
}> {}
/** The provider answered, but not with what the contract promises (no audio, a foreign URL…). */
export class ProviderReplyError extends Data.TaggedError('ProviderReplyError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
/** Refused before anything was sent: a missing key or an invalid request. Nothing was charged. */
export class ProviderRequestError extends Data.TaggedError(
  'ProviderRequestError',
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type ProviderError =
  | ProviderTransportError
  | ProviderTimeoutError
  | ProviderStatusError
  | ProviderReplyError
  | ProviderRequestError;

export class ProviderHttp extends Context.Service<
  ProviderHttp,
  {
    readonly send: (
      url: string,
      init: RequestInit,
    ) => Effect.Effect<HttpReply, ProviderTransportError>;
  }
>()('clearframe/providers/ProviderHttp') {}

const transportError = (url: string) => (cause: unknown) =>
  new ProviderTransportError({ url, message: errorMessage(cause), cause });

/** Send one request and read its body, inside a scope that aborts the request on any exit. */
const send = (
  url: string,
  init: RequestInit,
): Effect.Effect<HttpReply, ProviderTransportError> =>
  Effect.scoped(
    Effect.gen(function* () {
      const controller = yield* Effect.acquireRelease(
        Effect.sync(() => new AbortController()),
        (c) => Effect.sync(() => c.abort()),
      );
      const response = yield* Effect.tryPromise({
        try: () =>
          globalThis.fetch(url, { ...init, signal: controller.signal }),
        catch: transportError(url),
      });
      const body = yield* Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: transportError(url),
      });
      return {
        status: response.status,
        ok: response.ok,
        headers: response.headers,
        body: new Uint8Array(body),
      };
    }),
  );

export const ProviderHttpLive = Layer.succeed(ProviderHttp, { send });

/** Send through whichever transport the context provides. */
export const sendRequest = (url: string, init: RequestInit) =>
  Effect.flatMap(ProviderHttp, (http) => http.send(url, init));

/** Fail with a ProviderTimeoutError (interrupting the work, so its request is aborted) after `timeoutMs`. */
export const withTimeout =
  (timeoutMs: number, label: string) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | ProviderTimeoutError, R> =>
    Effect.timeoutOrElse(effect, {
      duration: Duration.millis(timeoutMs),
      orElse: () =>
        Effect.fail(
          new ProviderTimeoutError({
            timeoutMs,
            message: `${label} timed out after ${Math.round(timeoutMs / 1000)} s`,
          }),
        ),
    });

const decoder = new TextDecoder();
export const replyText = (reply: HttpReply): string =>
  decoder.decode(reply.body);
export const replyBytes = (reply: HttpReply): Buffer => Buffer.from(reply.body);

/** The reply body as JSON, or null when it is not JSON (providers' error pages are not). */
const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Unknown),
);
export function replyJson(reply: HttpReply) {
  try {
    return decodeJson(replyText(reply));
  } catch {
    return null;
  }
}

/** How a long-running provider job is polled until it settles. */
export interface PollPlan<A, E, R> {
  readonly settled: (status: A) => boolean;
  readonly next: Effect.Effect<A, E, R>;
  readonly pollMs: number;
  readonly timeoutMs: number;
  readonly timedOut: () => string;
  readonly onPoll?: ((status: A) => void) | undefined;
}

/**
 * Poll from `first` until `settled`: past the deadline (counted from now) it fails before waiting
 * again; otherwise it waits `pollMs`, asks again and reports each answer to `onPoll`.
 */
export function pollUntilSettled<A, E, R>(
  first: A,
  plan: PollPlan<A, E, R>,
): Effect.Effect<A, E | ProviderTimeoutError, R> {
  return Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + plan.timeoutMs;
    let status = first;
    while (!plan.settled(status)) {
      if ((yield* Clock.currentTimeMillis) > deadline)
        return yield* new ProviderTimeoutError({
          timeoutMs: plan.timeoutMs,
          message: plan.timedOut(),
        });
      yield* Effect.sleep(Duration.millis(plan.pollMs));
      status = yield* plan.next;
      plan.onPoll?.(status);
    }
    return status;
  });
}

/** Local file work around a provider call (reading a reference, saving its output), as an Effect. */
export const syncIo = <A,>(
  label: string,
  run: () => A,
): Effect.Effect<A, ProviderReplyError> =>
  Effect.try({
    try: run,
    catch: (cause) =>
      new ProviderReplyError({
        message: `${label}: ${errorMessage(cause)}`,
        cause,
      }),
  });

/** Refuse before sending: a thrown validation error becomes a ProviderRequestError with its message. */
export const validated = <A,>(
  build: () => A,
): Effect.Effect<A, ProviderRequestError> =>
  Effect.try({
    try: build,
    catch: (cause) =>
      new ProviderRequestError({ message: errorMessage(cause), cause }),
  });

/**
 * Promise adapter for the existing callers: run with the live transport. Failures reject with
 * the tagged error itself (an Error whose message is the provider's), never a wrapper.
 */
export function runProvider<A, E>(
  effect: Effect.Effect<A, E, ProviderHttp>,
  signal?: AbortSignal,
): Promise<A> {
  return runCommandEffect(Effect.provide(effect, ProviderHttpLive), signal);
}
