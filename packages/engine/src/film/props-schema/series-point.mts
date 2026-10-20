import * as Schema from 'effect/Schema';
import type { SeriesPoint } from '../contracts/props.mjs';

export const SeriesPointSchema: Schema.Codec<SeriesPoint> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      x: Schema.Finite,
      y: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
