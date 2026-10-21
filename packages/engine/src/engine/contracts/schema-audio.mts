import * as Schema from 'effect/Schema';
import type {
  VoiceSettings,
  Pacing,
  MusicSettings,
  MixSettings,
  Alignment,
  VoiceMetadata,
} from './audio.mjs';
import { WordSchema } from './schema-primitives.mjs';

export const VoiceSettingsSchema: Schema.Codec<VoiceSettings> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        provider: Schema.String,
        model: Schema.String,
        voice: Schema.String,
        style: Schema.String,
        wpm: Schema.Finite,
        takes: Schema.Union([
          Schema.Literal('film'),
          Schema.Literal('chapter'),
          Schema.Literal('beat'),
        ]),
        language: Schema.optional(Schema.String),
        perBeatStyle: Schema.optional(Schema.Boolean),
        draftVoice: Schema.optional(Schema.String),
        pronounce: Schema.optional(Schema.Record(Schema.String, Schema.String)),
        cast: Schema.optional(
          Schema.Record(
            Schema.String,
            Schema.StructWithRest(
              Schema.Struct({
                voice: Schema.String,
                style: Schema.optional(Schema.String),
                draftVoice: Schema.optional(Schema.String),
              }),
              [Schema.Record(Schema.String, Schema.Unknown)],
            ),
          ),
        ),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const PacingSchema: Schema.Codec<Pacing> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      lead: Schema.Finite,
      tail: Schema.Finite,
      minBeat: Schema.Finite,
      silentBeat: Schema.Finite,
      outro: Schema.optional(Schema.Finite),
      continuous: Schema.optional(Schema.Boolean),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const MusicSettingsSchema: Schema.Codec<MusicSettings> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        provider: Schema.String,
        model: Schema.String,
        volume: Schema.Finite,
        duck: Schema.Boolean,
        fadeIn: Schema.Finite,
        fadeOut: Schema.Finite,
        file: Schema.optional(
          Schema.Union([Schema.String, Schema.Literal(false)]),
        ),
        prompt: Schema.optional(Schema.String),
        duration: Schema.optional(Schema.Finite),
        bpm: Schema.optional(Schema.Finite),
        weightedPrompts: Schema.optional(
          Schema.Array(
            Schema.StructWithRest(
              Schema.Struct({
                text: Schema.optional(Schema.String),
                weight: Schema.Finite,
              }),
              [Schema.Record(Schema.String, Schema.Unknown)],
            ),
          ).pipe(Schema.mutable),
        ),
        density: Schema.optional(Schema.Finite),
        brightness: Schema.optional(Schema.Finite),
        scale: Schema.optional(Schema.String),
        key: Schema.optional(Schema.String),
        ending: Schema.optional(Schema.String),
        offset: Schema.optional(Schema.Finite),
        arc: Schema.optional(Schema.Record(Schema.String, Schema.String)),
        sections: Schema.optional(
          Schema.Array(
            Schema.StructWithRest(
              Schema.Struct({
                from: Schema.Finite,
                to: Schema.Finite,
                text: Schema.String,
              }),
              [Schema.Record(Schema.String, Schema.Unknown)],
            ),
          ).pipe(Schema.mutable),
        ),
        style: Schema.optional(Schema.String),
        drop: Schema.optional(
          Schema.StructWithRest(
            Schema.Struct({
              beat: Schema.String,
              at: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
              song: Schema.optional(
                Schema.Union([Schema.Finite, Schema.Literal('auto')]),
              ),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const MixSettingsSchema: Schema.Codec<MixSettings> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      loudness: Schema.Finite,
      voiceGain: Schema.Finite,
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const AlignmentSchema: Schema.Codec<Alignment> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      kind: Schema.Union([
        Schema.Literal('measured'),
        Schema.Literal('estimated'),
      ]),
      audioHash: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
      provider: Schema.optional(Schema.String),
      createdAt: Schema.optional(Schema.String),
      interpolatedWords: Schema.optional(Schema.Finite),
      model: Schema.optional(Schema.String),
      at: Schema.optional(Schema.String),
      version: Schema.optional(Schema.Finite),
      source: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const VoiceMetadataSchema: Schema.Codec<VoiceMetadata> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        textHash: Schema.optional(Schema.String),
        words: Schema.optional(Schema.Array(WordSchema).pipe(Schema.mutable)),
        alignment: Schema.optional(AlignmentSchema),
        provider: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
        text: Schema.optional(Schema.String),
        hash: Schema.optional(Schema.String),
        voice: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
        osVoice: Schema.optional(Schema.Union([Schema.String, Schema.Null])),
        createdAt: Schema.optional(Schema.String),
        model: Schema.optional(Schema.String),
        style: Schema.optional(Schema.String),
        wpm: Schema.optional(Schema.Finite),
        duration: Schema.optional(Schema.Finite),
        take: Schema.optional(
          Schema.StructWithRest(
            Schema.Struct({
              id: Schema.optional(Schema.String),
              hash: Schema.optional(Schema.String),
              index: Schema.optional(Schema.Finite),
              count: Schema.optional(Schema.Finite),
              start: Schema.optional(Schema.Finite),
              end: Schema.optional(Schema.Finite),
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
export const decodeVoiceMetadata =
  Schema.decodeUnknownSync(VoiceMetadataSchema);
