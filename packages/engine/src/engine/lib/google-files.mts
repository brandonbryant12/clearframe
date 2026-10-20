// Google Files API: upload a take for transcription, wait for a file to be ACTIVE, delete it, and
// download generated video without ever forwarding the API key off Google's own origin.
import fs from 'node:fs';
import * as Clock from 'effect/Clock';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { API } from '../../skills/gemini-tts/scripts/gemini.mjs';
import { errorMessage } from './errors.mjs';
import {
  ProviderReplyError,
  ProviderRequestError,
  ProviderStatusError,
  ProviderTimeoutError,
  replyBytes,
  replyJson,
  runProvider,
  sendRequest,
  syncIo,
  withTimeout,
} from '../../skills/gemini-tts/scripts/provider-http.mjs';
import type { HttpReply } from '../../skills/gemini-tts/scripts/provider-http.mjs';

const base = new URL(API);
const REQUEST_TIMEOUT_MS = 180_000;
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const apiKeyHeader = (key: string | undefined) =>
  key
    ? Effect.succeed({ 'x-goog-api-key': key })
    : Effect.fail(
        new ProviderRequestError({ message: 'GEMINI_API_KEY is not set' }),
      );

/** One Files API request: redirects refused, a time limit, and any non-2xx status reported. */
const request = (url: string, init: RequestInit) =>
  Effect.gen(function* () {
    const reply = yield* sendRequest(url, { ...init, redirect: 'error' }).pipe(
      withTimeout(REQUEST_TIMEOUT_MS, 'Google Files request'),
    );
    if (!reply.ok)
      return yield* new ProviderStatusError({
        status: reply.status,
        message: `Google Files HTTP ${reply.status}`,
      });
    return reply;
  });

/** `files/ID` from a Files API name, path or URL on the API's own origin; anything else is refused. */
export function fileName(uri: unknown): string {
  if (typeof uri !== 'string') throw new Error('Missing Google file URI');
  let target = uri;
  if (target.startsWith('https:') || target.startsWith('http:')) {
    const u = new URL(target);
    if (u.origin !== base.origin) throw new Error('Untrusted Google file URI');
    target = u.pathname;
  }
  const id = target.match(
    /(?:^|\/)files\/([a-zA-Z0-9_-]+)(?=:download|\?|$)/,
  )?.[1];
  if (!id) throw new Error('Invalid Google file URI');
  return `files/${id}`;
}
const fileNameEffect = (uri: unknown) =>
  Effect.try({
    try: () => fileName(uri),
    catch: (cause) =>
      new ProviderRequestError({ message: errorMessage(cause), cause }),
  });

/** A Files API file, with the fields this engine reads; the rest are kept. */
export interface GoogleFile {
  readonly name?: string;
  readonly uri?: string;
  readonly state?: string | { readonly name?: string };
  readonly [key: string]: unknown;
}
const GoogleFileSchema: Schema.Codec<GoogleFile> = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.optionalKey(Schema.String),
    uri: Schema.optionalKey(Schema.String),
    state: Schema.optionalKey(
      Schema.Union([
        Schema.String,
        Schema.Struct({ name: Schema.optionalKey(Schema.String) }),
      ]),
    ),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const decodeGoogleFile = Schema.decodeUnknownOption(GoogleFileSchema);
const fileState = (f: GoogleFile): string | undefined =>
  typeof f.state === 'string' ? f.state : f.state?.name;

export interface FileCredentials {
  key?: string | undefined;
}
export interface WaitOptions extends FileCredentials {
  timeoutMs?: number | undefined;
  pollMs?: number | undefined;
}

/** Poll a file until it is ACTIVE; FAILED, or still processing at the deadline, fails. */
export const waitFileEffect = (
  name: string,
  {
    key = process.env.GEMINI_API_KEY,
    timeoutMs = 180_000,
    pollMs = 2000,
  }: WaitOptions = {},
) =>
  Effect.gen(function* () {
    const end = (yield* Clock.currentTimeMillis) + timeoutMs;
    const url = `${API}/${yield* fileNameEffect(name)}`;
    for (;;) {
      const reply = yield* request(url, { headers: yield* apiKeyHeader(key) });
      const f = Option.getOrElse(
        decodeGoogleFile(replyJson(reply)),
        (): GoogleFile => ({}),
      );
      const state = fileState(f);
      if (state === 'ACTIVE') return f;
      if (state === 'FAILED')
        return yield* new ProviderReplyError({
          message: 'Google file processing failed',
        });
      if ((yield* Clock.currentTimeMillis) >= end)
        return yield* new ProviderTimeoutError({
          timeoutMs,
          message: 'Google file processing timed out',
        });
      yield* Effect.sleep(Duration.millis(pollMs));
    }
  });
export const waitFile = (
  name: string,
  options: WaitOptions = {},
): Promise<GoogleFile> => runProvider(waitFileEffect(name, options));

