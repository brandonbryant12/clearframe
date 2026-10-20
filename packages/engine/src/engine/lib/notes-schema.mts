import * as Schema from 'effect/Schema';

import type {
  Author,
  NoteAnchor,
  Note,
  BeatBaseline,
  Keep,
  Decision,
} from './notes-model.mjs';
const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;
const Strings = Schema.Array(Schema.String).pipe(Schema.mutable);

const AuthorSchema: Schema.Codec<Author> = Schema.StructWithRest(
  Schema.Struct({
    role: Schema.String,
    name: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const AnchorSchema: Schema.Codec<NoteAnchor> = Schema.StructWithRest(
  Schema.Struct({
    beat: Schema.optionalKey(Schema.String),
    beats: Schema.optionalKey(Strings),
    at: Schema.Finite,
    to: Schema.optionalKey(Schema.Finite),
    beatTime: Schema.optionalKey(Schema.Finite),
    chapter: Schema.optionalKey(Schema.NullOr(Schema.String)),
    words: Schema.optionalKey(Schema.String),
    quoteAt: Schema.optionalKey(Schema.Finite),
    source: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          file: Schema.String,
          from: Schema.Finite,
          to: Schema.Finite,
          original: Schema.optionalKey(
            Schema.Array(Schema.Finite).pipe(Schema.mutable),
          ),
        }),
        Rest,
      ),
    ),
    element: Schema.optionalKey(Schema.String),
    near: Schema.optionalKey(
      Schema.Array(
        Schema.StructWithRest(
          Schema.Struct({ beat: Schema.String, seconds: Schema.Finite }),
          Rest,
        ),
      ).pipe(Schema.mutable),
    ),
    prints: Schema.StructWithRest(
      Schema.Struct({
        authored: Schema.optionalKey(Schema.String),
        picture: Schema.optionalKey(Schema.String),
        words: Schema.optionalKey(Schema.String),
        rendered: Schema.optionalKey(Schema.String),
      }),
      Rest,
    ),
  }),
  Rest,
);
const NoteSchema: Schema.Codec<Note> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    createdAt: Schema.optionalKey(Schema.String),
    author: Schema.optionalKey(AuthorSchema),
    via: Schema.optionalKey(Schema.String),
    revision: Schema.String,
    text: Schema.String,
    scope: Schema.String,
    kind: Schema.optionalKey(Schema.String),
    anchor: Schema.NullOr(AnchorSchema),
    keep: Schema.optionalKey(Strings),
    status: Schema.String,
    history: Schema.Array(
      Schema.StructWithRest(
        Schema.Struct({
          status: Schema.String,
          at: Schema.String,
          revision: Schema.optionalKey(Schema.String),
          by: Schema.optionalKey(Schema.Unknown),
          reason: Schema.optionalKey(Schema.String),
        }),
        Rest,
      ),
    ).pipe(Schema.mutable),
    replies: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          text: Schema.String,
          by: Schema.optionalKey(Schema.NullOr(Schema.String)),
          at: Schema.optionalKey(Schema.NullOr(Schema.String)),
        }),
      ).pipe(Schema.mutable),
    ),
    resolution: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          revision: Schema.optionalKey(Schema.String),
          at: Schema.String,
          summary: Schema.optionalKey(Schema.String),
        }),
        Rest,
      ),
    ),
  }),
  Rest,
);
const BaselineSchema: Schema.Codec<BeatBaseline> = Schema.StructWithRest(
  Schema.Struct({
    voice: Schema.optionalKey(Schema.NullOr(Schema.String)),
    audio: Schema.optionalKey(Schema.NullOr(Schema.String)),
    words: Schema.optionalKey(Schema.String),
    facts: Schema.optionalKey(Schema.String),
    picture: Schema.optionalKey(Schema.String),
    removals: Schema.optionalKey(Strings),
  }),
  Rest,
);
const KeepSchema: Schema.Codec<Keep> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    what: Schema.String,
    scope: Schema.StructWithRest(
      Schema.Struct({
        beats: Schema.optionalKey(Strings),
        film: Schema.optionalKey(Schema.Boolean),
      }),
      Rest,
    ),
    revision: Schema.String,
    by: AuthorSchema,
    said: Schema.optionalKey(Schema.String),
    note: Schema.optionalKey(Schema.String),
    createdAt: Schema.optionalKey(Schema.String),
    active: Schema.Boolean,
    baseline: Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, BaselineSchema]),
    ),
    releasedAt: Schema.optionalKey(Schema.String),
    releasedBy: Schema.optionalKey(AuthorSchema),
    releaseSaid: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const DecisionSchema: Schema.Codec<Decision> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    at: Schema.String,
    action: Schema.String,
    role: Schema.String,
    by: Schema.optionalKey(Schema.String),
    said: Schema.optionalKey(Schema.String),
    reason: Schema.optionalKey(Schema.String),
    revision: Schema.String,
    contentId: Schema.optionalKey(Schema.String),
    videos: Schema.optionalKey(
      Schema.Array(
        Schema.StructWithRest(
          Schema.Struct({
            profile: Schema.optionalKey(Schema.String),
            sha256: Schema.optionalKey(Schema.String),
          }),
          Rest,
        ),
      ).pipe(Schema.mutable),
    ),
    scope: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          checkpoint: Schema.optionalKey(Schema.String),
          note: Schema.optionalKey(Schema.String),
          beats: Schema.optionalKey(Strings),
          keep: Schema.optionalKey(Schema.String),
        }),
        Rest,
      ),
    ),
    film: Schema.optionalKey(Schema.String),
    prints: Schema.optionalKey(
      Schema.Record(
        Schema.String,
        Schema.StructWithRest(
          Schema.Struct({
            authored: Schema.String,
            rendered: Schema.String,
            start: Schema.Finite,
          }),
          Rest,
        ),
      ),
    ),
  }),
  Rest,
);
const NotesFile = Schema.StructWithRest(
  Schema.Struct({ notes: Schema.Array(NoteSchema).pipe(Schema.mutable) }),
  Rest,
);
const KeepsFile = Schema.StructWithRest(
  Schema.Struct({ keeps: Schema.Array(KeepSchema).pipe(Schema.mutable) }),
  Rest,
);
export const decodeNotesFile = Schema.decodeUnknownSync(NotesFile);
export const decodeKeepsFile = Schema.decodeUnknownSync(KeepsFile);
export const decodeDecision = Schema.decodeUnknownSync(DecisionSchema);
