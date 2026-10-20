import * as Schema from 'effect/Schema';
import type { Cue } from '../contracts/primitives.mjs';

export const CueSchema: Schema.Codec<Cue> = Schema.suspend(() =>
  Schema.Union([Schema.Finite, Schema.String]),
);
