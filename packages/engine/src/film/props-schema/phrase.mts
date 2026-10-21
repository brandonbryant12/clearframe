import * as Schema from 'effect/Schema';
import type { Phrase } from '../contracts/props.mjs';
import { CueSchema } from './cue.mjs';

export const PhraseSchema: Schema.Codec<Phrase> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      say: Schema.optional(CueSchema),
      at: Schema.optional(Schema.Finite),
      text: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
