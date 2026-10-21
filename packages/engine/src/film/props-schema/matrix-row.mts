import * as Schema from 'effect/Schema';
import type { MatrixRow } from '../contracts/props.mjs';

export const MatrixRowSchema: Schema.Codec<MatrixRow> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      label: Schema.optional(Schema.String),
      values: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
