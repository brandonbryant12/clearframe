import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { jarLayout } from './layout.mjs';
import { createCoin, drawCoinStack } from './coins.mjs';
import { drawCarryoverLabels } from './labels.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const { total = 8, keep = 3, each = 1, prefix = '', suffix = '' } = params;
  if (keep > total)
    throw new Error(
      `sketchParams.keep for expire must be no more than total (got keep ${keep}, total ${total})`,
    );
  const lost = total - keep;
  const amount = (n: number) =>
    `${prefix}${(n * each).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
  const {
    cx,
    t,
    rx,
    cry,
    bottom,
    jw,
    ry,
    L,
    top,
    R,
    coinY,
    base,
    T,
    short,
    label,
  } = jarLayout(h, w, total);
  const els: CanvasElement[] = [];
  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text: s,
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;
  // One coin: its side, its faces, a rim on top (after the match sketch).
  const coin = createCoin(cx, t, rx, cry);

  // The glass: its back, tinted; a shadow under it. On screen from the first frame: the film
  // opens on the jar, and only the coins arrive.
  els.push({
    type: 'ellipse',
    cx,
    cy: bottom + 6,
    rx: round(jw * 0.68),
    ry: round(ry * 1.5),
    fill: 'wash',
    opacity: 0.8,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  els.push({
    type: 'path',
    id: 'expire-jar',
    d: `M ${L} ${top} L ${L} ${bottom - 30} Q ${L} ${bottom} ${L + 30} ${bottom + 4} Q ${cx} ${round(bottom + ry * 1.2)} ${R - 30} ${bottom + 4} Q ${R} ${bottom} ${R} ${bottom - 30} L ${R} ${top}`,
    fill: 'surface',
    opacity: 0.85,
    stroke: 'line',
    width: 4,
    join: 'round',
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  els.push({
    type: 'ellipse',
    cx,
    cy: top,
    rx: jw / 2,
    ry,
    fill: 'bg',
    stroke: 'line',
    width: 4,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  // The carry-over level: the plane of the top face of the last coin kept, drawn as a ring
  // round the glass in the coins' own perspective.
  const lineY = keep > 0 ? coinY(keep - 1) : base + t;
  const ringRy = round(((jw / 2) * cry) / rx);
  const level = {
    stroke: 'ink',
    width: 4,
    dash: [16, 10],
    cap: 'round',
    fill: 'none',
    loop: { type: 'dash', period: 6 },
    cue: 'YEAREND',
    at: AT.YEAREND,
    after: 0,
  };
  // (Its far side shows faintly through the glass, behind the coins.)
  els.push({
    type: 'path',
    d: `M ${R} ${lineY} A ${jw / 2} ${ringRy} 0 0 0 ${L} ${lineY}`,
    opacity: 0.35,
    enter: 'fade',
    dur: 0.4,
    ...level,
  } satisfies CanvasElement);

  // What was lost: a dashed outline where those coins stood (behind the coins, so the top
  // coin kept covers its foot).
  if (lost > 0) {
    const yTop = coinY(total - 1) - cry;
    els.push({
      type: 'rect',
      x: cx - rx,
      y: yTop,
      w: 2 * rx,
      h: round(lineY - yTop),
      r: 26,
      fill: 'none',
      stroke: 'negative',
      width: 3,
      dash: [10, 9],
      opacity: 0.85,
      enter: 'fade',
      dur: 0.5,
      cue: 'YEAREND',
      at: round(AT.YEAREND + 1.1 + lost * 0.07),
      after: round(1.1 + lost * 0.07),
    } satisfies CanvasElement);
  }
  // This year's coins drop in, one per unit.
  drawCoinStack({ total, keep, els, coinY, top, cx, coin });
  // The front of the glass: a highlight down its left side.
  els.push({
    type: 'rect',
    x: L + 14,
    y: top + ry + 18,
    w: 12,
    h: bottom - top - ry - 70,
    r: 6,
    fill: 'bg',
    opacity: 0.45,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  els.push({
    type: 'path',
    d: `M ${L} ${top} A ${jw / 2} ${ry} 0 0 0 ${R} ${top}`,
    fill: 'none',
    stroke: 'line',
    width: 4,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  // The carry-over line, drawn across at year end and kept moving.
  const lx0 = T || short ? L - 24 : round(L - 150),
    lx1 = R + 24;
  els.push({
    type: 'path',
    d: `M ${lx0} ${lineY} L ${L} ${lineY} A ${jw / 2} ${ringRy} 0 0 0 ${R} ${lineY} L ${lx1} ${lineY}`,
    enter: 'draw',
    dur: 0.6,
    ...level,
  } satisfies CanvasElement);
  // The year-end tag: at the line's end in wide frames, above the rim in narrow ones.
  const tag =
    T || short
      ? { x: cx, y: top - ry - 64, anchor: 'middle' }
      : { x: lx0 - 20, y: lineY, anchor: 'end' };
  const tagW = 250,
    tagH = 64;
  const tagX = tag.anchor === 'end' ? tag.x - tagW : tag.x - tagW / 2;
  els.push({
    type: 'group',
    enter: 'pop',
    dur: 0.4,
    cue: 'YEAREND',
    at: AT.YEAREND,
    origin: [tagX + tagW / 2, tag.y],
    children: [
      {
        type: 'rect',
        x: tagX,
        y: round(tag.y - tagH / 2),
        w: tagW,
        h: tagH,
        r: tagH / 2,
        fill: 'ink',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'icon',
        name: 'calendar',
        x: tagX + 40,
        y: tag.y,
        size: 32,
        stroke: 'bg',
        enter: 'none',
      } satisfies CanvasElement,
      text('YEAREND', tagX + 70, round(tag.y + 11), 30, 'semibold', 'bg', {
        fit: tagW - 90,
        enter: 'none',
      }),
    ],
  } satisfies CanvasElement);

  // Brackets and amounts beside the jar: what goes (at year end) and what stays (on KEEP).
  drawCarryoverLabels({
    R,
    lost,
    coinY,
    total,
    cry,
    lineY,
    base,
    t,
    text,
    label,
    T,
    els,
    amount,
    keep,
  });
  return { elements: els };
}
