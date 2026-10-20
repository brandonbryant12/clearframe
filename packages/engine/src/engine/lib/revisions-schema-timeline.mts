import * as Schema from 'effect/Schema';
import type { Word } from '../domain.mjs';

import type {
  BeatPrints,
  TimelineVoice,
  RemovedSpan,
  TimelineSource,
  Coupling,
  TimelineBeat,
  Timeline,
} from './revisions-model.mjs';
const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;
const Strings = Schema.Array(Schema.String).pipe(Schema.mutable);
const Span = Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable);

const PrintsSchema: Schema.Codec<BeatPrints> = Schema.StructWithRest(
  Schema.Struct({
    authored: Schema.String,
    own: Schema.String,
    rendered: Schema.String,
    picture: Schema.String,
    words: Schema.String,
    audio: Schema.NullOr(Schema.String),
    voice: Schema.NullOr(Schema.String),
    facts: Schema.String,
  }),
  Rest,
);
const VoiceSchema: Schema.Codec<TimelineVoice> = Schema.StructWithRest(
  Schema.Struct({
    text: Schema.String,
    start: Schema.Finite,
    end: Schema.Finite,
    timing: Schema.String,
    estimated: Schema.Boolean,
    provider: Schema.NullOr(Schema.String),
    take: Schema.NullOr(Schema.String),
    plannedTake: Schema.NullOr(Schema.String),
  }),
  Rest,
);
const WordSchema: Schema.Codec<Word> = Schema.StructWithRest(
  Schema.Struct({ w: Schema.String, t0: Schema.Finite, t1: Schema.Finite }),
  Rest,
);
const RemovedSpanSchema: Schema.Codec<RemovedSpan> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    kind: Schema.String,
    words: Schema.String,
    from: Schema.Finite,
    to: Schema.Finite,
    note: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const SourceSchema: Schema.Codec<TimelineSource> = Schema.StructWithRest(
  Schema.Struct({
    file: Schema.String,
    offset: Schema.Finite,
    segments: Schema.Array(
      Schema.StructWithRest(Schema.Struct({ film: Span, source: Span }), Rest),
    ).pipe(Schema.mutable),
    removed: Schema.Array(RemovedSpanSchema).pipe(Schema.mutable),
  }),
  Rest,
);
const CouplingSchema: Schema.Codec<Coupling> = Schema.StructWithRest(
  Schema.Struct({
    exit: Schema.optionalKey(Schema.NullOr(Schema.String)),
    continues: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
    handoff: Schema.optionalKey(Schema.Boolean),
    morph: Schema.optionalKey(Schema.Boolean),
    carried: Schema.optionalKey(Schema.Boolean),
  }),
  Rest,
);
const TimelineBeatSchema: Schema.Codec<TimelineBeat> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    index: Schema.Finite,
    chapter: Schema.NullOr(Schema.String),
    block: Schema.NullOr(Schema.String),
    speaker: Schema.NullOr(Schema.String),
    start: Schema.Finite,
    end: Schema.Finite,
    startFrame: Schema.Finite,
    frames: Schema.Finite,
    transition: Schema.String,
    exit: Schema.optionalKey(Schema.NullOr(Schema.String)),
    world: Schema.NullOr(Schema.String),
    placeholder: Schema.NullOr(Schema.String),
    visual: Schema.NullOr(Schema.String),
    vo: Schema.NullOr(VoiceSchema),
    words: Schema.Array(WordSchema).pipe(Schema.mutable),
    source: Schema.NullOr(SourceSchema),
    elements: Strings,
    was: Schema.NullOr(Strings),
    coupling: Schema.optionalKey(CouplingSchema),
    prints: PrintsSchema,
  }),
  Rest,
);
const TimelineSchema: Schema.Codec<Timeline> = Schema.StructWithRest(
  Schema.Struct({
    version: Schema.Finite,
    printScheme: Schema.optionalKey(Schema.Finite),
    title: Schema.String,
    fps: Schema.Finite,
    frames: Schema.Finite,
    duration: Schema.Finite,
    width: Schema.Finite,
    height: Schema.Finite,
    music: Schema.NullOr(
      Schema.StructWithRest(
        Schema.Struct({ src: Schema.String, offset: Schema.Finite }),
        Rest,
      ),
    ),
    film: Schema.StructWithRest(
      Schema.Struct({
        look: Schema.String,
        sound: Schema.String,
        voice: Schema.String,
        data: Schema.String,
        renderer: Schema.String,
      }),
      Rest,
    ),
    beats: Schema.Array(TimelineBeatSchema).pipe(Schema.mutable),
  }),
  Rest,
);
export const decodeTimeline = Schema.decodeUnknownSync(TimelineSchema);
