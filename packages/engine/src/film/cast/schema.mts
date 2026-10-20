import * as Schema from 'effect/Schema';
import type { CastInput } from './contracts.mjs';
const text = Schema.optionalKey(Schema.String);
const number = Schema.optionalKey(Schema.Finite);
const flag = Schema.optionalKey(Schema.Boolean);
const point = Schema.Tuple([Schema.Finite, Schema.Finite]);
const ids = Schema.optionalKey(
  Schema.Array(Schema.String).pipe(Schema.mutable),
);
const object = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    icon: text,
    word: text,
    ['shape']: text,
    color: text,
    label: text,
    size: number,
    float: flag,
    enter: text,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const formation = Schema.StructWithRest(
  Schema.Struct({
    form: Schema.String,
    say: text,
    at: number,
    ids,
    hero: text,
    word: text,
    center: Schema.optionalKey(point.pipe(Schema.mutable)),
    spread: number,
    scale: number,
    dur: number,
    stagger: number,
    ease: text,
    thread: flag,
    beside: text,
    on: text,
    out: text,
    in: text,
    by: ids,
    mark: text,
    to: Schema.optionalKey(
      Schema.Union([
        Schema.String,
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ]),
    ),
    color: text,
    zoom: number,
    into: text,
    from: text,
    via: Schema.optionalKey(
      Schema.Array(point.pipe(Schema.mutable)).pipe(Schema.mutable),
    ),
    trail: flag,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const CastInputSchema: Schema.Codec<CastInput> = Schema.StructWithRest(
  Schema.Struct({
    objects: Schema.optionalKey(Schema.Array(object).pipe(Schema.mutable)),
    formations: Schema.Array(formation).pipe(Schema.mutable),
    seed: number,
    look: text,
    fresh: flag,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const decodeCast = Schema.decodeUnknownSync(CastInputSchema);
