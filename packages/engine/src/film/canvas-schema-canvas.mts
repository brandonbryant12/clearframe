import * as Schema from 'effect/Schema';
import type { DepthKey, CanvasElement } from './types.mjs';
import {
  ElementTypeSchema,
  ElementKeySchema,
  LoopSpecSchema,
  AlongSpecSchema,
} from './canvas-schema-effects-5.mjs';
import {
  PaintSchema,
  PointSchema,
  RoughSpecSchema,
  PointerStepSchema,
} from './canvas-schema-effects-2.mjs';

import {
  SoundRefSchema,
  MosaicSpecSchema,
  ShineSpecSchema,
} from './canvas-schema-effects-1.mjs';

import {
  EchoSpecSchema,
  MorphFromSchema,
  MorphSchema,
  PrintSpecSchema,
  ShadowSpecSchema,
  MaterialSpecSchema,
} from './canvas-schema-effects-4.mjs';

import {
  CountSpecSchema,
  ElementMarkSchema,
  DocumentSectionSchema,
  ScrollMoveSchema,
  ShadeSpecSchema,
} from './canvas-schema-effects-3.mjs';

export const DepthKeySchema: Schema.Codec<DepthKey> = Schema.suspend(() =>
  Schema.StructWithRest(
    Schema.Struct({
      at: Schema.optional(Schema.Finite),
      say: Schema.optional(Schema.String),
      z: Schema.optional(Schema.Finite),
      dur: Schema.optional(Schema.Finite),
      ease: Schema.optional(Schema.String),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
);
export const CanvasElementSchema: Schema.Codec<CanvasElement> = Schema.suspend(
  () =>
    Schema.StructWithRest(
      Schema.Struct({
        at: Schema.optional(Schema.Finite),
        say: Schema.optional(Schema.String),
        cue: Schema.optional(Schema.String),
        after: Schema.optional(Schema.Finite),
        dur: Schema.optional(Schema.Finite),
        type: ElementTypeSchema,
        id: Schema.optional(Schema.String),
        note: Schema.optional(Schema.Union([Schema.String, Schema.Boolean])),
        fill: Schema.optional(PaintSchema),
        stroke: Schema.optional(PaintSchema),
        width: Schema.optional(Schema.Finite),
        opacity: Schema.optional(Schema.Finite),
        dash: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
        cap: Schema.optional(Schema.String),
        join: Schema.optional(Schema.String),
        rotate: Schema.optional(Schema.Finite),
        scale: Schema.optional(Schema.Finite),
        origin: Schema.optional(PointSchema),
        blend: Schema.optional(Schema.String),
        enter: Schema.optional(Schema.String),
        drawEase: Schema.optional(Schema.String),
        dist: Schema.optional(Schema.Finite),
        exit: Schema.optional(Schema.String),
        exitAt: Schema.optional(Schema.Finite),
        exitSay: Schema.optional(Schema.String),
        exitAfter: Schema.optional(Schema.Finite),
        exitCue: Schema.optional(Schema.String),
        exitDur: Schema.optional(Schema.Finite),
        sound: Schema.optional(
          Schema.Union([SoundRefSchema, Schema.Literal(false)]),
        ),
        keys: Schema.optional(
          Schema.Array(ElementKeySchema).pipe(Schema.mutable),
        ),
        loop: Schema.optional(LoopSpecSchema),
        along: Schema.optional(AlongSpecSchema),
        echo: Schema.optional(EchoSpecSchema),
        fps: Schema.optional(Schema.Finite),
        morphDur: Schema.optional(Schema.Finite),
        morphFrom: Schema.optional(MorphFromSchema),
        morph: Schema.optional(MorphSchema),
        rough: Schema.optional(
          Schema.Union([RoughSpecSchema, Schema.Boolean, Schema.Null]),
        ),
        mosaic: Schema.optional(
          Schema.Union([MosaicSpecSchema, Schema.Boolean]),
        ),
        print: Schema.optional(
          Schema.Union([PrintSpecSchema, Schema.Literal(false)]),
        ),
        behind: Schema.optional(Schema.Boolean),
        subject: Schema.optional(Schema.Boolean),
        depth: Schema.optional(Schema.Finite),
        z: Schema.optional(Schema.Finite),
        blur: Schema.optional(Schema.Finite),
        shine: Schema.optional(
          Schema.Union([ShineSpecSchema, Schema.Literal(true)]),
        ),
        shadow: Schema.optional(
          Schema.Union([Schema.Boolean, ShadowSpecSchema]),
        ),
        glow: Schema.optional(Schema.Union([Schema.Boolean, ShadowSpecSchema])),
        tilt: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
        material: Schema.optional(MaterialSpecSchema),
        unfinished: Schema.optional(
          Schema.Union([Schema.Boolean, Schema.String]),
        ),
        x: Schema.optional(Schema.Finite),
        y: Schema.optional(Schema.Finite),
        w: Schema.optional(Schema.Finite),
        h: Schema.optional(Schema.Finite),
        r: Schema.optional(Schema.Finite),
        cx: Schema.optional(Schema.Finite),
        cy: Schema.optional(Schema.Finite),
        rx: Schema.optional(Schema.Finite),
        ry: Schema.optional(Schema.Finite),
        x1: Schema.optional(Schema.Finite),
        y1: Schema.optional(Schema.Finite),
        x2: Schema.optional(Schema.Finite),
        y2: Schema.optional(Schema.Finite),
        arrow: Schema.optional(Schema.String),
        head: Schema.optional(Schema.Finite),
        d: Schema.optional(Schema.String),
        points: Schema.optional(
          Schema.Array(Schema.Array(Schema.Finite).pipe(Schema.mutable)).pipe(
            Schema.mutable,
          ),
        ),
        closed: Schema.optional(Schema.Boolean),
        text: Schema.optional(Schema.String),
        size: Schema.optional(Schema.Finite),
        font: Schema.optional(Schema.String),
        anchor: Schema.optional(Schema.String),
        height: Schema.optional(Schema.Finite),
        leading: Schema.optional(Schema.Finite),
        tracking: Schema.optional(Schema.Finite),
        upper: Schema.optional(Schema.Boolean),
        count: Schema.optional(Schema.Union([CountSpecSchema, Schema.Finite])),
        fit: Schema.optional(Schema.Union([Schema.Finite, Schema.String])),
        marks: Schema.optional(
          Schema.Array(ElementMarkSchema).pipe(Schema.mutable),
        ),
        balance: Schema.optional(Schema.Boolean),
        name: Schema.optional(Schema.String),
        title: Schema.optional(Schema.String),
        kicker: Schema.optional(Schema.String),
        sections: Schema.optional(
          Schema.Array(DocumentSectionSchema).pipe(Schema.mutable),
        ),
        scroll: Schema.optional(
          Schema.Array(ScrollMoveSchema).pipe(Schema.mutable),
        ),
        asset: Schema.optional(Schema.String),
        file: Schema.optional(Schema.String),
        treatment: Schema.optional(Schema.String),
        children: Schema.optional(
          Schema.Array(CanvasElementSchema).pipe(Schema.mutable),
        ),
        stagger: Schema.optional(Schema.Finite),
        bars: Schema.optional(Schema.Finite),
        style: Schema.optional(Schema.String),
        step: Schema.optional(Schema.Finite),
        gap: Schema.optional(Schema.Finite),
        radius: Schema.optional(Schema.Finite),
        dim: Schema.optional(Schema.Finite),
        kind: Schema.optional(Schema.String),
        seed: Schema.optional(Schema.Finite),
        speed: Schema.optional(Schema.Finite),
        ['shape']: Schema.optional(Schema.String),
        spin: Schema.optional(Schema.Array(Schema.Finite).pipe(Schema.mutable)),
        perspective: Schema.optional(Schema.Finite),
        nodes: Schema.optional(Schema.Unknown),
        arcs: Schema.optional(
          Schema.Array(Schema.Array(Schema.Finite).pipe(Schema.mutable)).pipe(
            Schema.mutable,
          ),
        ),
        shade: Schema.optional(Schema.Union([Schema.Boolean, ShadeSpecSchema])),
        to: Schema.optional(Schema.Union([Schema.String, PointSchema])),
        steps: Schema.optional(
          Schema.Array(PointerStepSchema).pipe(Schema.mutable),
        ),
        from: Schema.optional(PointSchema),
        point: Schema.optional(PointSchema),
        press: Schema.optional(Schema.Boolean),
        leave: Schema.optional(Schema.Boolean),
        of: Schema.optional(Schema.String),
        carried: Schema.optional(Schema.Boolean),
        shift: Schema.optional(Schema.Finite),
        depthRef: Schema.optional(PointSchema),
      }),
      [Schema.Record(Schema.String, Schema.Unknown)],
    ),
);
