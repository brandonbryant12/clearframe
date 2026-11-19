#!/usr/bin/env node
// The historical request builder remains available for inspecting archived Veo jobs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import {
  ProviderRequestError,
  runProvider,
} from '../../gemini-tts/scripts/provider-http.mjs';
import type { VeoRequestOptions } from './veo-request.mjs';
import { MODEL } from '../../gemini-omni/scripts/omni.mjs';
export {
  buildRequest,
  estimateCost,
  MODELS,
  printable,
} from './veo-request.mjs';

export const retirementMessage = (model = 'Veo 3.1 preview') =>
  `${model} was retired on the Gemini Developer API on October 22, 2026. For a new shot, set the asset model to ${MODEL} and run clearframe plan again. Existing MP4s can be used as file assets.`;

export const generateVideoEffect = (opts: VeoRequestOptions = {}) =>
  Effect.fail(
    new ProviderRequestError({ message: retirementMessage(opts.model) }),
  );

export const generateVideo = (opts: VeoRequestOptions = {}): Promise<string> =>
  runProvider(generateVideoEffect(opts));

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  console.error(retirementMessage());
  process.exitCode = 1;
}
