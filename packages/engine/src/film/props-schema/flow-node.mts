import * as Schema from 'effect/Schema';
import type { FlowNode } from '../contracts/props.mjs';
import { CueSchema } from './cue.mjs';

export const FlowNodeSchema: Schema.Codec<FlowNode> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      say: Schema.optional(CueSchema),
      at: Schema.optional(Schema.Finite),
      icon: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      detail: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
