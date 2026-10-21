import * as Schema from 'effect/Schema';
import type { TimedVoice, TimedBeat, MusicTiming, Timing } from './timing.mjs';
import { JsonObjectSchema, WordSchema } from './schema-primitives.mjs';
import { BlockPropsSchema } from './schema-props.mjs';

export const TimedVoiceSchema: Schema.Codec<TimedVoice> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      start: Schema.Finite,
      end: Schema.Finite,
      text: Schema.String,
      src: Schema.Union([Schema.String, Schema.Null]),
      dur: Schema.Finite,
      estimated: Schema.Boolean,
      provider: Schema.Union([Schema.String, Schema.Null]),
      wordTiming: Schema.Union([
        Schema.Literal('estimated'),
        Schema.Literal('measured'),
      ]),
      alignmentIssue: Schema.optional(Schema.String),
      stale: Schema.optional(Schema.String),
      words: Schema.Array(WordSchema).pipe(Schema.mutable),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const TimedBeatSchema: Schema.Codec<TimedBeat> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      start: Schema.Finite,
      end: Schema.Finite,
      id: Schema.String,
      index: Schema.Finite,
      chapter: Schema.Union([Schema.String, Schema.Null]),
      scene: Schema.Union([Schema.String, Schema.Null]),
      block: Schema.Union([Schema.String, Schema.Null]),
      props: Schema.Union([BlockPropsSchema, Schema.Null]),
      transition: Schema.Union([Schema.String, Schema.Null]),
      dur: Schema.Finite,
      visual: Schema.Union([Schema.String, Schema.Null]),
      vo: Schema.optional(TimedVoiceSchema),
      sfx: Schema.optional(
        Schema.Array(
          Schema.StructWithRest(
            Schema.Struct({
              src: Schema.String,
              volume: Schema.Finite,
              t: Schema.Finite,
            }),
            [Schema.Record(Schema.String, Schema.Unknown)],
          ),
        ).pipe(Schema.mutable),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const MusicTimingSchema: Schema.Codec<MusicTiming> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      src: Schema.Union([Schema.String, Schema.Null]),
      volume: Schema.Finite,
      duck: Schema.Boolean,
      fadeIn: Schema.Finite,
      fadeOut: Schema.Finite,
      offset: Schema.Finite,
      scored: Schema.Boolean,
      drop: Schema.optional(
        Schema.StructWithRest(
          Schema.Struct({
            beat: Schema.String,
            film: Schema.Finite,
            song: Schema.Finite,
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const TimingSchema: Schema.Codec<Timing> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      title: Schema.String,
      width: Schema.Finite,
      height: Schema.Finite,
      fps: Schema.Finite,
      duration: Schema.Finite,
      frames: Schema.Finite,
      theme: Schema.Union([
        Schema.String,
        Schema.Record(Schema.String, Schema.String),
      ]),
      estimated: Schema.Boolean,
      beats: Schema.Array(TimedBeatSchema).pipe(Schema.mutable),
      music: Schema.Union([MusicTimingSchema, Schema.Null]),
      assets: Schema.Array(
        Schema.StructWithRest(
          Schema.Struct({
            id: Schema.String,
            kind: Schema.String,
            src: Schema.Union([Schema.String, Schema.Null]),
          }),
          [Schema.Record(Schema.String, Schema.Unknown)],
        ),
      ).pipe(Schema.mutable),
      look: Schema.StructWithRest(
        Schema.Struct({
          backdrop: Schema.String,
          chrome: Schema.Boolean,
          captions: Schema.Union([
            Schema.Boolean,
            Schema.String,
            JsonObjectSchema,
          ]),
          transition: Schema.String,
          sfx: Schema.Union([Schema.Boolean, Schema.String, JsonObjectSchema]),
          voiceProvider: Schema.String,
        }),
        [Schema.Record(Schema.String, Schema.Unknown)],
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
