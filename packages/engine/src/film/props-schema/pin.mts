import * as Schema from 'effect/Schema';
import type { Pin } from '../contracts/props.mjs';
import { CueSchema } from './cue.mjs';

export const PinSchema: Schema.Codec<Pin> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      say: Schema.optional(CueSchema),
      at: Schema.optional(Schema.Finite),
      x: Schema.optional(Schema.Finite),
      y: Schema.optional(Schema.Finite),
      label: Schema.optional(Schema.String),
      detail: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
