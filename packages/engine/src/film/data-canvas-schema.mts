import * as Schema from 'effect/Schema';
import type { ChartSpec } from './data-canvas-contracts.mjs';
import type { Fail } from './types.mjs';
import { isRecord, isList, messageOf } from './guards.mjs';
const chartValue = Schema.StructWithRest(
  Schema.Struct({
    label: Schema.String,
    value: Schema.Finite,
    say: Schema.optional(Schema.String),
    highlight: Schema.optional(Schema.Boolean),
    id: Schema.optional(Schema.String),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const chartNote = Schema.StructWithRest(
  Schema.Struct({
    text: Schema.String,
    to: Schema.optional(Schema.String),
    say: Schema.optional(Schema.String),
    at: Schema.optional(Schema.Finite),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const chartSchema: Schema.Codec<ChartSpec> = Schema.StructWithRest(
  Schema.Struct({
    kind: Schema.Literals(['bars', 'stack', 'number']),
    values: Schema.Array(chartValue).pipe(Schema.mutable),
    box: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
    max: Schema.optional(Schema.Finite),
    id: Schema.optional(Schema.String),
    at: Schema.optional(Schema.Finite),
    stagger: Schema.optional(Schema.Finite),
    note: Schema.optional(chartNote),
    prefix: Schema.optional(Schema.String),
    suffix: Schema.optional(Schema.String),
    decimals: Schema.optional(Schema.Finite),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
export function decodeChartInput(input: unknown, fail: Fail): ChartSpec {
  if (!isRecord(input)) fail('chart must be {kind, values, …}');
  if (!['bars', 'stack', 'number'].includes(String(input.kind)))
    fail('chart.kind must be bars, stack or number');
  if (!isList(input.values) || !input.values.length || input.values.length > 12)
    fail(
      `chart.values must be 1–12 {label, value}, like "values": [{"label": "Link expires after", "value": 7, "say": "seven"}]${[
        'rows',
        'data',
        'items',
        'bars',
        'series',
        'value',
        'number',
      ]
        .filter((k) => input[k] != null)
        .map((k) => ` (it has ${k}: the figures go in values)`)
        .join('')}`,
    );
  for (const [i, value] of input.values.entries()) {
    if (
      !isRecord(value) ||
      typeof value.value !== 'number' ||
      !Number.isFinite(value.value) ||
      value.value < 0
    )
      fail(`chart.values[${i}].value must be a nonnegative number`);
    if (typeof value.label !== 'string' || !value.label.trim())
      fail(`chart.values[${i}] needs a label`);
    if (
      value.say != null &&
      (typeof value.say !== 'string' || !value.say.trim())
    )
      fail(
        `chart.values[${i}].say must be a word of the narration: the value lands when it is spoken`,
      );
  }
  try {
    return Schema.decodeUnknownSync(chartSchema)(input);
  } catch (error) {
    return fail(`chart: ${messageOf(error)}`);
  }
}
export function fieldOf(input: unknown, key: string): unknown {
  return isRecord(input) ? input[key] : undefined;
}
