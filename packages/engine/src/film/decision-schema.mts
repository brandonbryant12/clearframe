import * as Schema from 'effect/Schema';
import type { DecisionInput, DecisionTree } from './decision-contracts.mjs';
const rest = Schema.Record(Schema.String, Schema.Unknown),
  text = Schema.optional(Schema.String),
  number = Schema.optional(Schema.Finite);
const tree: Schema.Codec<DecisionTree> = Schema.suspend(() =>
  Schema.Union([
    Schema.String,
    Schema.StructWithRest(
      Schema.Struct({ ask: Schema.String, yes: tree, no: tree }),
      [rest],
    ),
  ]),
);
const ask = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    yes: text,
    no: text,
  }),
  [rest],
);
const outcome = Schema.StructWithRest(
  Schema.Struct({ id: Schema.String, label: Schema.String, tone: text }),
  [rest],
);
const timed = { say: text, cue: text, at: number, after: number };
const example = Schema.StructWithRest(
  Schema.Struct({
    label: Schema.String,
    answers: Schema.Record(Schema.String, Schema.String),
    ...timed,
  }),
  [rest],
);
const schema: Schema.Codec<DecisionInput> = Schema.StructWithRest(
  Schema.Struct({
    id: text,
    title: Schema.String,
    source: text,
    asOf: text,
    ask: Schema.Array(ask).pipe(Schema.mutable),
    tree,
    outcomes: Schema.Array(outcome).pipe(Schema.mutable),
    cases: Schema.Array(example).pipe(Schema.mutable),
    return: Schema.optional(
      Schema.StructWithRest(Schema.Struct(timed), [rest]),
    ),
  }),
  [rest],
);
export const decodeDecision = Schema.decodeUnknownSync(schema);
