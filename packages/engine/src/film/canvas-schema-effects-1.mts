import * as Schema from 'effect/Schema';
import type {
  TextMark,
  SoundRef,
  ShineSpec,
  MaterialSettings,
  PrintSettings,
  MosaicSpec,
} from './types.mjs';
import { PointSchema, RecolorFrontSchema } from './canvas-schema-effects-2.mjs';

export const TextMarkSchema: Schema.Codec<TextMark> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      words: Schema.optional(Schema.String),
      style: Schema.optional(Schema.String),
      color: Schema.optional(Schema.String),
      width: Schema.optional(Schema.Finite),
      pad: Schema.optional(Schema.Finite),
      rough: Schema.optional(Schema.Boolean),
      label: Schema.optional(Schema.String),
      size: Schema.optional(Schema.Finite),
      rotate: Schema.optional(Schema.Finite),
      fill: Schema.optional(Schema.String),
      sound: Schema.optional(
        Schema.Union([SoundRefSchema, Schema.Literal(false)]),
      ),
      section: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const SoundRefSchema: Schema.Codec<SoundRef> = Schema.suspend(() =>
  Schema.Union([
    Schema.String,
    Schema.StructWithRest(
      Schema.Struct({
        name: Schema.String,
        volume: Schema.optional(Schema.Finite),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  ]),
);
export const ShineSpecSchema: Schema.Codec<ShineSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      color: Schema.optional(Schema.String),
      width: Schema.optional(Schema.Finite),
      angle: Schema.optional(Schema.Finite),
      opacity: Schema.optional(Schema.Finite),
      every: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const MaterialSettingsSchema: Schema.Codec<MaterialSettings> =
  Schema.suspend(() =>
    Schema.StructWithRest(
      Schema.Struct({
        map: Schema.optional(
          Schema.Union([
            Schema.String,
            Schema.Array(Schema.String).pipe(Schema.mutable),
          ]),
        ),
        depth: Schema.optional(Schema.Finite),
        soften: Schema.optional(Schema.Finite),
        flow: Schema.optional(Schema.Finite),
        stripe: Schema.optional(Schema.Finite),
        angle: Schema.optional(Schema.Finite),
        grain: Schema.optional(Schema.Finite),
        gain: Schema.optional(Schema.Finite),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  );
export const PrintSettingsSchema: Schema.Codec<PrintSettings> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        screen: Schema.optional(Schema.String),
        cell: Schema.optional(Schema.Finite),
        angle: Schema.optional(Schema.Finite),
        tone: Schema.optional(
          Schema.Union([
            Schema.Finite,
            Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable),
          ]),
        ),
        axis: Schema.optional(Schema.Finite),
        register: Schema.optional(
          Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable),
        ),
        wear: Schema.optional(Schema.Finite),
        ink: Schema.optional(Schema.String),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const MosaicSpecSchema: Schema.Codec<MosaicSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      tile: Schema.optional(Schema.Finite),
      gap: Schema.optional(Schema.Finite),
      jitter: Schema.optional(Schema.Finite),
      flow: Schema.optional(Schema.String),
      outline: Schema.optional(Schema.Boolean),
      build: Schema.optional(Schema.String),
      from: Schema.optional(PointSchema),
      spread: Schema.optional(Schema.Finite),
      shade: Schema.optional(Schema.Finite),
      shine: Schema.optional(Schema.Finite),
      glint: Schema.optional(Schema.Finite),
      grout: Schema.optional(Schema.String),
      axis: Schema.optional(Schema.Finite),
      seed: Schema.optional(Schema.Finite),
      recolor: Schema.optional(
        Schema.Array(RecolorFrontSchema).pipe(Schema.mutable),
      ),
      halo: Schema.optional(Schema.Finite),
      knockout: Schema.optional(Schema.Boolean),
      style: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
