import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';

export function createCoin(cx: number, t: number, rx: number, cry: number) {
  return (y: number, fill: string) => [
    {
      type: 'ellipse',
      cx,
      cy: y + t,
      rx,
      ry: cry,
      fill,
      enter: 'none',
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: cx - rx,
      y,
      w: 2 * rx,
      h: t,
      fill,
      enter: 'none',
    } satisfies CanvasElement,
    // The side in shade: the coin's colour multiplied by itself, darker on light and dark palettes alike.
    {
      type: 'ellipse',
      cx,
      cy: y + t,
      rx,
      ry: cry,
      fill,
      blend: 'multiply',
      opacity: 0.6,
      enter: 'none',
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: cx - rx,
      y,
      w: 2 * rx,
      h: t,
      fill,
      blend: 'multiply',
      opacity: 0.6,
      enter: 'none',
    } satisfies CanvasElement,
    {
      type: 'ellipse',
      cx,
      cy: y,
      rx,
      ry: cry,
      fill,
      stroke: 'bg',
      width: 2,
      enter: 'none',
    } satisfies CanvasElement,
    {
      type: 'ellipse',
      cx,
      cy: y,
      rx: round(rx * 0.68),
      ry: round(cry * 0.68),
      fill: 'none',
      stroke: 'bg',
      width: 3,
      opacity: 0.5,
      enter: 'none',
    } satisfies CanvasElement,
  ];
}

export function drawCoinStack({
  total,
  keep,
  els,
  coinY,
  top,
  cx,
  coin,
}: DrawCoinStackContext) {
  for (let i = 0; i < total; i++) {
    const fall = i >= keep;
    const k = total - 1 - i; // lost coins leave from the top down
    const at = round(AT.FILL + i * 0.12);
    els.push({
      type: 'group',
      enter: 'drop',
      dist: round(Math.min(320, coinY(i) - top + 140)),
      dur: 0.42,
      cue: 'FILL',
      at,
      after: round(i * 0.12),
      origin: [cx, coinY(i)],
      keys: fall
        ? [
            {
              cue: 'YEAREND',
              at: round(AT.YEAREND + 0.55 + k * 0.07),
              after: round(0.55 + k * 0.07),
              dur: 0.7,
              ease: 'in',
              y: -150,
              opacity: 0,
              scale: 0.92,
            },
          ]
        : // The coins you keep give a small hop, bottom to top, when they are named.
          [
            {
              cue: 'KEEP',
              at: round(AT.KEEP + 0.1 + i * 0.06),
              after: round(0.1 + i * 0.06),
              dur: 0.45,
              ease: 'thereAndBack',
              y: -12,
            },
          ],
      children: [
        ...coin(coinY(i), 'accent'),
        // Coins over the line turn before they go.
        ...(fall
          ? [
              {
                type: 'group',
                enter: 'fade',
                dur: 0.25,
                cue: 'YEAREND',
                at: round(AT.YEAREND + 0.3 + k * 0.03),
                after: round(0.3 + k * 0.03),
                children: coin(coinY(i), 'negative'),
              } satisfies CanvasElement,
            ]
          : []),
      ],
    } satisfies CanvasElement);
  }
}

export interface DrawCoinStackContext {
  total: number;
  keep: number;
  els: CanvasElement[];
  coinY: (i: number) => number;
  top: number;
  cx: number;
  coin: (y: number, fill: string) => CanvasElement[];
}
