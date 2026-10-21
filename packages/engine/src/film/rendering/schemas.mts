import fs from 'node:fs';
import * as Schema from 'effect/Schema';
import { JsonValueSchema } from '../../engine/schemas.mjs';
const report = Schema.StructWithRest(
  Schema.Struct({ backend: Schema.optionalKey(Schema.String) }),
  [Schema.Record(Schema.String, JsonValueSchema)],
);
const plan = Schema.StructWithRest(
  Schema.Struct({ media: Schema.optionalKey(Schema.String) }),
  [Schema.Record(Schema.String, JsonValueSchema)],
);
export type NativeReport = typeof report.Type;
const decodeReport = Schema.decodeUnknownSync(report);
const decodePlan = Schema.decodeUnknownSync(plan);
export const readNativeReport = (file: string) =>
  decodeReport(JSON.parse(fs.readFileSync(file, 'utf8')));
export const readRenderPlan = (file: string) =>
  decodePlan(JSON.parse(fs.readFileSync(file, 'utf8')));
