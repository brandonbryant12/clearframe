import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { body, round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { drawRemainingCapacity } from './capacity.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const {
    limit = 23500,
    used = 15000,
    prefix = '$',
    suffix = '',
    decimals = 0,
    tone = 'accent',
  } = params;
  if (used > limit)
    throw new Error(
      `sketchParams.used (${used}) is more than the limit (${limit}) for limit: the track is drawn to scale`,
    );
  const T = w < 1400;
  const b = body(w, h);
  const money = (v: number) =>
    `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const els: CanvasElement[] = [];
  const text = (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;
  // One pill from zero to the limit, labelled inside its own segments (the stacked-bar
  // convention): what is used inside the fill, what is left inside the room, the axis below.
  const x0 = round(b.x),
    x1 = round(b.x + b.w);
  const W = x1 - x0;
  const fillEnd = round(x0 + (W * used) / limit);
  const fillW = round(fillEnd - x0);
  const left = limit - used;
  // A phone reads these: the amounts at a figure's size, the labels well above the floor.
  const big = T ? 72 : 64,
    small = T ? 44 : 40;
  const trackH = T ? 196 : 160;
  const pad = round(trackH * 0.3);
  // Roughly how wide a label of this many characters is, to choose inside or beside.
  const span = (chars: number, size: number) => chars * size * 0.56;
  // Each segment holds its amount over its label when it is wide enough; otherwise the pair
  // stands beside the track: what is used below its start, what is left above its end.
  const usedInside =
    fillW >
    Math.max(span(Math.max(money(used).length, 4), big), span(12, small)) +
      pad * 2;
  const leftInside =
    W - fillW >
    Math.max(span(money(left).length + 1, big), span(14, small)) + pad * 2;
  const pair = big * 0.72 + small * 1.45;
  const titleY = round(b.y + (T ? 46 : 40));
  const ty = round(
    Math.max(
      b.y + b.h * (T ? 0.42 : 0.47) - trackH / 2,
      titleY + 24 + (left > 0 && !leftInside ? pair + 40 : 0),
    ),
  );
  // Inside a segment, the pair centred in the track's height.
  const row1 = round(ty + (trackH - pair) / 2 + big * 0.72),
    row2 = round(row1 + small * 1.25);
  const above = {
    label: round(ty - 24),
    amount: round(ty - 24 - small * 1.4),
  };
  const below = {
    amount: round(ty + trackH + 32 + big * 0.72),
    label: round(ty + trackH + 32 + big * 0.72 + small * 1.3),
  };

  els.push(
    text('WHAT', x0, titleY, T ? 50 : 52, 'strong', 'ink', {
      width: round(b.w),
      at: 0,
      enter: 'none',
    }),
  );
  // The track: the whole limit, drawn from zero, on screen from the first frame.
  els.push({
    type: 'rect',
    x: x0,
    y: ty,
    w: W,
    h: trackH,
    r: round(trackH / 2),
    fill: 'wash',
    at: 0,
    enter: 'none',
  } satisfies CanvasElement);
  if (usedInside)
    els.push(
      text(
        '0',
        x0,
        round(ty + trackH + 32 + small * 0.72),
        small,
        'figures',
        'muted',
        { at: 0, enter: 'none' },
      ),
    );

  // FILL: the used share grows from zero while its amount counts up. The amount and its label
  // ride the fill's end on the same curve, so neither is drawn ahead of the colour behind it.
  const grow = [
    { cue: 'FILL', at: AT.FILL, dur: 0, scaleX: 0 },
    { cue: 'FILL', at: AT.FILL, dur: 1.2, ease: 'out', scaleX: 1 },
  ];
  if (fillW > 0)
    els.push({
      type: 'rect',
      id: 'limit-used',
      x: x0,
      y: ty,
      w: fillW,
      h: trackH,
      r: round(Math.min(trackH / 2, fillW / 2)),
      fill: tone,
      enter: 'none',
      origin: [x0, ty + trackH / 2],
      cue: 'FILL',
      at: AT.FILL,
      keys: grow,
    } satisfies CanvasElement);
  const amount = (x: number, y: number, anchor: string, ink: string) =>
    text(null, x, y, big, 'bold', ink, {
      text: undefined,
      count: { from: 0, to: used, prefix, suffix, decimals, dur: 1.2 },
      anchor,
    });
  if (usedInside) {
    const x = round(fillEnd - pad);
    els.push({
      type: 'group',
      cue: 'FILL',
      at: round(AT.FILL + 0.2),
      enter: 'fade',
      dur: 0.3,
      keys: [
        { cue: 'FILL', at: AT.FILL, dur: 0, x: -fillW },
        { cue: 'FILL', at: AT.FILL, dur: 1.2, ease: 'out', x: 0 },
      ],
      children: [
        amount(x, row1, 'end', 'bg'),
        text('USED', x, row2, small, 'strong', 'bg', {
          anchor: 'end',
          opacity: 0.88,
        }),
      ],
    } satisfies CanvasElement);
  } else {
    // Too short to hold them: below its start, where the scale begins.
    els.push({
      ...amount(x0, below.amount, 'start', 'ink'),
      enter: 'fade',
      dur: 0.3,
      cue: 'FILL',
      at: round(AT.FILL + 0.15),
    });
    els.push(
      text('USED', x0, below.label, small, 'strong', 'muted', {
        enter: 'fade',
        cue: 'FILL',
        at: round(AT.FILL + 0.5),
        dur: 0.4,
      }),
    );
  }

  // LIMIT: a rule at the end of the track and the limit at the end of the axis.
  els.push({
    type: 'line',
    x1,
    y1: round(ty - 12),
    x2: x1,
    y2: round(ty + trackH + 12),
    stroke: 'ink',
    width: 4,
    cap: 'round',
    enter: 'draw',
    cue: 'LIMIT',
    at: AT.LIMIT,
    dur: 0.35,
  } satisfies CanvasElement);
  els.push(
    text(money(limit), x1, below.amount, big, 'bold', 'ink', {
      anchor: 'end',
      enter: 'rise',
      cue: 'LIMIT',
      at: round(AT.LIMIT + 0.1),
      dur: 0.45,
    }),
  );
  els.push(
    text('LIMITLABEL', x1, below.label, small, 'text', 'muted', {
      anchor: 'end',
      enter: 'fade',
      cue: 'LIMIT',
      at: round(AT.LIMIT + 0.3),
      dur: 0.4,
    }),
  );

  // LEFT: the room between the fill and the limit, outlined, with its amount inside it (or
  // just above its end when the room is too narrow to hold it).
  drawRemainingCapacity({
    left,
    x1,
    fillEnd,
    els,
    ty,
    trackH,
    leftInside,
    row1,
    row2,
    above,
    text,
    money,
    big,
    small,
  });
  return { elements: els };
}
