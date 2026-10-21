import * as Schema from 'effect/Schema';
import type { DistributionInput } from './distribution-data.mjs';
const threshold = Schema.StructWithRest(
  Schema.Struct({
    value: Schema.Finite,
    relation: Schema.Literals(['gte', 'gt', 'lte', 'lt']),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const axis = Schema.StructWithRest(
  Schema.Struct({
    max: Schema.Finite,
    ticks: Schema.Array(Schema.Finite).pipe(Schema.mutable),
    decimals: Schema.optional(Schema.Finite),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const distributionInput: Schema.Codec<DistributionInput> =
  Schema.StructWithRest(
    Schema.Struct({
      title: Schema.String,
      source: Schema.String,
      asOf: Schema.String,
      unit: Schema.String,
      observations: Schema.Array(
        Schema.Union([Schema.Finite, Schema.Null]),
      ).pipe(Schema.mutable),
      edges: Schema.Array(Schema.Finite).pipe(Schema.mutable),
      mode: Schema.Literals(['count', 'density']),
      threshold,
      y: axis,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  );
export const decodeDistribution = Schema.decodeUnknownSync(distributionInput);
