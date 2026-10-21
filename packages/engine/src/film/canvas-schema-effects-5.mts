import * as Schema from 'effect/Schema';
import type { AlongSpec, LoopSpec, ElementKey, ElementType } from './types.mjs';
import { SoundRefSchema } from './canvas-schema-effects-1.mjs';
export const AlongSpecSchema: Schema.Codec<AlongSpec> = Schema.suspend(() =>
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
export const LoopSpecSchema: Schema.Codec<LoopSpec> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      type: Schema.String,
      period: Schema.optional(Schema.Finite),
      amount: Schema.optional(Schema.Finite),
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
      ease: Schema.optional(Schema.String),
      x: Schema.optional(Schema.Finite),
      y: Schema.optional(Schema.Finite),
      scale: Schema.optional(Schema.Finite),
      scaleX: Schema.optional(Schema.Finite),
      scaleY: Schema.optional(Schema.Finite),
      rotate: Schema.optional(Schema.Finite),
      opacity: Schema.optional(Schema.Finite),
      blur: Schema.optional(Schema.Finite),
      hold: Schema.optional(Schema.Boolean),
      tiltX: Schema.optional(Schema.Finite),
      tiltY: Schema.optional(Schema.Finite),
      sound: Schema.optional(SoundRefSchema),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const ElementTypeSchema: Schema.Codec<ElementType> = Schema.suspend(() =>
  Schema.Union([
    Schema.Literal('rect'),
    Schema.Literal('circle'),
    Schema.Literal('ellipse'),
    Schema.Literal('line'),
    Schema.Literal('path'),
    Schema.Literal('poly'),
    Schema.Literal('text'),
    Schema.Literal('icon'),
    Schema.Literal('document'),
    Schema.Literal('receipt'),
    Schema.Literal('app'),
    Schema.Literal('crumbs'),
    Schema.Literal('pointer'),
    Schema.Literal('image'),
    Schema.Literal('group'),
    Schema.Literal('meter'),
    Schema.Literal('spotlight'),
    Schema.Literal('particles'),
    Schema.Literal('solid'),
  ]),
);
