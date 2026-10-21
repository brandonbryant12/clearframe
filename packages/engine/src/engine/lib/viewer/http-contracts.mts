import * as Schema from 'effect/Schema';
import { JobRequestSchema } from '../harness/contracts.mjs';
import { StudioRequestSchema } from './studio-contracts.mjs';
import { PinSchema } from './schemas.mjs';
const text = Schema.optionalKey(Schema.String),
  boolean = Schema.optionalKey(Schema.Boolean),
  number = Schema.optionalKey(Schema.Number);
/** Shared wire fields are decoded once; command-specific services validate their required fields. */
export const ApiRequestSchema = Schema.StructWithRest(
  Schema.Struct({
    ...JobRequestSchema.fields,
    ...StudioRequestSchema.fields,
    kind: text,
    command: text,
    id: text,
    request: text,
    idea: text,
    title: text,
    documents: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
    playbook: text,
    treatment: text,
    direction: text,
    audience: text,
    takeaway: text,
    format: text,
    mode: text,
    model: text,
    version: text,
    text,
    pin: Schema.optionalKey(Schema.NullOr(PinSchema)),
    element: Schema.optionalKey(Schema.NullOr(Schema.String)),
    scope: Schema.optionalKey(Schema.Unknown),
    resolved: boolean,
    dismiss: boolean,
    paid: boolean,
    force: boolean,
    intent: text,
    basis: Schema.optionalKey(Schema.Unknown),
    approve: number,
    decision: text,
    submission: text,
    delivery: text,
    t: number,
    cancel: boolean,
    integrationID: text,
    key: text,
    answer: Schema.optionalKey(
      Schema.Record(
        Schema.String,
        Schema.Union([
          Schema.String,
          Schema.Number,
          Schema.Boolean,
          Schema.mutable(Schema.Array(Schema.String)),
        ]),
      ),
    ),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export const BridgeRequestSchema = Schema.Struct({
  sessionID: text,
  tool: text,
  input: Schema.optionalKey(Schema.Unknown),
  messageID: text,
});
export const BridgeFileSchema = Schema.Struct({
  pid: Schema.Int,
  url: Schema.String,
  token: Schema.String,
});
export const requiredText = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || !value)
    throw Object.assign(new Error(`${name} is required.`), { status: 400 });
  return value;
};
