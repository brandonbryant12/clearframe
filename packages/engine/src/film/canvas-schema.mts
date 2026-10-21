import * as Schema from 'effect/Schema';
import {
  CanvasElementSchema,
  DepthKeySchema,
} from './canvas-schema-canvas.mjs';
export const decodeCanvasElement =
  Schema.decodeUnknownSync(CanvasElementSchema);

export const decodeDepthKey = Schema.decodeUnknownSync(DepthKeySchema);
import { RoughSpecSchema } from './canvas-schema-effects-2.mjs';
export const decodeRoughSpec = Schema.decodeUnknownSync(RoughSpecSchema);
import {
  MosaicSpecSchema,
  PrintSettingsSchema,
  MaterialSettingsSchema,
  ShineSpecSchema,
  TextMarkSchema,
} from './canvas-schema-effects-1.mjs';
export const decodeMosaicSpec = Schema.decodeUnknownSync(MosaicSpecSchema);

export const decodePrintSettings =
  Schema.decodeUnknownSync(PrintSettingsSchema);

export const decodeMaterialSettings = Schema.decodeUnknownSync(
  MaterialSettingsSchema,
);

export const decodeShineSpec = Schema.decodeUnknownSync(ShineSpecSchema);

export const decodeTextMark = Schema.decodeUnknownSync(TextMarkSchema);
