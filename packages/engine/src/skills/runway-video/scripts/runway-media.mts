import fs from 'node:fs';
import path from 'node:path';

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

import {
  ProviderReplyError,
  ProviderStatusError,
  runProvider,
  sendRequest,
  syncIo,
  withTimeout,
} from '../../gemini-tts/scripts/provider-http.mjs';
import { call, API, REQUEST_TIMEOUT_MS } from './runway-http.mjs';

export const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} satisfies Readonly<Record<string, string>>;

export const mimeLookup = new Map(Object.entries(MIME));

export const DATA_URI_LIMIT = 4.5 * 2 ** 20;

export const UploadSchema = Schema.Struct({
  uploadUrl: Schema.String,
  runwayUri: Schema.String,
  fields: Schema.Record(Schema.String, Schema.String),
});

export const decodeUpload = Schema.decodeUnknownOption(UploadSchema);

/** A URI Runway can read for a local image: inline when small, an ephemeral upload otherwise. */
export const imageUriEffect = (file: string, key: string) =>
  Effect.gen(function* () {
    const data = yield* syncIo(`Reading ${file}`, () => fs.readFileSync(file));
    const mime =
      mimeLookup.get(path.extname(file).toLowerCase()) ?? 'image/png';
    if (data.length <= DATA_URI_LIMIT)
      return `data:${mime};base64,${data.toString('base64')}`;
    const ticket = JSON.stringify({
      filename: path.basename(file),
      type: 'ephemeral',
    });
    const up = Option.getOrUndefined(
      decodeUpload(yield* call(`${API}/v1/uploads`, 'POST', key, ticket)),
    );
    if (!up)
      return yield* new ProviderReplyError({
        message: 'Runway upload returned no upload URL',
      });
    const form = new FormData();
    for (const [k, v] of Object.entries(up.fields)) form.append(k, v);
    form.append(
      'file',
      new Blob([new Uint8Array(data)], { type: mime }),
      path.basename(file),
    );
    const res = yield* sendRequest(up.uploadUrl, {
      method: 'POST',
      body: form,
    }).pipe(withTimeout(REQUEST_TIMEOUT_MS, 'Runway upload'));
    if (!res.ok)
      return yield* new ProviderStatusError({
        status: res.status,
        message: `Runway upload failed: ${res.status}`,
      });
    return up.runwayUri;
  });

export const imageUri = (file: string, key: string): Promise<string> =>
  runProvider(imageUriEffect(file, key));
