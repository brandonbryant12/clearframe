import * as Schema from 'effect/Schema';
import type { SketchDrawing } from './types.mjs';
import {
  CanvasElementSchema,
  DepthKeySchema,
} from './canvas-schema-canvas.mjs';
import { PropsFocusSchema } from './props-schema/props-focus.mjs';

import { TargetInputSchema } from './props-schema/target-input.mjs';
const rectangle = Schema.Array(Schema.Finite).pipe(Schema.mutable);
const drawing: Schema.Codec<SketchDrawing> = Schema.StructWithRest(
  Schema.Struct({
    elements: Schema.Array(CanvasElementSchema).pipe(Schema.mutable),
    view: Schema.optional(
      Schema.Union([rectangle, TargetInputSchema, Schema.Literal('auto')]),
    ),
    viewFrom: Schema.optional(Schema.Union([rectangle, TargetInputSchema])),
    viewDur: Schema.optional(Schema.Finite),
    dolly: Schema.optional(Schema.Array(DepthKeySchema).pipe(Schema.mutable)),
    focus: Schema.optional(PropsFocusSchema),
    world: Schema.optional(Schema.String),
    layer: Schema.optional(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const decodeSketchDrawing = Schema.decodeUnknownSync(drawing);
