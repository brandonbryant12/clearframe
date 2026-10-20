import * as Schema from 'effect/Schema';
import type { BlockProps } from './props.mjs';
import { ElementSchema } from './schema-canvas.mjs';
import { JsonValueSchema } from './schema-primitives.mjs';
import {
  CameraSettingsSchema,
  CueSchema,
  DepthKeySchema,
  TargetSchema,
} from './schema-motion.mjs';

export const BlockPropsSchema: Schema.Codec<BlockProps> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      kicker: Schema.optional(Schema.String),
      source: Schema.optional(Schema.String),
      offset: Schema.optional(Schema.Finite),
      support: Schema.optional(Schema.String),
      text: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      value: Schema.optional(Schema.Finite),
      from: Schema.optional(
        Schema.Union([
          Schema.Finite,
          Schema.String,
          Schema.StructWithRest(
            Schema.Struct({
              value: Schema.Finite,
              label: Schema.optional(Schema.String),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ]),
      ),
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
      decimals: Schema.optional(Schema.Finite),
      context: Schema.optional(Schema.String),
      align: Schema.optional(Schema.String),
      emphasis: Schema.optional(
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ),
      emphasisStyle: Schema.optional(Schema.String),
      elements: Schema.optional(
        Schema.Array(ElementSchema).pipe(Schema.mutable),
      ),
      world: Schema.optional(Schema.String),
      sketch: Schema.optional(Schema.String),
      seed: Schema.optional(Schema.Finite),
      sketchText: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      sketchSay: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      sketchParams: Schema.optional(
        Schema.Record(Schema.String, JsonValueSchema),
      ),
      chart: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            note: Schema.optional(
              Schema.StructWithRest(
                Schema.Struct({
                  say: Schema.optional(Schema.String),
                  text: Schema.optional(Schema.String),
                }),
                [Schema.Record(Schema.String, Schema.Unknown)],
              ),
            ),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
      moments: Schema.optional(
        Schema.Record(Schema.String, Schema.Union([Schema.String, CueSchema])),
      ),
      plates: Schema.optional(Schema.String),
      view: Schema.optional(
        Schema.Union([
          Schema.Array(Schema.Finite).pipe(Schema.mutable),
          TargetSchema,
          Schema.Literal('auto'),
        ]),
      ),
      place: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
      camera: Schema.optional(CameraSettingsSchema),
      dolly: Schema.optional(
        Schema.Union([
          Schema.Finite,
          Schema.Array(DepthKeySchema).pipe(Schema.mutable),
        ]),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
