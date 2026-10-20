import * as Schema from 'effect/Schema';
import type { BlockProps } from '../contracts/props.mjs';
import { BarDatumSchema } from './bar-datum.mjs';
import { BreathPhaseSchema } from './breath-phase.mjs';
import {
  CanvasElementSchema,
  DepthKeySchema,
} from '../canvas-schema-canvas.mjs';
import { ChartFormatSchema } from './chart-format.mjs';
import { CompareSideSchema } from './compare-side.mjs';
import { CueSchema } from './cue.mjs';
import { DeltaEndSchema } from './delta-end.mjs';
import { FlowNodeSchema } from './flow-node.mjs';
import { JsonRecordSchema } from './json-record.mjs';
import { MatrixRowSchema } from './matrix-row.mjs';
import { MosaicSpecSchema } from '../canvas-schema-effects-1.mjs';
import { PhraseSchema } from './phrase.mjs';
import { PinSchema } from './pin.mjs';
import { PrintSpecSchema } from '../canvas-schema-effects-4.mjs';
import { PropsFocusSchema } from './props-focus.mjs';
import { PropsItemSchema } from './props-item.mjs';
import { RevealSpecSchema } from './reveal-spec.mjs';
import { RoughSpecSchema } from '../canvas-schema-effects-2.mjs';
import { SegmentSchema } from './segment.mjs';
import { SeriesPointSchema } from './series-point.mjs';
import { TargetInputSchema } from './target-input.mjs';
import { ViewNextSchema } from './view-next.mjs';
import { ViewValueSchema } from './view-value.mjs';

