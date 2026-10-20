import * as Schema from 'effect/Schema';
import type { NoteRecord } from './contracts.mjs';
const text = Schema.optionalKey(Schema.String),
  number = Schema.optionalKey(Schema.Number);
export const PinSchema = Schema.Struct({
  x: number,
  y: number,
  on: text,
  element: text,
});
export const PinsSchema = Schema.Record(Schema.String, PinSchema);
const ReplySchema = Schema.Struct({
  text: Schema.String,
  by: Schema.optionalKey(Schema.NullOr(Schema.String)),
  at: Schema.optionalKey(Schema.NullOr(Schema.String)),
});
export const NoteSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  status: text,
  version: text,
  revision: text,
  createdAt: text,
  by: Schema.optionalKey(Schema.NullOr(Schema.String)),
  author: Schema.optionalKey(
    Schema.Union([Schema.String, Schema.Struct({ name: text })]),
  ),
  scope: text,
  at: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  element: Schema.optionalKey(Schema.NullOr(Schema.String)),
  pin: Schema.optionalKey(Schema.NullOr(PinSchema)),
  anchor: Schema.optionalKey(Schema.Struct({ at: number, element: text })),
  resolution: Schema.optionalKey(
    Schema.Struct({ revision: text, summary: text }),
  ),
  replies: Schema.optionalKey(Schema.mutable(Schema.Array(ReplySchema))),
  history: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({ status: Schema.String, at: Schema.String, by: text }),
      ),
    ),
  ),
});
export const NotesSchema = Schema.Struct({
  notes: Schema.mutable(Schema.Array(NoteSchema)),
});
export const decodeNote = (value: unknown): NoteRecord =>
  Schema.decodeUnknownSync(NoteSchema)(value);
export const BedSchema = Schema.Struct({
  file: text,
  provider: text,
  createdAt: text,
});
export const CuesSchema = Schema.mutable(
  Schema.Array(Schema.Struct({ t: Schema.Number, name: Schema.String })),
);
const TextElementSchema = Schema.Struct({
  type: Schema.String,
  id: text,
  text,
  x: number,
  y: number,
  size: number,
  font: text,
  fill: text,
  at: number,
  width: number,
  height: number,
  upper: Schema.optionalKey(Schema.Boolean),
  fit: number,
  tracking: number,
  anchor: text,
  count: Schema.optionalKey(
    Schema.Struct({ to: Schema.Number, prefix: text, suffix: text }),
  ),
});
export const PreparedJobSchema = Schema.Struct({
  fps: number,
  width: number,
  height: number,
  theme: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  type: Schema.optionalKey(
    Schema.Struct({ id: text, display: text, emphasis: text }),
  ),
  beats: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          id: Schema.String,
          start_frame: Schema.Number,
          frames: Schema.Number,
          captions: Schema.optionalKey(
            Schema.mutable(
              Schema.Array(
                Schema.Struct({
                  start: Schema.Number,
                  end: Schema.Number,
                  text: Schema.String,
                }),
              ),
            ),
          ),
          props: Schema.optionalKey(
            Schema.Struct({
              elements: Schema.optionalKey(
                Schema.mutable(Schema.Array(TextElementSchema)),
              ),
            }),
          ),
        }),
      ),
    ),
  ),
});
const ElementSchema = Schema.Struct({
  id: text,
  text,
  font: text,
  size: number,
  colorName: text,
  color: text,
  box: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Number))),
  at: number,
});
const SceneSchema = Schema.Struct({
  id: text,
  start: Schema.Number,
  end: Schema.Number,
  kind: text,
  onScreen: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  source: text,
  narration: text,
  description: text,
  media: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  elements: Schema.optionalKey(Schema.mutable(Schema.Array(ElementSchema))),
});
const LanesSchema = Schema.Struct({
  narration: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          start: Schema.Number,
          end: Schema.Number,
          text: Schema.String,
        }),
      ),
    ),
  ),
  music: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          start: Schema.Number,
          end: Schema.NullOr(Schema.Number),
          name: Schema.String,
          asset: text,
        }),
      ),
    ),
  ),
  sfx: Schema.optionalKey(CuesSchema),
});
const LookSchema = Schema.Struct({
  palette: Schema.optionalKey(
    Schema.Union([Schema.String, Schema.Record(Schema.String, Schema.String)]),
  ),
  type: text,
  format: text,
  fps: number,
});
export const ManifestSchema = Schema.Struct({
  title: text,
  stage: text,
  about: text,
  frame: Schema.optionalKey(
    Schema.Struct({ width: Schema.Number, height: Schema.Number }),
  ),
  fonts: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          file: Schema.String,
          family: text,
          style: text,
          license: text,
          used: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
        }),
      ),
    ),
  ),
  versions: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        file: Schema.String,
        id: text,
        label: text,
        createdAt: text,
        quality: text,
        posterAt: number,
        approved: Schema.optionalKey(Schema.Struct({ by: text, said: text })),
        scenes: Schema.optionalKey(Schema.mutable(Schema.Array(SceneSchema))),
        lanes: Schema.optionalKey(LanesSchema),
      }),
    ),
  ),
  scenes: Schema.optionalKey(Schema.mutable(Schema.Array(SceneSchema))),
  lanes: Schema.optionalKey(LanesSchema),
  palette: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  look: Schema.optionalKey(LookSchema),
});
