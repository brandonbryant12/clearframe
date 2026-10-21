import * as Schema from 'effect/Schema';
import type { ViewNext } from '../contracts/canvas.mjs';
import { ViewValueSchema } from './view-value.mjs';

export const ViewNextSchema: Schema.Codec<ViewNext> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      to: Schema.Union([ViewValueSchema, Schema.Undefined]),
      at: Schema.Finite,
      dur: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
