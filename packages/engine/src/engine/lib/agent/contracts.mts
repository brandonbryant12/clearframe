import { isRecord } from '../harness/contracts.mjs';
import * as Schema from 'effect/Schema';
import type { JobHarness } from '../harness/jobs.mjs';
import type { AgentRuntime, ModelRef } from './runtime.mjs';
import type { JobView, SoundKind } from '../harness/contracts.mjs';

export const ScopeSchema = Schema.Struct({
  kind: Schema.Literals([
    'film',
    'scene',
    'layer',
    'range',
    'moment',
    'note',
    'asset',
  ]),
  label: Schema.optionalKey(Schema.String),
  beats: Schema.optionalKey(Schema.Array(Schema.String)),
  element: Schema.optionalKey(Schema.String),
  from: Schema.optionalKey(Schema.Number),
  to: Schema.optionalKey(Schema.Number),
  t: Schema.optionalKey(Schema.Number),
  note: Schema.optionalKey(Schema.String),
  noteText: Schema.optionalKey(Schema.String),
  asset: Schema.optionalKey(Schema.String),
  layer: Schema.optionalKey(
    Schema.Struct({
      list: Schema.String,
      index: Schema.Int,
      id: Schema.NullOr(Schema.Union([Schema.String, Schema.Number])),
      type: Schema.NullOr(Schema.String),
      length: Schema.Int,
      sig: Schema.optionalKey(Schema.String),
    }),
  ),
});
export type MessageScope = typeof ScopeSchema.Type;
export type WorkingMode = 'oneshot' | 'together';
export interface AgentFilm {
  id?: string;
  title: string;
  folder: string;
}
export interface Submission {
  id: string;
  text: string;
  scope: MessageScope;
  delivery: 'steer' | 'queue';
  hash: string | null;
  revision: string | null;
  t: number | null;
  at: string;
  state: 'sending' | 'sent' | 'failed';
  error?: string;
}
export interface SpendRequest {
  id: string;
  kind: SoundKind;
  estimate: number;
  detail?: string;
  reason: string;
  at: string;
  state: 'pending' | 'approved' | 'declined';
  job?: string;
  approved?: number;
  by?: string;
  answeredAt?: string;
}
export interface ConversationLink {
  sessionID: string | null;
  model: ModelRef | null;
  previous: { sessionID: string | null; lostAt: string }[];
  submissions: Submission[];
  spend?: SpendRequest[];
  mode?: WorkingMode;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface AgentOptions {
  base?: string;
  runtime: AgentRuntime;
  jobs: JobHarness;
  dirs: () => string[];
  filmOf: (dir: string) => AgentFilm | null | undefined;
  pauseOf: (
    dir: string,
  ) => Pick<JobView, 'id' | 'kind' | 'label'> | null | undefined;
}
export interface PromptRequest {
  submission?: string;
  text?: string;
  scope?: unknown;
  delivery?: string;
  hash?: string;
  revision?: string;
  t?: number;
}
export interface ToolImage {
  mime: string;
  name: string;
  data: string;
}
export interface ToolMetadata {
  summary?: string;
  hash?: string;
  job?: string | null;
  beats?: readonly string[];
  run?: string;
  spend?: string | null;
}
export interface ToolResult {
  content: string;
  metadata: ToolMetadata;
  images?: ToolImage[];
}
export interface CurrentScope {
  scope: MessageScope;
  run: string;
}
export interface ToolOptions extends Omit<AgentOptions, 'runtime' | 'dirs'> {
  base: string;
  currentScope: (
    sessionID: string,
    messageID: string | null,
  ) => Promise<CurrentScope>;
}
export interface ToolInput {
  full?: boolean;
  beat?: string;
  topic?: string;
  name?: string;
  query?: string;
  ['shape']?: string;
  sketchText?: Record<string, string>;
  sketchSay?: Record<string, string>;
  sketchParams?: Record<string, number>;
  label?: string;
  ops?: unknown;
  hash?: string;
  kind?: string;
  requestKey?: string;
  pos?: number;
  at?: number;
  beats?: string[];
  id?: string;
  wait?: number;
  job?: string;
  from?: number;
  to?: number;
  phone?: boolean;
  frames?: number;
  answer?: { id?: string; said?: string; revision?: string };
  all?: boolean;
  read?: string;
  text?: string;
  file?: string;
  action?: string;
  reason?: string;
}
export interface ToolCall {
  dir: string;
  input: ToolInput;
  sessionID: string;
  messageID: string | null;
  wait?: () => void;
}
export type ToolHandlers = Record<
  string,
  (call: ToolCall) => ToolResult | Promise<ToolResult>
>;
const optionalString = Schema.optionalKey(Schema.String);
export const ToolInputSchema = Schema.Struct({
  full: Schema.optionalKey(Schema.Boolean),
  beat: optionalString,
  topic: optionalString,
  name: optionalString,
  query: optionalString,
  shape: optionalString,
  sketchText: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  sketchSay: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  sketchParams: Schema.optionalKey(Schema.Record(Schema.String, Schema.Number)),
  label: optionalString,
  ops: Schema.optionalKey(Schema.Unknown),
  hash: optionalString,
  kind: optionalString,
  requestKey: optionalString,
  pos: Schema.optionalKey(Schema.Number),
  at: Schema.optionalKey(Schema.Number),
  beats: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  id: optionalString,
  wait: Schema.optionalKey(Schema.Number),
  job: optionalString,
  from: Schema.optionalKey(Schema.Number),
  to: Schema.optionalKey(Schema.Number),
  phone: Schema.optionalKey(Schema.Boolean),
  frames: Schema.optionalKey(Schema.Number),
  answer: Schema.optionalKey(
    Schema.Struct({
      id: optionalString,
      said: optionalString,
      revision: optionalString,
    }),
  ),
  all: Schema.optionalKey(Schema.Boolean),
  read: optionalString,
  text: optionalString,
  file: optionalString,
  action: optionalString,
  reason: optionalString,
});
export const getAt = (object: unknown, path: string): unknown => {
  let value = object;
  for (const key of path.split('.')) {
    if (Array.isArray(value)) value = value[Number(key)];
    else if (isRecord(value)) value = value[key];
    else return undefined;
  }
  return value;
};
