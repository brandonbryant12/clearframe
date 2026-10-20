import * as Schema from 'effect/Schema';
import type { TableInput } from './table-contracts.mjs';
const rest = Schema.Record(Schema.String, Schema.Unknown);
const text = Schema.optional(Schema.String),
  number = Schema.optional(Schema.Finite);
const column = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    align: Schema.optional(Schema.Literals(['left', 'right'])),
    weight: number,
  }),
  [rest],
);
const row = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    cells: Schema.Record(Schema.String, Schema.String),
  }),
  [rest],
);
const view = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    hide: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
  }),
  [rest],
);
const show = Schema.StructWithRest(
  Schema.Struct({
    view: Schema.String,
    at: number,
    say: text,
    cue: text,
    after: number,
  }),
  [rest],
);
const schema: Schema.Codec<TableInput> = Schema.StructWithRest(
  Schema.Struct({
    id: text,
    title: Schema.String,
    source: Schema.String,
    asOf: text,
    columns: Schema.Array(column).pipe(Schema.mutable),
    rows: Schema.Array(row).pipe(Schema.mutable),
    views: Schema.optional(Schema.Array(view).pipe(Schema.mutable)),
    show: Schema.optional(Schema.Array(show).pipe(Schema.mutable)),
  }),
  [rest],
);
export const decodeTable = Schema.decodeUnknownSync(schema);
