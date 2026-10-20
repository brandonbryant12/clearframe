import * as Schema from 'effect/Schema';
import type { PreparedManifest, RenderReceipt, Finding } from './evidence.mjs';

export const PreparedManifestSchema: Schema.Codec<PreparedManifest> =
  Schema.suspend(() =>
    Schema.StructWithRest(
      Schema.Struct({
        version: Schema.Finite,
        inputId: Schema.String,
        hashes: Schema.Record(Schema.String, Schema.String),
        inputs: Schema.optional(Schema.Record(Schema.String, Schema.String)),
        prepared: Schema.optional(Schema.Record(Schema.String, Schema.String)),
        sceneHash: Schema.optional(Schema.String),
        jobHash: Schema.optional(Schema.String),
        sounds: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
  );
export const RenderReceiptSchema: Schema.Codec<RenderReceipt> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        version: Schema.optional(Schema.Finite),
        inputId: Schema.optional(Schema.String),
        outputSha256: Schema.optional(Schema.String),
        hashes: Schema.optional(Schema.Record(Schema.String, Schema.String)),
        width: Schema.optional(Schema.Finite),
        height: Schema.optional(Schema.Finite),
        fps: Schema.optional(Schema.Finite),
        frames: Schema.optional(Schema.Finite),
        duration: Schema.optional(Schema.Finite),
        draft: Schema.optional(Schema.Boolean),
        rough: Schema.optional(Schema.Boolean),
        scale: Schema.optional(Schema.Finite),
        authoredWidth: Schema.optional(Schema.Finite),
        authoredHeight: Schema.optional(Schema.Finite),
        revision: Schema.optional(Schema.String),
        output: Schema.optional(Schema.String),
        createdAt: Schema.optional(Schema.String),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const FindingSchema: Schema.Codec<Finding> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      level: Schema.Union([
        Schema.Literal('error'),
        Schema.Literal('warn'),
        Schema.Literal('info'),
      ]),
      message: Schema.String,
      where: Schema.optional(Schema.String),
      kind: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
