import * as Schema from 'effect/Schema';

import type {
  Placeholder,
  RevisionVideo,
  PreviewSide,
  RevisionPreview,
  Lineage,
  RevisionMeta,
} from './revisions-model.mjs';
const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;
const Strings = Schema.Array(Schema.String).pipe(Schema.mutable);
const Frames = Schema.Array(Schema.Finite).pipe(Schema.mutable);

const VideoSchema: Schema.Codec<RevisionVideo> = Schema.StructWithRest(
  Schema.Struct({
    profile: Schema.optionalKey(Schema.String),
    object: Schema.String,
    sha256: Schema.optionalKey(Schema.String),
    receipt: Schema.optionalKey(Schema.String),
    frames: Schema.optionalKey(Schema.Finite),
    encoder: Schema.optionalKey(Schema.String),
    renderedAt: Schema.optionalKey(Schema.String),
    retained: Schema.optionalKey(Schema.Boolean),
    releasedAt: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const PreviewSideSchema: Schema.Codec<PreviewSide> = Schema.StructWithRest(
  Schema.Struct({
    object: Schema.NullOr(Schema.String),
    revision: Schema.optionalKey(Schema.String),
    frames: Schema.optionalKey(Frames),
    verified: Schema.optionalKey(Schema.Unknown),
  }),
  Rest,
);
const PreviewSchema: Schema.Codec<RevisionPreview> = Schema.StructWithRest(
  Schema.Struct({
    beats: Strings,
    removed: Strings,
    before: Schema.NullOr(PreviewSideSchema),
    after: Schema.NullOr(PreviewSideSchema),
  }),
  Rest,
);
const FromSchema = Schema.StructWithRest(
  Schema.Struct({ from: Strings }),
  Rest,
);
const LineageSchema: Schema.Codec<Lineage> = Schema.StructWithRest(
  Schema.Struct({
    added: Schema.Record(Schema.String, FromSchema),
    removed: Schema.Record(
      Schema.String,
      Schema.StructWithRest(
        Schema.Struct({
          into: Schema.optionalKey(Strings),
          deleted: Schema.optionalKey(Schema.Boolean),
          by: Schema.optionalKey(Schema.String),
          words: Schema.optionalKey(Schema.String),
          text: Schema.optionalKey(Schema.NullOr(Schema.String)),
        }),
        Rest,
      ),
    ),
    merged: Schema.Record(Schema.String, FromSchema),
  }),
  Rest,
);
const PlaceholderSchema: Schema.Codec<Placeholder> = Schema.StructWithRest(
  Schema.Struct({ beat: Schema.String, reason: Schema.String }),
  Rest,
);
const RevisionMetaSchema: Schema.Codec<RevisionMeta> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    parent: Schema.optionalKey(Schema.NullOr(Schema.String)),
    createdAt: Schema.optionalKey(Schema.String),
    kind: Schema.optionalKey(Schema.String),
    label: Schema.optionalKey(Schema.String),
    reason: Schema.optionalKey(Schema.String),
    by: Schema.optionalKey(Schema.String),
    contentId: Schema.optionalKey(Schema.String),
    inputId: Schema.optionalKey(Schema.String),
    renderer: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          sourceHash: Schema.optionalKey(Schema.String),
          fonts: Schema.optionalKey(Schema.String),
          plan: Schema.optionalKey(Schema.String),
        }),
        Rest,
      ),
    ),
    frames: Schema.optionalKey(Schema.Finite),
    fps: Schema.optionalKey(Schema.Finite),
    duration: Schema.optionalKey(Schema.Finite),
    beats: Schema.optionalKey(Schema.Finite),
    placeholders: Schema.optionalKey(
      Schema.Array(PlaceholderSchema).pipe(Schema.mutable),
    ),
    unfinished: Schema.optionalKey(
      Schema.Array(Schema.Unknown).pipe(Schema.mutable),
    ),
    estimatedTiming: Schema.optionalKey(Strings),
    notes: Schema.optionalKey(Strings),
    lastEdit: Schema.optionalKey(Schema.NullOr(Schema.String)),
    lineage: Schema.optionalKey(Schema.NullOr(LineageSchema)),
    inputs: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
    job: Schema.optionalKey(Schema.String),
    videos: Schema.optionalKey(Schema.Array(VideoSchema).pipe(Schema.mutable)),
    previews: Schema.optionalKey(
      Schema.Array(PreviewSchema).pipe(Schema.mutable),
    ),
    impact: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          from: Schema.String,
          summary: Strings,
          counts: Schema.Record(Schema.String, Schema.Finite),
        }),
        Rest,
      ),
    ),
  }),
  Rest,
);
export const decodeRevisionMeta = Schema.decodeUnknownSync(RevisionMetaSchema);
