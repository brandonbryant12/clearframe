#!/usr/bin/env node
// Preserve the migration notice for old CLI invocations and storyboard model IDs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODEL } from '../../gemini-omni/scripts/omni.mjs';

export const retiredModels = new Set([
  'veo-3.1-lite-generate-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.1-generate-preview',
]);

export const retirementMessage = (model = 'Veo 3.1 preview') =>
  `${model} was retired on the Gemini Developer API on October 22, 2026. For a new shot, set the asset model to ${MODEL} and run clearframe plan again. Existing MP4s can be used as file assets.`;

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  console.error(retirementMessage());
  process.exitCode = 1;
}
