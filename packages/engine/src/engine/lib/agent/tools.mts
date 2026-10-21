import type { ToolHandlers, ToolOptions } from './contracts.mjs';
import { createCatalogTools } from './tool-catalog.mjs';
import { createEditTools } from './tool-edit.mjs';
import { createRenderTools } from './tool-render.mjs';
import { createFilesTools } from './tool-files.mjs';
import { createSoundTools } from './tool-sound.mjs';
export { GUIDES } from './tool-common.mjs';
export { opsFromText, voiceRecord } from './tool-json.mjs';
export { pictureSize, inside, lookImage } from './tool-media.mjs';
export { scopeViolation } from './tool-scope.mjs';

export function createTools(options: ToolOptions): ToolHandlers {
  return {
    ...createCatalogTools(options),
    ...createEditTools(options),
    ...createRenderTools(options),
    ...createFilesTools(options),
    ...createSoundTools(options),
  };
}
