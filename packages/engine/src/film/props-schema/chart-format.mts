import * as Schema from 'effect/Schema';
import type { ChartFormat } from '../contracts/props.mjs';

export const ChartFormatSchema: Schema.Codec<ChartFormat> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
      decimals: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
