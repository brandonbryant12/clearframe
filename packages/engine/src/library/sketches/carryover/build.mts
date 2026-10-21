import type { TickTiming, BuildOptions } from './contracts.mjs';
import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { carryoverLayout } from './layout.mjs';
import { AT } from './timing.mjs';
import { drawElectionCards } from './cards.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {}, text: words = {} }: BuildOptions = {},
): SketchDrawing {
  const { count = 4, stays = [4], icons = [], bookend = false } = params;
  if (stays.some((n) => n > count))
    throw new Error(
      `sketchParams.stays for carryover names a card past count (${count})`,
    );
  if (stays.length >= count)
    throw new Error(
      'sketchParams.stays for carryover leaves nothing that carries over; at least one card must cross',
    );
  if (!Array.isArray(icons))
    throw new Error(
      'sketchParams.icons for carryover must be a list of icon names',
    );
  const T = h > w * 1.1;
  const els: CanvasElement[] = [];
  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
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
  const still = { at: 0, enter: 'none' };
  // Two columns either side of the line, inside the title-safe area and above the captions.
  const {
    mid,
    colW,
    left,
    right,
    across,
    top,
    head,
    gap,
    cardH,
    above,
    start,
    size,
    stackH,
    y0,
    chipW,
  } = carryoverLayout({ T, w, h, count, icons, words });
  els.push(text('BEFORE', left, top + head, head, 'strong', 'muted', still));
  els.push(text('AFTER', right, top + head, head, 'strong', 'accent', still));
  // Next year's slots, dashed until a card lands in one.
  for (let i = 0; i < count; i++)
    els.push({
      type: 'rect',
      x: right,
      y: y0 + i * (cardH + gap),
      w: colW,
      h: cardH,
      r: 20,
      fill: 'none',
      stroke: 'line',
      width: 2,
      dash: [10, 10],
      ...still,
    } satisfies CanvasElement);
  els.push({
    type: 'line',
    x1: mid,
    y1: top,
    x2: mid,
    y2: round(y0 + stackH + 24),
    stroke: 'line',
    width: 4,
    dash: [14, 12],
    cap: 'round',
    ...still,
  } satisfies CanvasElement);
  // A moment, `dt` seconds after its word (or after its default time when it has no word).
  const on = (c: keyof typeof AT, dt: number) => ({
    cue: c,
    at: round(AT[c] + dt),
    ...(dt ? { after: dt } : {}),
  });
  const tick = (y: number, when: TickTiming | null) => [
    {
      type: 'circle',
      cx: left + colW - 50,
      cy: round(y + cardH / 2),
      r: 24,
      fill: 'positive',
      ...(when ? { enter: 'pop', dur: 0.3, ...when(0.75) } : still),
    } satisfies CanvasElement,
    {
      type: 'path',
      d: `M ${left + colW - 61} ${round(y + cardH / 2)} L ${left + colW - 53} ${round(y + cardH / 2 + 9)} L ${left + colW - 38} ${round(y + cardH / 2 - 9)}`,
      fill: 'none',
      stroke: 'bg',
      width: 5,
      cap: 'round',
      join: 'round',
      ...(when ? { enter: 'draw', dur: 0.2, ...when(0.85) } : still),
    } satisfies CanvasElement,
  ];
  drawElectionCards({
    count,
    y0,
    cardH,
    gap,
    stays,
    icons,
    bookend,
    on,
    across,
    mid,
    left,
    colW,
    els,
    still,
    above,
    text,
    start,
    size,
    tick,
    right,
    chipW,
  });
  return { elements: els };
}
