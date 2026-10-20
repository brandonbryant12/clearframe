import * as Schema from 'effect/Schema';
import type {
  ShadeSpec,
  ScrollMove,
  DocumentSection,
  ElementMark,
  GlobeMark,
  CountSpec,
} from './types.mjs';
import { TextMarkSchema } from './canvas-schema-effects-1.mjs';
export const ShadeSpecSchema: Schema.Codec<ShadeSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      light: Schema.optional(
        Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]).pipe(
          Schema.mutable,
        ),
      ),
      ambient: Schema.optional(Schema.Finite),
      edges: Schema.optional(Schema.Boolean),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const ScrollMoveSchema: Schema.Codec<ScrollMove> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      to: Schema.Union([Schema.Finite, Schema.String]),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const DocumentSectionSchema: Schema.Codec<DocumentSection> =
  Schema.suspend(() =>
    Schema.StructWithRest(
      Schema.Struct({
        heading: Schema.optional(Schema.String),
        text: Schema.String,
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  );
export const ElementMarkSchema: Schema.Codec<ElementMark> = Schema.suspend(() =>
  Schema.Union([TextMarkSchema, GlobeMarkSchema]),
);
export const GlobeMarkSchema: Schema.Codec<GlobeMark> = Schema.suspend(() =>
  Schema.Array(Schema.Finite).pipe(Schema.mutable),
);
export const CountSpecSchema: Schema.Codec<CountSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      from: Schema.optional(Schema.Finite),
      to: Schema.Finite,
      decimals: Schema.optional(Schema.Finite),
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
      dur: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
