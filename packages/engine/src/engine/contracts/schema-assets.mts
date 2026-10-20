import * as Schema from 'effect/Schema';
import type { Speaker, Source, Asset } from './assets.mjs';

export const SpeakerSchema: Schema.Codec<Speaker> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      name: Schema.String,
      role: Schema.optional(Schema.String),
      color: Schema.optional(Schema.String),
      stem: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const SourceSchema: Schema.Codec<Source> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      id: Schema.optional(Schema.String),
      title: Schema.optional(Schema.String),
      url: Schema.optional(Schema.String),
      file: Schema.optional(Schema.String),
      note: Schema.optional(Schema.String),
      publisher: Schema.optional(Schema.String),
      date: Schema.optional(Schema.String),
      quote: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const AssetSchema: Schema.Codec<Asset> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      id: Schema.String,
      kind: Schema.String,
      file: Schema.optional(Schema.String),
      prompt: Schema.optional(Schema.String),
      model: Schema.optional(Schema.String),
      provider: Schema.optional(Schema.String),
      duration: Schema.optional(Schema.Finite),
      width: Schema.optional(Schema.Finite),
      height: Schema.optional(Schema.Finite),
      aspectRatio: Schema.optional(Schema.String),
      layers: Schema.optional(
        Schema.Union([
          Schema.Boolean,
          Schema.Array(Schema.String).pipe(Schema.mutable),
        ]),
      ),
      cutout: Schema.optional(Schema.Boolean),
      subject: Schema.optional(Schema.String),
      treatment: Schema.optional(Schema.String),
      bounds: Schema.optional(
        Schema.Union([
          Schema.StructWithRest(
            Schema.Struct({
              box: Schema.Tuple([
                Schema.Finite,
                Schema.Finite,
                Schema.Finite,
                Schema.Finite,
              ]).pipe(Schema.mutable),
              size: Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(
                Schema.mutable,
              ),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
          Schema.Null,
        ]),
      ),
      foreground: Schema.optional(Schema.String),
      reference: Schema.optional(Schema.String),
      references: Schema.optional(
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ),
      refs: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
      image: Schema.optional(Schema.String),
      from: Schema.optional(Schema.String),
      seconds: Schema.optional(Schema.Finite),
      aspect: Schema.optional(Schema.String),
      resolution: Schema.optional(Schema.String),
      previousInteractionId: Schema.optional(Schema.String),
      seed: Schema.optional(Schema.Finite),
      raw: Schema.optional(Schema.Boolean),
      size: Schema.optional(Schema.String),
      ground: Schema.optional(Schema.String),
      style: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
