import * as Schema from 'effect/Schema';
import type { PropsFocus } from '../contracts/props.mjs';
import { DepthKeySchema } from '../canvas-schema-canvas.mjs';

export const PropsFocusSchema: Schema.Codec<PropsFocus> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      label: Schema.optional(Schema.String),
      index: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      dim: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      note: Schema.optional(Schema.String),
      at: Schema.optional(Schema.Finite),
      x: Schema.optional(Schema.Finite),
      y: Schema.optional(Schema.Finite),
      w: Schema.optional(Schema.Finite),
      h: Schema.optional(Schema.Finite),
      z: Schema.optional(Schema.Finite),
      aperture: Schema.optional(Schema.Finite),
      keys: Schema.optional(Schema.Array(DepthKeySchema).pipe(Schema.mutable)),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
