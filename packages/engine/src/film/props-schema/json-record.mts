import * as Schema from 'effect/Schema';
import type { JsonRecord } from '../contracts/primitives.mjs';

export const JsonRecordSchema: Schema.Codec<JsonRecord> = Schema.suspend(() =>
  Schema.Record(Schema.String, Schema.Unknown),
);
