import * as Schema from 'effect/Schema';

const number = Schema.Finite;
const optionalNumber = Schema.optionalKey(number);
const optionalText = Schema.optionalKey(Schema.String);
const point = Schema.Tuple([number, number]).pipe(Schema.mutable);
const box = Schema.optionalKey(
  Schema.Tuple([number, number, number, number]).pipe(Schema.mutable),
);
const timing = { at: optionalNumber, say: optionalText, dur: optionalNumber };
const cue = Schema.Struct(timing);
const axis = Schema.Struct({
  domain: Schema.optionalKey(point),
  label: optionalText,
});
const functionSchema = Schema.Struct({
  kind: Schema.String,
  m: optionalNumber,
  b: optionalNumber,
  a: optionalNumber,
  p: optionalNumber,
  k: optionalNumber,
  L: optionalNumber,
  x0: optionalNumber,
  A: optionalNumber,
  period: optionalNumber,
  phase: optionalNumber,
  mu: optionalNumber,
  sigma: optionalNumber,
  c: optionalNumber,
  measure: optionalText,
});
const rate = Schema.Union([number, functionSchema]);

export const graphSchema = Schema.Struct({
  fn: rate,
  x: Schema.optionalKey(axis),
  y: Schema.optionalKey(axis),
  box,
  draw: Schema.optionalKey(cue),
  sweep: Schema.optionalKey(
    Schema.Struct({ ...timing, from: optionalNumber, to: optionalNumber }),
  ),
  marks: Schema.optionalKey(
    Schema.Array(Schema.Struct({ ...timing, x: number, label: optionalText })),
  ),
});
export const accumulateSchema = Schema.Struct({
  rate,
  x: Schema.optionalKey(axis),
  box,
  steps: optionalNumber,
  rateLabel: optionalText,
  totalLabel: optionalText,
  fill: Schema.optionalKey(cue),
  stack: Schema.optionalKey(cue),
});
export const estimateSchema = Schema.Struct({
  value: optionalNumber,
  spread: optionalNumber,
  bias: optionalNumber,
  count: optionalNumber,
  seed: optionalNumber,
  box,
  label: optionalText,
  meanLabel: optionalText,
  trueLabel: optionalText,
  show: Schema.optionalKey(cue),
  gather: Schema.optionalKey(cue),
  band: Schema.optionalKey(Schema.Boolean),
});
export const fieldSchema = Schema.Struct({
  kind: Schema.String,
  box,
  arrows: Schema.optionalKey(Schema.Boolean),
  particles: optionalNumber,
  seed: optionalNumber,
  show: Schema.optionalKey(cue),
  flow: Schema.optionalKey(cue),
  labels: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        ...timing,
        text: Schema.String,
        pos: Schema.optionalKey(point),
      }),
    ),
  ),
});
export type FunctionSpec = typeof functionSchema.Type;
export type GraphSpec = typeof graphSchema.Type;
export type AccumulateSpec = typeof accumulateSchema.Type;
export type EstimateSpec = typeof estimateSchema.Type;
export type FieldSpec = typeof fieldSchema.Type;
export const decodeGraph = Schema.decodeUnknownSync(graphSchema);
export const decodeAccumulate = Schema.decodeUnknownSync(accumulateSchema);
export const decodeEstimate = Schema.decodeUnknownSync(estimateSchema);
export const decodeField = Schema.decodeUnknownSync(fieldSchema);
