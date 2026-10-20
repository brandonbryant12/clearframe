import * as Schema from 'effect/Schema';
import type {
  MaterialSpec,
  ShadowSpec,
  PrintSpec,
  Morph,
  MorphFrom,
  EchoSpec,
} from './types.mjs';
import {
  MaterialSettingsSchema,
  PrintSettingsSchema,
} from './canvas-schema-effects-1.mjs';

import { CanvasElementSchema } from './canvas-schema-canvas.mjs';
export const MaterialSpecSchema: Schema.Codec<MaterialSpec> = Schema.suspend(
  () => Schema.Union([Schema.String, MaterialSettingsSchema]),
);
export const ShadowSpecSchema: Schema.Codec<ShadowSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      blur: Schema.optional(Schema.Finite),
      opacity: Schema.optional(Schema.Finite),
      dx: Schema.optional(Schema.Finite),
      dy: Schema.optional(Schema.Finite),
      color: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const PrintSpecSchema: Schema.Codec<PrintSpec> = Schema.suspend(() =>
  Schema.Union([Schema.String, PrintSettingsSchema]),
);
export const MorphSchema: Schema.Codec<Morph> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({ from: CanvasElementSchema, dur: Schema.Finite }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const MorphFromSchema: Schema.Codec<MorphFrom> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      id: Schema.String,
      slice: Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable),
      axis: Schema.optional(
        Schema.Union([Schema.Literal('x'), Schema.Literal('y')]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const EchoSpecSchema: Schema.Codec<EchoSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      count: Schema.optional(Schema.Finite),
      lag: Schema.optional(Schema.Finite),
      step: Schema.optional(
        Schema.Struct({
          x: Schema.optional(Schema.Finite),
          y: Schema.optional(Schema.Finite),
          rotate: Schema.optional(Schema.Finite),
          scale: Schema.optional(Schema.Finite),
        }),
      ),
      fade: Schema.optional(Schema.Finite),
      to: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
