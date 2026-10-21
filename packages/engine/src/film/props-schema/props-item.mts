import * as Schema from 'effect/Schema';
import type { PropsItem } from '../contracts/props.mjs';
import { CueSchema } from './cue.mjs';

export const PropsItemSchema: Schema.Codec<PropsItem> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      say: Schema.optional(CueSchema),
      at: Schema.optional(Schema.Finite),
      text: Schema.optional(Schema.String),
      title: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      detail: Schema.optional(Schema.String),
      value: Schema.optional(Schema.Finite),
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
      decimals: Schema.optional(Schema.Finite),
      from: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