export const BlockPropsSchema: Schema.Codec<BlockProps> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      title: Schema.optional(Schema.String),
      kicker: Schema.optional(Schema.String),
      source: Schema.optional(Schema.String),
      land: Schema.optional(CueSchema),
      support: Schema.optional(Schema.String),
      text: Schema.optional(Schema.String),
      label: Schema.optional(Schema.String),
      context: Schema.optional(Schema.String),
      caption: Schema.optional(Schema.String),
      author: Schema.optional(Schema.String),
      role: Schema.optional(Schema.String),
      verdict: Schema.optional(Schema.String),
      expression: Schema.optional(Schema.String),
      result: Schema.optional(Schema.String),
      explanation: Schema.optional(Schema.String),
      action: Schema.optional(Schema.String),
      number: Schema.optional(Schema.String),
      center: Schema.optional(Schema.String),
      align: Schema.optional(Schema.String),
      emphasis: Schema.optional(
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ),
      emphasisStyle: Schema.optional(Schema.String),
      decimals: Schema.optional(Schema.Finite),
      prefix: Schema.optional(Schema.String),
      suffix: Schema.optional(Schema.String),
      value: Schema.optional(Schema.Finite),
      from: Schema.optional(Schema.Union([Schema.Finite, DeltaEndSchema])),
      to: Schema.optional(DeltaEndSchema),
      change: Schema.optional(Schema.String),
      better: Schema.optional(Schema.String),
      max: Schema.optional(Schema.Finite),
      min: Schema.optional(Schema.Finite),
      total: Schema.optional(Schema.Finite),
      cols: Schema.optional(Schema.Finite),
      icon: Schema.optional(Schema.String),
      items: Schema.optional(
        Schema.Array(Schema.Union([Schema.String, PropsItemSchema])).pipe(
          Schema.mutable,
        ),
      ),
      data: Schema.optional(Schema.Array(BarDatumSchema).pipe(Schema.mutable)),
      format: Schema.optional(Schema.Union([Schema.String, ChartFormatSchema])),
      orientation: Schema.optional(Schema.String),
      sort: Schema.optional(Schema.String),
      growSay: Schema.optional(CueSchema),
      drawSay: Schema.optional(CueSchema),
      focus: Schema.optional(PropsFocusSchema),
      series: Schema.optional(
        Schema.Array(Schema.Union([Schema.Finite, SeriesPointSchema])).pipe(
          Schema.mutable,
        ),
      ),
      labels: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
      rates: Schema.optional(Schema.Boolean),
      columns: Schema.optional(
        Schema.Array(Schema.String).pipe(Schema.mutable),
      ),
      rows: Schema.optional(Schema.Array(MatrixRowSchema).pipe(Schema.mutable)),
      highlight: Schema.optional(Schema.Finite),
      left: Schema.optional(CompareSideSchema),
      right: Schema.optional(CompareSideSchema),
      phrases: Schema.optional(
        Schema.Array(Schema.Union([Schema.String, PhraseSchema])).pipe(
          Schema.mutable,
        ),
      ),
      segments: Schema.optional(
        Schema.Array(SegmentSchema).pipe(Schema.mutable),
      ),
      mode: Schema.optional(Schema.String),
      maxWords: Schema.optional(Schema.Finite),
      maxGap: Schema.optional(Schema.Finite),
      maxDuration: Schema.optional(Schema.Finite),
      upper: Schema.optional(Schema.Boolean),
      nodes: Schema.optional(Schema.Array(FlowNodeSchema).pipe(Schema.mutable)),
      stagger: Schema.optional(Schema.Finite),
      period: Schema.optional(Schema.Finite),
      clockwise: Schema.optional(Schema.Boolean),
      phases: Schema.optional(
        Schema.Array(BreathPhaseSchema).pipe(Schema.mutable),
      ),
      minScale: Schema.optional(Schema.Finite),
      maxScale: Schema.optional(Schema.Finite),
      ring: Schema.optional(Schema.Boolean),
      asset: Schema.optional(Schema.String),
      file: Schema.optional(Schema.String),
      offset: Schema.optional(Schema.Finite),
      fit: Schema.optional(Schema.String),
      drift: Schema.optional(Schema.Boolean),
      pins: Schema.optional(Schema.Array(PinSchema).pipe(Schema.mutable)),
      actors: Schema.optional(
        Schema.Array(Schema.Unknown).pipe(Schema.mutable),
      ),
      links: Schema.optional(Schema.Array(Schema.Unknown).pipe(Schema.mutable)),
      events: Schema.optional(
        Schema.Array(Schema.Unknown).pipe(Schema.mutable),
      ),
      under: Schema.optional(Schema.Array(Schema.Unknown).pipe(Schema.mutable)),
      over: Schema.optional(Schema.Array(Schema.Unknown).pipe(Schema.mutable)),
      code: Schema.optional(JsonRecordSchema),
      ground: Schema.optional(JsonRecordSchema),
      camera: Schema.optional(JsonRecordSchema),
      motion: Schema.optional(JsonRecordSchema),
      shutter: Schema.optional(Schema.Finite),
      samples: Schema.optional(Schema.Finite),
      z: Schema.optional(Schema.String),
      elements: Schema.optional(
        Schema.Array(CanvasElementSchema).pipe(Schema.mutable),
      ),
      view: Schema.optional(ViewValueSchema),
      viewFrom: Schema.optional(
        Schema.Union([
          Schema.Array(Schema.Finite).pipe(Schema.mutable),
          TargetInputSchema,
        ]),
      ),
      viewTall: Schema.optional(
        Schema.Union([
          Schema.Array(Schema.Finite).pipe(Schema.mutable),
          TargetInputSchema,
        ]),
      ),
      viewAt: Schema.optional(Schema.Finite),
      viewDur: Schema.optional(Schema.Finite),
      viewDrift: Schema.optional(Schema.Finite),
      viewNext: Schema.optional(ViewNextSchema),
      world: Schema.optional(Schema.String),
      reveal: Schema.optional(RevealSpecSchema),
      rough: Schema.optional(Schema.Union([RoughSpecSchema, Schema.Boolean])),
      mosaic: Schema.optional(Schema.Union([MosaicSpecSchema, Schema.Boolean])),
      print: Schema.optional(
        Schema.Union([PrintSpecSchema, Schema.Literal(false)]),
      ),
      dolly: Schema.optional(Schema.Array(DepthKeySchema).pipe(Schema.mutable)),
      sketch: Schema.optional(Schema.String),
      sketchText: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      sketchSay: Schema.optional(Schema.Record(Schema.String, Schema.String)),
      sketchParams: Schema.optional(JsonRecordSchema),
      seed: Schema.optional(Schema.Finite),
      place: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
      plates: Schema.optional(Schema.String),
      moments: Schema.optional(Schema.Unknown),
      sourceElement: Schema.optional(Schema.String),
      sourceSize: Schema.optional(Schema.Finite),
      chart: Schema.optional(Schema.Unknown),
      diagram: Schema.optional(Schema.Unknown),
      graph: Schema.optional(Schema.Unknown),
      accumulate: Schema.optional(Schema.Unknown),
      estimate: Schema.optional(Schema.Unknown),
      field: Schema.optional(Schema.Unknown),
      plot: Schema.optional(Schema.Unknown),
      bars: Schema.optional(Schema.Unknown),
      bridge: Schema.optional(Schema.Unknown),
      breakdown: Schema.optional(Schema.Unknown),
      process: Schema.optional(Schema.Unknown),
      decision: Schema.optional(Schema.Unknown),
      table: Schema.optional(Schema.Unknown),
      cast: Schema.optional(Schema.Unknown),
      multiples: Schema.optional(Schema.Unknown),
      distribution: Schema.optional(Schema.Unknown),
      stat: Schema.optional(Schema.Unknown),
      teaching: Schema.optional(Schema.Unknown),
      kpi: Schema.optional(Schema.Unknown),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
