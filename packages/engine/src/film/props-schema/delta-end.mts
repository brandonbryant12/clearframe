import * as Schema from 'effect/Schema';
import type { DeltaEnd } from '../contracts/props.mjs';

export const DeltaEndSchema: Schema.Codec<DeltaEnd> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      value: Schema.Finite,
      label: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
