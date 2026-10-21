import * as Schema from 'effect/Schema';
import type { ProcessInput } from './process-contracts.mjs';
const rest = Schema.Record(Schema.String, Schema.Unknown),
  text = Schema.optional(Schema.String),
  number = Schema.optional(Schema.Finite);
const counts = Schema.optional(Schema.Record(Schema.String, Schema.Finite));
const stage = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    capacity: Schema.Finite,
  }),
  [rest],
);
const run = Schema.StructWithRest(
  Schema.Struct({
    periods: Schema.Finite,
    dur: Schema.Finite,
    say: text,
    cue: text,
    at: number,
    after: number,
    set: counts,
  }),
  [rest],
);
const schema: Schema.Codec<ProcessInput> = Schema.StructWithRest(
  Schema.Struct({
    id: text,
    title: Schema.String,
    unit: text,
    period: text,
    arrivals: Schema.Finite,
    stages: Schema.Array(stage).pipe(Schema.mutable),
    start: counts,
    runs: Schema.Array(run).pipe(Schema.mutable),
    token: number,
    done: text,
    source: text,
    asOf: text,
  }),
  [rest],
);
export const decodeProcess = Schema.decodeUnknownSync(schema);
