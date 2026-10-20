import fs from 'node:fs';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import { reviewPath } from '../store.mjs';
export const IntentSchema = Schema.Struct({
  kind: Schema.Literals(['voice', 'music']),
  job: Schema.String,
  by: Schema.String,
  approved: Schema.Number,
  estimate: Schema.Number,
  basis: Schema.Unknown,
  at: Schema.String,
  provider: Schema.optionalKey(Schema.String),
  intent: Schema.optionalKey(Schema.String),
  request: Schema.optionalKey(Schema.Union([Schema.String, Schema.Null])),
});
const IntentsSchema = Schema.Record(Schema.String, IntentSchema);
type SpendIntent = typeof IntentSchema.Type;
const intentsFile = (dir: string) => reviewPath(dir, 'spend-intents.json');
export const readIntents = (dir: string): Record<string, SpendIntent> => {
  try {
    return Schema.decodeUnknownSync(IntentsSchema)(
      JSON.parse(fs.readFileSync(intentsFile(dir), 'utf8')),
    );
  } catch {
    return {};
  }
};
export function writeIntent(dir: string, id: string, record: SpendIntent) {
  const all = readIntents(dir);
  all[id] = record;
  fs.mkdirSync(reviewPath(dir), { recursive: true });
  const tmp = `${intentsFile(dir)}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 1));
  fs.renameSync(tmp, intentsFile(dir));
}
