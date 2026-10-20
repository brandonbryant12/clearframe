import type { CanvasElement } from '../types.mjs';
import type { Storyboard, BlockProps } from '../../engine/domain.mjs';
import { ElementSchema } from '../../engine/schemas.mjs';
import * as Schema from 'effect/Schema';
import type { CastCarry, CastFrame, CastContext } from './contracts.mjs';
import { check } from './common.mjs';
import { castSpec } from './spec.mjs';
import { decodeCast } from './schema.mjs';
import { castElements } from './elements.mjs';
export function castOverlaps(
  sb: Pick<Storyboard, 'beats' | 'heading'>,
  { width = 1920, height = 1080 } = {},
) {
  const carry: CastCarry = {},
    notes: string[] = [];
  for (const b of sb.beats ?? []) {
    if (b.block !== 'canvas' || b.props?.cast == null) continue;
    try {
      expandCastProps(
        b.props,
        { width, height, beatId: b.id },
        {
          state: carry.state,
          objects: carry.objects,
          threads: carry.threads,
          look: carry.look,
          camera: carry.camera,
          unit: carry.unit,
          heading: b.heading ?? sb.heading,
          carry,
          notes,
        },
      );
    } catch {
      // An invalid cast is reported by check; nothing to measure here.
    }
  }
  return notes.filter((n) => /^[^:]+: overlap: /.test(n));
}

export function expandCastProps(
  input: BlockProps,
  frame: CastFrame,
  ctx: CastContext = {},
): BlockProps {
  if (input?.cast == null) return input;
  const { cast, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'bridge',
    'stat',
    'distribution',
    'multiples',
    'kpi',
    'teaching',
    'chart',
    'sketch',
    'view',
    'viewFrom',
    'world',
  ] as const)
    check(
      rest[key] == null,
      `cannot combine cast with ${key} (a cast lays itself out for the frame)`,
    );
  // `fresh: true` starts a new cast here: nothing carried in from earlier cast beats stays on screen.
  if (decodeCast(cast).fresh)
    ctx = {
      ...ctx,
      objects: undefined,
      look: undefined,
      state: undefined,
      threads: undefined,
      camera: undefined,
    };
  const spec = castSpec(cast, ctx.objects ?? new Map(), ctx.look ?? null);
  frame = layoutFrame(rest, frame, ctx);
  const { elements, state, threads, notes, camera, edges, unit } = castElements(
    spec,
    frame,
    {
      state: ctx.state,
      threads: ctx.threads,
      camera: ctx.camera,
      unit: ctx.unit,
      cue: ctx.cue,
    },
  );
  for (const n of notes) ctx.notes?.push(`${frame.beatId ?? 'cast'}: ${n}`);
  if (frame.beatId) {
    const prefix = (el: CanvasElement): void => {
      el.id = `${frame.beatId}-${el.id}`;
      for (const c of el.children ?? []) prefix(c);
    };
    elements.forEach(prefix);
  }
  if (ctx.carry)
    Object.assign(ctx.carry, {
      state,
      objects: spec.objects,
      threads,
      look: spec.look,
      camera,
      unit,
      ...(edges.fill || edges.emerge
        ? { edges: { ...ctx.carry.edges, [frame.beatId ?? 'cast']: edges } }
        : {}),
    });
  // Elements the author adds are scenery for the cast (a panel, a label beside it): drawn beneath it.
  return {
    ...rest,
    view: [0, 0, frame.width, frame.height],
    elements: [
      ...(rest.elements ?? []),
      ...elements.map((element) =>
        Schema.decodeUnknownSync(ElementSchema)(element),
      ),
    ],
  };
}

function layoutFrame(
  props: BlockProps,
  frame: CastFrame,
  ctx: CastContext,
): CastFrame {
  // A heading takes the top of the frame (as on stages); the cast keeps below it.
  if (props.title || props.kicker)
    frame = {
      ...frame,
      ...(ctx.heading === 'bottom'
        ? {
            bottom:
              frame.height -
              (frame.height > frame.width ? 430 : frame.height * 0.34),
          }
        : { top: frame.height > frame.width ? 430 : 300 }),
    };
  // Captions take the bottom of the frame (the band the frame audit keeps type out of, with a margin).
  if (ctx.captions)
    frame = {
      ...frame,
      bottom: Math.min(frame.bottom ?? frame.height, frame.height * 0.75),
    };
  return frame;
}