/** An uploaded file: its Files API name and URI (other metadata is kept). */
export interface UploadedFile {
  readonly name: string;
  readonly uri: string;
  readonly [key: string]: unknown;
}
const UploadedSchema = Schema.Struct({
  file: Schema.StructWithRest(
    Schema.Struct({ name: Schema.String, uri: Schema.String }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
});
const decodeUploaded = Schema.decodeUnknownOption(UploadedSchema);

/** The resumable session URL, only when it stays on the API's origin. */
function sessionUrl(reply: HttpReply): string | null {
  const uri = reply.headers.get('x-goog-upload-url');
  if (!uri) return null;
  try {
    return new URL(uri).origin === base.origin ? uri : null;
  } catch {
    return null;
  }
}

/** Upload a WAV (nonempty, under 50 MB) with the resumable protocol. */
export const uploadAudioEffect = (
  file: string,
  { key = process.env.GEMINI_API_KEY }: FileCredentials = {},
) =>
  Effect.gen(function* () {
    const bytes = yield* syncIo(`Reading ${file}`, () => fs.readFileSync(file));
    if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES)
      return yield* new ProviderRequestError({
        message:
          'Speech upload must be a nonempty WAV under 50 MB; split longer recordings into beats.',
      });
    const start = yield* request(`${base.origin}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        ...(yield* apiKeyHeader(key)),
        'content-type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(bytes.length),
        'X-Goog-Upload-Header-Content-Type': 'audio/wav',
      },
      body: JSON.stringify({
        file: { display_name: 'ClearFrame speech alignment' },
      }),
    });
    const uri = sessionUrl(start);
    if (!uri)
      return yield* new ProviderReplyError({
        message: 'Invalid resumable upload URL',
      });
    const done = yield* request(uri, {
      method: 'POST',
      headers: {
        'content-length': String(bytes.length),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: new Uint8Array(bytes),
    });
    const uploaded = Option.getOrUndefined(decodeUploaded(replyJson(done)));
    if (!uploaded?.file.uri || !uploaded.file.name)
      return yield* new ProviderReplyError({
        message: 'Missing uploaded file metadata',
      });
    const result: UploadedFile = uploaded.file;
    return result;
  });
export const uploadAudio = (
  file: string,
  options: FileCredentials = {},
): Promise<UploadedFile> => runProvider(uploadAudioEffect(file, options));

export const deleteFileEffect = (
  name: string,
  { key = process.env.GEMINI_API_KEY }: FileCredentials = {},
) =>
  Effect.gen(function* () {
    const target = `${API}/${yield* fileNameEffect(name)}`;
    yield* request(target, {
      method: 'DELETE',
      headers: yield* apiKeyHeader(key),
    });
  });
export const deleteFile = (
  name: string,
  options: FileCredentials = {},
): Promise<void> => runProvider(deleteFileEffect(name, options));

const MAX_REDIRECTS = 5;

/** Follow up to five HTTPS redirects by hand, sending the key only to the API's own origin. */
const followDownload = (start: string, key: string) =>
  Effect.gen(function* () {
    let url = start;
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
      const headers: Record<string, string> =
        new URL(url).origin === base.origin ? { 'x-goog-api-key': key } : {};
      const r = yield* sendRequest(url, { headers, redirect: 'manual' }).pipe(
        withTimeout(REQUEST_TIMEOUT_MS, 'Video download'),
      );
      if (r.status >= 300 && r.status < 400) {
        const location = r.headers.get('location');
        if (!location)
          return yield* new ProviderReplyError({
            message: 'Missing download redirect',
          });
        const next = new URL(location, url);
        if (next.protocol !== 'https:')
          return yield* new ProviderReplyError({
            message: 'Insecure video download redirect',
          });
        url = next.href;
        continue;
      }
      if (!r.ok)
        return yield* new ProviderStatusError({
          status: r.status,
          message: `Video download HTTP ${r.status}`,
        });
      return replyBytes(r);
    }
    return yield* new ProviderReplyError({
      message: 'Too many video download redirects',
    });
  });

/** Wait for a generated video file, then download its bytes. */
export const downloadVideoEffect = (
  uri: string,
  { key = process.env.GEMINI_API_KEY, pollMs, timeoutMs }: WaitOptions = {},
) =>
  Effect.gen(function* () {
    const name = yield* fileNameEffect(uri);
    yield* waitFileEffect(name, { key, pollMs, timeoutMs });
    const apiKey = (yield* apiKeyHeader(key))['x-goog-api-key'];
    return yield* followDownload(`${API}/${name}:download?alt=media`, apiKey);
  });
export const downloadVideo = (
  uri: string,
  options: WaitOptions = {},
): Promise<Buffer> => runProvider(downloadVideoEffect(uri, options));
