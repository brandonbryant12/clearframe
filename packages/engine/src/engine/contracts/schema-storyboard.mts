import * as Schema from 'effect/Schema';
import type { Beat, Storyboard } from './storyboard.mjs';
import { BlockPropsSchema } from './schema-props.mjs';
import { JsonObjectSchema, JsonValueSchema } from './schema-primitives.mjs';
import {
  CameraCueSchema,
  CameraSettingsSchema,
  MotionSettingsSchema,
  SoundCueSchema,
} from './schema-motion.mjs';
import { ArtSchema, PlateSchema } from './schema-canvas.mjs';
import { AssetSchema, SourceSchema, SpeakerSchema } from './schema-assets.mjs';

export const BeatSchema: Schema.Codec<Beat> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      was: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
      id: Schema.String,
      block: Schema.optional(Schema.String),
      scene: Schema.optional(Schema.String),
      props: Schema.optional(BlockPropsSchema),
      vo: Schema.optional(Schema.String),
      style: Schema.optional(Schema.String),
      chapter: Schema.optional(Schema.String),
      speaker: Schema.optional(Schema.String),
      duration: Schema.optional(Schema.Finite),
      lead: Schema.optional(Schema.Finite),
      tail: Schema.optional(Schema.Finite),
      hold: Schema.optional(Schema.Finite),
      min: Schema.optional(Schema.Finite),
      transition: Schema.optional(Schema.String),
      into: Schema.optional(Schema.String),
      exit: Schema.optional(Schema.String),
      transitionColor: Schema.optional(Schema.String),
      transitionOrigin: Schema.optional(JsonValueSchema),
      lens: Schema.optional(JsonObjectSchema),
      motion: Schema.optional(MotionSettingsSchema),
      sfx: Schema.optional(Schema.Array(SoundCueSchema).pipe(Schema.mutable)),
      tone: Schema.optional(Schema.String),
      textMotion: Schema.optional(Schema.String),
      type: Schema.optional(Schema.String),
      pace: Schema.optional(Schema.Literal('hold')),
      heading: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      note: Schema.optional(Schema.String),
      camera: Schema.optional(Schema.Union([Schema.String, CameraCueSchema])),
      plate: Schema.optional(PlateSchema),
      art: Schema.optional(ArtSchema),
      visual: Schema.optional(Schema.String),
      placeholder: Schema.optional(
        Schema.Union([
          Schema.String,
          Schema.Boolean,
          Schema.StructWithRest(
            Schema.Struct({
              text: Schema.String,
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ]),
      ),
      stage: Schema.optional(JsonObjectSchema),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const StoryboardSchema: Schema.Codec<Storyboard> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      length: Schema.optional(Schema.Finite),
      $schema: Schema.optional(Schema.String),
      version: Schema.optional(Schema.Finite),
      title: Schema.optional(Schema.String),
      logline: Schema.optional(Schema.String),
      audience: Schema.optional(Schema.String),
      budget: Schema.optional(Schema.Finite),
      format: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            width: Schema.optional(Schema.Finite),
            height: Schema.optional(Schema.Finite),
            fps: Schema.optional(Schema.Finite),
            preset: Schema.optional(Schema.String),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
      theme: Schema.optional(
        Schema.Union([
          Schema.String,
          Schema.Record(Schema.String, Schema.String),
        ]),
      ),
      motion: Schema.optional(MotionSettingsSchema),
      transition: Schema.optional(Schema.String),
      backdrop: Schema.optional(Schema.String),
      chrome: Schema.optional(Schema.Boolean),
      captions: Schema.optional(
        Schema.Union([Schema.Boolean, Schema.String, JsonObjectSchema]),
      ),
      sfx: Schema.optional(
        Schema.Union([Schema.Boolean, Schema.String, JsonObjectSchema]),
      ),
      treatment: Schema.optional(Schema.String),
      camera: Schema.optional(
        Schema.Union([Schema.String, CameraSettingsSchema]),
      ),
      lens: Schema.optional(JsonObjectSchema),
      speakers: Schema.optional(Schema.Record(Schema.String, SpeakerSchema)),
      frame: Schema.optional(
        Schema.Union([Schema.Boolean, Schema.String, JsonObjectSchema]),
      ),
      heading: Schema.optional(Schema.String),
      textMotion: Schema.optional(Schema.String),
      type: Schema.optional(Schema.String),
      texture: Schema.optional(Schema.Union([Schema.String, JsonObjectSchema])),
      voice: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            provider: Schema.optional(Schema.String),
            model: Schema.optional(Schema.String),
            voice: Schema.optional(Schema.String),
            style: Schema.optional(Schema.String),
            wpm: Schema.optional(Schema.Finite),
            takes: Schema.optional(
              Schema.Union([
                Schema.Literal('film'),
                Schema.Literal('chapter'),
                Schema.Literal('beat'),
              ]),
            ),
            language: Schema.optional(Schema.String),
            perBeatStyle: Schema.optional(Schema.Boolean),
            draftVoice: Schema.optional(Schema.String),
            pronounce: Schema.optional(
              Schema.Record(Schema.String, Schema.String),
            ),
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
      ),
      music: Schema.optional(
        Schema.Union([
          Schema.Literal(false),
          Schema.StructWithRest(
            Schema.Struct({
              provider: Schema.optional(Schema.String),
              model: Schema.optional(Schema.String),
              volume: Schema.optional(Schema.Finite),
              duck: Schema.optional(Schema.Boolean),
              fadeIn: Schema.optional(Schema.Finite),
              fadeOut: Schema.optional(Schema.Finite),
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
                    at: Schema.optional(
                      Schema.Union([Schema.Finite, Schema.String]),
                    ),
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
        ]),
      ),
      mix: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            loudness: Schema.optional(Schema.Finite),
            voiceGain: Schema.optional(Schema.Finite),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
      pacing: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            lead: Schema.optional(Schema.Finite),
            tail: Schema.optional(Schema.Finite),
            minBeat: Schema.optional(Schema.Finite),
            silentBeat: Schema.optional(Schema.Finite),
            outro: Schema.optional(Schema.Finite),
            continuous: Schema.optional(Schema.Boolean),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
      sources: Schema.optional(Schema.Array(SourceSchema).pipe(Schema.mutable)),
      continuity: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            maxGeneratedShare: Schema.optional(Schema.Finite),
            refs: Schema.optional(
              Schema.Array(Schema.String).pipe(Schema.mutable),
            ),
            treatment: Schema.optional(Schema.String),
            lighting: Schema.optional(Schema.String),
            camera: Schema.optional(Schema.String),
            motion: Schema.optional(Schema.String),
            motif: Schema.optional(Schema.String),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
      assets: Schema.optional(Schema.Array(AssetSchema).pipe(Schema.mutable)),
      beats: Schema.Array(BeatSchema).pipe(Schema.mutable),
      stages: Schema.optional(
        Schema.Array(JsonObjectSchema).pipe(Schema.mutable),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const decodeStoryboard = Schema.decodeUnknownSync(StoryboardSchema);
