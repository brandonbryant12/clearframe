import * as Schema from 'effect/Schema';
import type { BreathPhase } from '../contracts/props.mjs';

export const BreathPhaseSchema: Schema.Codec<BreathPhase> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      label: Schema.optional(Schema.String),
      seconds: Schema.optional(Schema.Finite),
      scale: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
