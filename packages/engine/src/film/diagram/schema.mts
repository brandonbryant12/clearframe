import * as Schema from 'effect/Schema';
import type { DiagramSpec } from './contracts.mjs';
import { KINDS, STATUSES } from './shared.mjs';

const number = Schema.optionalKey(Schema.Finite);
const text = Schema.optionalKey(Schema.String);
const status = Schema.optionalKey(Schema.Literals(STATUSES));
const names = Schema.Array(Schema.String).pipe(Schema.mutable);
const cues = {
  at: number,
  say: text,
  dur: number,
  exitAt: number,
  exitSay: text,
  exitDur: number,
};
const node = Schema.StructWithRest(
  Schema.Struct({
    ...cues,
    id: Schema.String,
    label: Schema.String,
    kind: Schema.optionalKey(Schema.Literals(KINDS)),
    status,
    x: number,
    y: number,
    replaces: text,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const edge = Schema.StructWithRest(
  Schema.Struct({
    ...cues,
    id: text,
    from: Schema.String,
    to: Schema.String,
    label: text,
    status,
    style: Schema.optionalKey(Schema.Literals(['solid', 'dashed'])),
    flow: Schema.optionalKey(Schema.Boolean),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const step = Schema.StructWithRest(
  Schema.Struct({
    ...cues,
    add: Schema.optionalKey(Schema.Union([Schema.String, names])),
    remove: Schema.optionalKey(Schema.Union([Schema.String, names])),
    replace: text,
    with: text,
    label: text,
    set: Schema.optionalKey(
      Schema.Record(Schema.String, Schema.Literals(STATUSES)),
    ),
    send: Schema.optionalKey(names),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const group = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    label: Schema.String,
    nodes: names,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const schema: Schema.Codec<DiagramSpec> = Schema.StructWithRest(
  Schema.Struct({
    nodes: Schema.Array(node).pipe(Schema.mutable),
    edges: Schema.optionalKey(Schema.Array(edge).pipe(Schema.mutable)),
    steps: Schema.optionalKey(Schema.Array(step).pipe(Schema.mutable)),
    groups: Schema.optionalKey(Schema.Array(group).pipe(Schema.mutable)),
    direction: Schema.optionalKey(
      Schema.Literals(['auto', 'horizontal', 'vertical']),
    ),
    area: Schema.optionalKey(
      Schema.Tuple([
        Schema.Finite,
        Schema.Finite,
        Schema.Finite,
        Schema.Finite,
      ]).pipe(Schema.mutable),
    ),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const decodeDiagram = Schema.decodeUnknownSync(schema);
