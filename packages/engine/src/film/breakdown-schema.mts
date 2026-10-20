import * as Schema from 'effect/Schema';
import type {
  BreakdownInput,
  BreakdownPartInput,
} from './breakdown-contracts.mjs';
const rest = Schema.Record(Schema.String, Schema.Unknown),
  text = Schema.optional(Schema.String),
  number = Schema.optional(Schema.Finite);
const timed = { at: number, say: text, cue: text, after: number };
const residual = Schema.optional(
  Schema.Union([Schema.Literal(true), Schema.String]),
);
const part: Schema.Codec<BreakdownPartInput> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      id: text,
      label: Schema.String,
      value: Schema.Finite,
      ...timed,
      highlight: Schema.optional(Schema.Boolean),
      parts: Schema.optional(Schema.Array(part).pipe(Schema.mutable)),
      residual,
    }),
    [rest],
  ),
);
const total = Schema.StructWithRest(
  Schema.Struct({ label: Schema.String, value: Schema.Finite }),
  [rest],
);
const open = Schema.StructWithRest(
  Schema.Struct({ part: Schema.String, ...timed }),
  [rest],
);
const schema: Schema.Codec<BreakdownInput> = Schema.StructWithRest(
  Schema.Struct({
    id: text,
    title: Schema.String,
    unit: Schema.String,
    asOf: Schema.String,
    source: text,
    decimals: number,
    prefix: text,
    suffix: text,
    total,
    parts: Schema.Array(part).pipe(Schema.mutable),
    residual,
    focus: text,
    open: Schema.optional(open),
    gather: text,
    motion: text,
  }),
  [rest],
);
export const decodeBreakdown = Schema.decodeUnknownSync(schema);
