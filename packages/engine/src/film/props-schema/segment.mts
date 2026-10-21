import * as Schema from 'effect/Schema';
import type { Segment } from '../contracts/props.mjs';

export const SegmentSchema: Schema.Codec<Segment> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      label: Schema.String,
      value: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
