import * as Schema from 'effect/Schema';
import type {
  JsonValue,
  JsonObject,
  Word,
  TimeRange,
  Format,
} from './primitives.mjs';

export const JsonValueSchema: Schema.Codec<JsonValue> = Schema.suspend(() =>
  Schema.Union([
    Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null]),
    Schema.Array(JsonValueSchema).pipe(Schema.mutable),
    Schema.Record(Schema.String, JsonValueSchema),
  ]),
);
export const JsonObjectSchema: Schema.Codec<JsonObject> = Schema.suspend(() =>
  Schema.Record(Schema.String, JsonValueSchema),
);
export const WordSchema: Schema.Codec<Word> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      w: Schema.String,
      t0: Schema.Finite,
      t1: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const TimeRangeSchema: Schema.Codec<TimeRange> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      start: Schema.Finite,
      end: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const FormatSchema: Schema.Codec<Format> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      width: Schema.Finite,
      height: Schema.Finite,
      fps: Schema.Finite,
      preset: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
