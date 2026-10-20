import * as Schema from 'effect/Schema';
import type { TargetInput } from '../contracts/canvas.mjs';

export const TargetInputSchema: Schema.Codec<TargetInput> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      on: Schema.Union([
        Schema.String,
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ]),
      pad: Schema.optional(Schema.Finite),
      state: Schema.optional(
        Schema.Union([
          Schema.Literal('start'),
          Schema.Literal('end'),
          Schema.Null,
        ]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
