import * as Schema from 'effect/Schema';
import { isRecord } from './errors.mjs';
import type {
  BarCase,
  BarFixture,
  BarSensitivity,
} from './library-bar-contracts.mjs';
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const caseFields = {
  id: Schema.String,
  storyboard: Schema.Union([
    Schema.String,
    Schema.Record(Schema.String, Schema.Unknown),
  ]),
  at: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
  minPsnr: Schema.optional(Schema.Finite),
  files: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  takeaway: Schema.optional(Schema.String),
  audio: Schema.optional(Schema.Boolean),
};
const CaseSchema = Schema.Struct(caseFields);
const FixtureSchema: Schema.Codec<BarFixture> = Schema.Struct({
  name: Schema.String,
  reference: Schema.optional(Schema.String),
  cases: Schema.Array(CaseSchema).pipe(Schema.mutable),
  refusals: Schema.optional(
    Schema.Array(Schema.Struct({ ...caseFields, match: Schema.String })).pipe(
      Schema.mutable,
    ),
  ),
  sensitivities: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        base: Schema.String,
        changed: Schema.String,
        at: Schema.Finite,
        minChangedFraction: Schema.optional(Schema.Finite),
      }),
    ).pipe(Schema.mutable),
  ),
});
function validCase(entry: BarCase): void {
  if (
    entry.at &&
    (!entry.at.length || entry.at.length > 6 || entry.at.some((n) => n < 0))
  )
    throw new Error(`${entry.id}: at needs 1–6 nonnegative sample times`);
  if (entry.minPsnr != null && (entry.minPsnr < 20 || entry.minPsnr > 80))
    throw new Error(`${entry.id}: minPsnr must be 20–80 dB`);
}
function validSensitivity(
  s: BarSensitivity,
  cases: Set<string>,
  ids: Set<string>,
): void {
  if (
    !ID.test(s.id) ||
    ids.has(s.id) ||
    !cases.has(s.base) ||
    !cases.has(s.changed) ||
    s.base === s.changed
  )
    throw new Error('Sensitivity needs a unique id and two distinct case ids');
  ids.add(s.id);
  if (s.at < 0)
    throw new Error(`${s.id}: sensitivity needs a nonnegative at time`);
  if (
    s.minChangedFraction != null &&
    (s.minChangedFraction <= 0 || s.minChangedFraction > 1)
  )
    throw new Error(
      `${s.id}: minChangedFraction must be greater than zero and at most one`,
    );
}
function caseHeaders(entries: unknown[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !ID.test(entry.id) ||
      ids.has(entry.id)
    )
      throw new Error('Case and refusal ids must be unique lowercase names');
    ids.add(entry.id);
    if (!(typeof entry.storyboard === 'string' || isRecord(entry.storyboard)))
      throw new Error(
        `${entry.id}: storyboard must be an object or JSON file path`,
      );
  }
}
export function validateBarFixture(value: unknown): BarFixture {
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    !ID.test(value.name)
  )
    throw new Error('Library bar needs a lowercase name');
  if (
    !Array.isArray(value.cases) ||
    value.cases.length < 1 ||
    value.cases.length > 12
  )
    throw new Error('Library bar needs 1–12 focused cases');
  if (
    !Array.isArray(value.refusals ?? []) ||
    (Array.isArray(value.refusals) && value.refusals.length > 24)
  )
    throw new Error('Use at most 24 named refusals');
  if (
    !Array.isArray(value.sensitivities ?? []) ||
    (Array.isArray(value.sensitivities) && value.sensitivities.length > 24)
  )
    throw new Error('Use at most 24 prop sensitivities');
  caseHeaders([
    ...value.cases,
    ...(Array.isArray(value.refusals) ? value.refusals : []),
  ]);
  if (!Schema.is(FixtureSchema)(value))
    throw new Error('Invalid library bar fixture fields');
  for (const entry of [...value.cases, ...(value.refusals ?? [])])
    validCase(entry);
  for (const entry of value.refusals ?? []) {
    if (!entry.match.trim())
      throw new Error(`${entry.id}: refusal needs a specific error pattern`);
    new RegExp(entry.match);
  }
  const cases = new Set(value.cases.map((c) => c.id)),
    ids = new Set<string>();
  for (const s of value.sensitivities ?? []) validSensitivity(s, cases, ids);
  return value;
}
