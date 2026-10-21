import * as Schema from 'effect/Schema';
import type { CompareSide } from '../contracts/props.mjs';

export const CompareSideSchema: Schema.Codec<CompareSide> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      items: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
