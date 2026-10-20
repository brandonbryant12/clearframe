import * as Schema from 'effect/Schema';
import type { Timing } from '../../domain.mjs';
export interface StudioOperation {
  command: string;
  target?: string;
  beat?: string;
  path?: string;
  field?: string;
  value?: unknown;
  to?: number;
  direction?: number;
  after?: string;
  id?: string;
  sketch?: string;
  block?: string;
  created?: string;
}
export interface WordSelection {
  beat?: string;
  k?: number;
}
export interface StudioRequest extends Omit<StudioOperation, 'to'> {
  hash?: string;
  label?: string;
  ops?: unknown;
  run?: string;
  by?: string;
  k?: number;
  dryRun?: boolean;
  from?: WordSelection;
  to?: number | WordSelection;
}
export interface HistoryEntry {
  before: string;
  after: string;
  label: string;
  at: string;
  kind?: string;
  op?: string;
  by?: string | { role: string; name?: string };
  run?: string | null;
  undo?: boolean;
  redo?: boolean;
  edit?: string;
  words?: number[];
}
export interface StudioHistory {
  entries: HistoryEntry[];
  cursor: number;
}
export interface TextBox {
  text: string;
  box: number[];
  at: number;
  path: string | null;
}
export interface StudioTiming extends Pick<
  Timing,
  'duration' | 'fps' | 'width' | 'height' | 'frames' | 'estimated'
> {
  beats: {
    id: string;
    start: number;
    end: number;
    dur: number;
    chapter: string | null;
    vo?: {
      start: number;
      end: number;
      estimated: boolean;
      wordTiming: string;
      provider: string | null;
      stale: string | null;
      words: { w: string; t0: number; t1: number; k: number }[];
    };
  }[];
}
export interface StudioAnalysis {
  errors: string[];
  warnings: string[];
  timing: StudioTiming | null;
  boxes: Record<string, TextBox[]>;
}
const text = Schema.optionalKey(Schema.String),
  num = Schema.optionalKey(Schema.Number);
export const OperationSchema = Schema.Struct({
  command: Schema.String,
  target: text,
  beat: text,
  path: text,
  field: text,
  value: Schema.optionalKey(Schema.Unknown),
  to: num,
  direction: num,
  after: text,
  id: text,
  sketch: text,
  block: text,
  created: text,
});
export const OperationsSchema = Schema.mutable(Schema.Array(OperationSchema));
const WordSelectionSchema = Schema.Struct({ beat: text, k: num });
export const StudioRequestSchema = Schema.Struct({
  ...OperationSchema.fields,
  hash: text,
  label: text,
  ops: Schema.optionalKey(Schema.Unknown),
  run: text,
  by: text,
  k: num,
  dryRun: Schema.optionalKey(Schema.Boolean),
  from: Schema.optionalKey(WordSelectionSchema),
  to: Schema.optionalKey(Schema.Union([Schema.Number, WordSelectionSchema])),
});
export const HistorySchema = Schema.Struct({
  cursor: Schema.Int,
  entries: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        before: Schema.String,
        after: Schema.String,
        label: Schema.String,
        at: Schema.String,
        kind: text,
        op: text,
        by: Schema.optionalKey(
          Schema.Union([
            Schema.String,
            Schema.Struct({
              role: Schema.String,
              name: Schema.optionalKey(Schema.String),
            }),
          ]),
        ),
        run: Schema.optionalKey(Schema.NullOr(Schema.String)),
        undo: Schema.optionalKey(Schema.Boolean),
        redo: Schema.optionalKey(Schema.Boolean),
        edit: text,
        words: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Int))),
      }),
    ),
  ),
});
