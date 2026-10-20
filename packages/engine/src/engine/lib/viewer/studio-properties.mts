import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import type { Beat, Storyboard } from '../../domain.mjs';
import type { StudioOperation } from './studio-contracts.mjs';
import { ROOT } from './media.mjs';
import { isRecord } from '../harness/contracts.mjs';
import { fail } from './studio-history.mjs';
const SAFE = /^(?:[A-Za-z_][\w-]*|\d+)$/,
  BAD = new Set(['__proto__', 'constructor', 'prototype']);
export const SCHEMA = Schema.decodeUnknownSync(
  Schema.Struct({ properties: Schema.Record(Schema.String, Schema.Unknown) }),
)(
  JSON.parse(
    fs.readFileSync(path.join(ROOT, 'schema/storyboard.schema.json'), 'utf8'),
  ),
);
export const BEAT_SCHEMA = Schema.decodeUnknownSync(
  Schema.Struct({
    items: Schema.Struct({
      properties: Schema.Record(Schema.String, Schema.Unknown),
    }),
  }),
)(SCHEMA.properties.beats);
export const BEAT_KEYS = new Set(
  Object.keys(BEAT_SCHEMA.items.properties)
    .filter((k) => !['id', 'block'].includes(k))
    .concat('placeholder', 'speaker', 'stage'),
);
export const FILM_KEYS = new Set(
  Object.keys(SCHEMA.properties)
    .filter(
      (k) =>
        ![
          '$schema',
          'version',
          'beats',
          'assets',
          'speakers',
          'continuity',
        ].includes(k),
    )
    .concat('stages'),
);
export const touchesBudget = (op: StudioOperation) =>
  ['set', 'film.set'].includes(op?.command) &&
  (op.target ?? (op.beat == null ? 'film' : 'beat')) === 'film' &&
  String(op.path ?? op.field ?? '').split('.')[0] === 'budget';
export function parts(p: unknown) {
  const list = String(p ?? '').split('.');
  if (!p || list.some((x) => !SAFE.test(x) || BAD.has(x)))
    throw fail(`Unsupported property path “${p}”.`);
  return list;
}
export function checkValue(value: unknown) {
  if (value === undefined) return;
  const json = JSON.stringify(value);
  if (json == null || json.length > 200000)
    throw fail('That value is too large or not JSON.');
  JSON.parse(json, (k, v) => {
    if (BAD.has(k)) throw fail('Unsupported key.');
    if (typeof v === 'string' && v.length > 20000)
      throw fail('Enter text shorter than 20,000 characters.');
    return v;
  });
}
type PropertyContainer = Record<string, unknown> | unknown[];
function properties(value: unknown): PropertyContainer {
  if (Array.isArray(value) || isRecord(value)) return value;
  throw fail('The property parent is not an object.');
}
function propertyAt(parent: PropertyContainer, key: string): unknown {
  return Array.isArray(parent) ? parent[Number(key)] : parent[key];
}
function writeProperty(
  parent: PropertyContainer,
  key: string,
  value: unknown,
): void {
  if (!Array.isArray(parent)) {
    if (value == null) delete parent[key];
    else parent[key] = value;
    return;
  }
  if (!/^\d+$/.test(key)) throw fail('Use an index to change a list.');
  const index = Number(key);
  if (index > parent.length) throw fail('That list is shorter.');
  if (value == null) parent.splice(index, 1);
  else parent[index] = value;
}
/** Set or remove a property in the validated editor's JSON-compatible domain objects. */
export function setAt(
  target: Storyboard | Beat,
  list: string[],
  value: unknown,
) {
  let current = properties(target);
  for (let i = 0; i < list.length - 1; i++) {
    const key = list[i];
    let child = propertyAt(current, key);
    if (child == null) {
      if (value == null) return;
      child = /^\d+$/.test(list[i + 1]) ? [] : {};
      writeProperty(current, key, child);
    }
    current = properties(child);
  }
  const last = list.at(-1);
  if (!last) throw fail('A property path is required.');
  writeProperty(current, last, structuredClone(value));
}
