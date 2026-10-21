import * as Schema from 'effect/Schema';
import type {
  Element,
  Art,
  Plate,
  ElementLoop,
  ElementAlong,
} from './canvas.mjs';
import {
  CountSchema,
  ElementKeySchema,
  GradientSchema,
} from './schema-motion.mjs';
import { JsonObjectSchema } from './schema-primitives.mjs';

export const ElementSchema: Schema.Codec<Element> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      cue: Schema.optional(Schema.String),
      after: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      id: Schema.optional(Schema.String),
      type: Schema.String,
      text: Schema.optional(Schema.String),
      x: Schema.optional(Schema.Finite),
      y: Schema.optional(Schema.Finite),
      z: Schema.optional(Schema.Finite),
      w: Schema.optional(Schema.Finite),
      h: Schema.optional(Schema.Finite),
      width: Schema.optional(Schema.Finite),
      height: Schema.optional(Schema.Finite),
      upper: Schema.optional(Schema.Boolean),
      fit: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
      tracking: Schema.optional(Schema.Finite),
      anchor: Schema.optional(Schema.String),
      size: Schema.optional(Schema.Finite),
      fps: Schema.optional(Schema.Finite),
      color: Schema.optional(Schema.String),
      fill: Schema.optional(Schema.Union([Schema.String, GradientSchema])),
      stroke: Schema.optional(Schema.Union([Schema.String, GradientSchema])),
      opacity: Schema.optional(Schema.Finite),
      scale: Schema.optional(Schema.Finite),
      rotate: Schema.optional(Schema.Finite),
      radius: Schema.optional(Schema.Finite),
      r: Schema.optional(Schema.Finite),
      dash: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
      enter: Schema.optional(Schema.String),
      exit: Schema.optional(Schema.String),
      exitAt: Schema.optional(Schema.Finite),
      exitSay: Schema.optional(Schema.String),
      exitCue: Schema.optional(Schema.String),
      count: Schema.optional(Schema.Union([CountSchema, Schema.Finite])),
      keys: Schema.optional(
        Schema.Array(ElementKeySchema).pipe(Schema.mutable),
      ),
      loop: Schema.optional(ElementLoopSchema),
      along: Schema.optional(ElementAlongSchema),
      children: Schema.optional(
        Schema.Array(ElementSchema).pipe(Schema.mutable),
      ),
      source: Schema.optional(Schema.String),
      unfinished: Schema.optional(
        Schema.Union([Schema.Boolean, Schema.String]),
      ),
      asset: Schema.optional(Schema.String),
      file: Schema.optional(Schema.String),
      font: Schema.optional(Schema.String),
      align: Schema.optional(Schema.String),
      weight: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
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
export const ArtSchema: Schema.Codec<Art> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      sketch: Schema.optional(Schema.String),
      seed: Schema.optional(Schema.Finite),
      opacity: Schema.optional(Schema.Finite),
      drift: Schema.optional(Schema.Finite),
      rough: Schema.optional(
        Schema.Union([Schema.Boolean, Schema.Finite, JsonObjectSchema]),
      ),
      under: Schema.optional(Schema.Array(ElementSchema).pipe(Schema.mutable)),
      over: Schema.optional(Schema.Array(ElementSchema).pipe(Schema.mutable)),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const PlateSchema: Schema.Codec<Plate> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      asset: Schema.optional(Schema.String),
      file: Schema.optional(Schema.String),
      side: Schema.optional(Schema.String),
      treatment: Schema.optional(Schema.String),
      drift: Schema.optional(Schema.String),
      scrim: Schema.optional(Schema.Finite),
      focus: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
      offset: Schema.optional(Schema.Finite),
      loop: Schema.optional(Schema.Boolean),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const ElementLoopSchema: Schema.Codec<ElementLoop> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      type: Schema.String,
      period: Schema.optional(Schema.Finite),
      amount: Schema.optional(Schema.Finite),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const ElementAlongSchema: Schema.Codec<ElementAlong> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        at: Schema.optional(Schema.Finite),
        say: Schema.optional(Schema.String),
        cue: Schema.optional(Schema.String),
        after: Schema.optional(Schema.Finite),
        dur: Schema.optional(Schema.Finite),
        d: Schema.String,
        ease: Schema.optional(Schema.String),
        rotate: Schema.optional(Schema.Boolean),
        loop: Schema.optional(Schema.Boolean),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
