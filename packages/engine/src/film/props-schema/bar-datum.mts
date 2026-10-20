import * as Schema from 'effect/Schema';
import type { BarDatum } from '../contracts/props.mjs';

export const BarDatumSchema: Schema.Codec<BarDatum> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      label: Schema.String,
      value: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
