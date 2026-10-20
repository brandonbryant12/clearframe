import * as Schema from 'effect/Schema';
import type {
  Gradient,
  Cue,
  SoundCue,
  CameraCue,
  Target,
  DepthKey,
  CameraSettings,
  MotionSettings,
  Count,
  ElementKey,
} from './motion.mjs';

export const GradientSchema: Schema.Codec<Gradient> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      gradient: Schema.Array(Schema.String).pipe(Schema.mutable),
      angle: Schema.optional(Schema.Finite),
      radial: Schema.optional(Schema.Boolean),
      fade: Schema.optional(Schema.Boolean),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const CueSchema: Schema.Codec<Cue> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const SoundCueSchema: Schema.Codec<SoundCue> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      src: Schema.String,
      volume: Schema.optional(Schema.Finite),
      at: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const CameraCueSchema: Schema.Codec<CameraCue> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      move: Schema.optional(Schema.String),
      amount: Schema.optional(Schema.Finite),
      to: Schema.optional(
        Schema.Union([
          Schema.Array(Schema.Finite).pipe(Schema.mutable),
          TargetSchema,
        ]),
      ),
      target: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const TargetSchema: Schema.Codec<Target> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      on: Schema.Union([
        Schema.String,
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ]),
      pad: Schema.optional(Schema.Finite),
      state: Schema.optional(
        Schema.Union([Schema.Literal('start'), Schema.Literal('end')]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const DepthKeySchema: Schema.Codec<DepthKey> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      z: Schema.optional(Schema.Finite),
      ease: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const CameraSettingsSchema: Schema.Codec<CameraSettings> =
  Schema.suspend(() =>
    Schema.StructWithRest(
      Schema.Struct({
        at: Schema.optional(Schema.Finite),
        say: Schema.optional(Schema.String),
        cue: Schema.optional(Schema.String),
        after: Schema.optional(Schema.Finite),
        dur: Schema.optional(Schema.Finite),
        move: Schema.optional(Schema.String),
        amount: Schema.optional(Schema.Finite),
        to: Schema.optional(
          Schema.Union([
            Schema.Array(Schema.Finite).pipe(Schema.mutable),
            TargetSchema,
          ]),
        ),
        target: Schema.optional(Schema.String),
        handheld: Schema.optional(Schema.Finite),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  );
export const MotionSettingsSchema: Schema.Codec<MotionSettings> =
  Schema.suspend(() =>
    Schema.StructWithRest(
      Schema.Struct({
        preset: Schema.optional(Schema.String),
        intensity: Schema.optional(Schema.Finite),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  );
export const CountSchema: Schema.Codec<Count> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      from: Schema.optional(Schema.Finite),
      to: Schema.Finite,
      decimals: Schema.optional(Schema.Finite),
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const ElementKeySchema: Schema.Codec<ElementKey> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      x: Schema.optional(Schema.Finite),
      y: Schema.optional(Schema.Finite),
      z: Schema.optional(Schema.Finite),
      scale: Schema.optional(Schema.Finite),
      opacity: Schema.optional(Schema.Finite),
      rotation: Schema.optional(Schema.Finite),
      to: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
      target: Schema.optional(Schema.String),
      sound: Schema.optional(
        Schema.Union([
          Schema.String,
          Schema.StructWithRest(
            Schema.Struct({
              name: Schema.String,
              volume: Schema.optional(Schema.Finite),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
          Schema.Literal(false),
        ]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
