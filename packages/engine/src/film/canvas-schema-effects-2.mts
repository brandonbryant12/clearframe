import * as Schema from 'effect/Schema';
import type {
  RecolorFront,
  Paint,
  GradientPaint,
  Point,
  RoughSpec,
  PointerStep,
} from './types.mjs';

export const RecolorFrontSchema: Schema.Codec<RecolorFront> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        say: Schema.optional(Schema.String),
        at: Schema.optional(Schema.Finite),
        dur: Schema.optional(Schema.Finite),
        fill: Schema.optional(PaintSchema),
        axis: Schema.optional(Schema.Finite),
        share: Schema.optional(Schema.Finite),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const PaintSchema: Schema.Codec<Paint> = Schema.suspend(() =>
  Schema.Union([Schema.String, GradientPaintSchema]),
);
export const GradientPaintSchema: Schema.Codec<GradientPaint> = Schema.suspend(
  () =>
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
export const PointSchema: Schema.Codec<Point> = Schema.suspend(() =>
  Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable),
);
export const RoughSpecSchema: Schema.Codec<RoughSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      amount: Schema.optional(Schema.Finite),
      passes: Schema.optional(Schema.Finite),
      boil: Schema.optional(Schema.Finite),
      fill: Schema.optional(Schema.String),
      gap: Schema.optional(Schema.Finite),
      angle: Schema.optional(Schema.Finite),
      hatchWidth: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const PointerStepSchema: Schema.Codec<PointerStep> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      to: Schema.optional(Schema.Union([Schema.String, PointSchema])),
      say: Schema.optional(Schema.String),
      at: Schema.optional(Schema.Finite),
      press: Schema.optional(Schema.Boolean),
      point: Schema.optional(PointSchema),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
