import * as Schema from 'effect/Schema';
import type { RevealSpec } from '../contracts/canvas.mjs';

export const RevealSpecSchema: Schema.Codec<RevealSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      from: Schema.Union([
        Schema.String,
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ]),
      pad: Schema.optional(Schema.Finite),
      state: Schema.optional(
        Schema.Union([Schema.Literal('start'), Schema.Literal('end')]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
