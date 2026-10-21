import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { tall, round } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {};
}

// A dark storeroom searched by one light: shelves of silhouetted boxes, and a torch beam that
// finds three things in turn (a crate, a stack of files, a machine with a blinking light). Each
// is labelled as it is found, and the labels stay. Then the lamps come on, the whole room shows,
// and a thread joins the three finds: they were one story. The light's moves are named cues
// (FIRST, SECOND, THIRD, ALL), so a beat's sketchSay lands each on a spoken word.
export const AT = {
  SEARCH: 0.3,
  FIRST: 2.0,
  SECOND: 3.5,
  THIRD: 5.0,
  ALL: 6.6,
};

export function layout(w: number, h: number) {
  if (tall(w, h)) {
    const boards = [380, 620, 860, 1100, 1340, 1560].map((y) =>
      round((y * h) / 1920),
    );
    return {
      floor: boards[boards.length - 1],
      units: [80, 560].map((x) => ({
        x: round((x * w) / 1080),
        w: round((440 * w) / 1080),
        boards,
      })),
      finds: [
        { unit: 0, board: 1, cx: round((300 * w) / 1080) },
        { unit: 1, board: 3, cx: round((780 * w) / 1080) },
        { unit: 0, board: 4, cx: round((300 * w) / 1080) },
      ],
      lamps: [300, 780].map((x) => round((x * w) / 1080)),
      start: [round(w * 0.72), round(h * 0.9)],
    };
  }
  const boards = [180, 340, 510, 680, 880].map((y) => round((y * h) / 1080));
  return {
    floor: boards[boards.length - 1],
    units: [150, 740, 1330].map((x) => ({
      x: round((x * w) / 1920),
      w: round((440 * w) / 1920),
      boards,
    })),
    finds: [
      { unit: 0, board: 2, cx: round((370 * w) / 1920) },
      { unit: 1, board: 3, cx: round((960 * w) / 1920) },
      { unit: 2, board: 1, cx: round((1550 * w) / 1920) },
    ],
    lamps: [370, 960, 1550].map((x) => round((x * w) / 1920)),
    start: [round(w * 0.5), round(h * 0.93)],
  };
}

// The three finds, drawn standing on a board at y = b, centred on cx.
export const FINDS = [
  (cx: number, b: number) => [
    {
      type: 'rect',
      x: cx - 95,
      y: b - 124,
      w: 190,
      h: 124,
      r: 6,
      fill: 'accent',
      stroke: 'ink',
      width: 4,
    } satisfies CanvasElement,
    {
      type: 'line',
      x1: cx - 88,
      y1: b - 84,
      x2: cx + 88,
      y2: b - 84,
      stroke: 'bg',
      width: 7,
    } satisfies CanvasElement,
    {
      type: 'line',
      x1: cx - 88,
      y1: b - 44,
      x2: cx + 88,
      y2: b - 44,
      stroke: 'bg',
      width: 7,
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: cx + 36,
      y: b - 112,
      w: 46,
      h: 26,
      r: 4,
      fill: 'accent2',
    } satisfies CanvasElement,
  ],
  (cx: number, b: number) => [
    ...[0, 1, 2, 3].map(
      (i): CanvasElement =>
        ({
          type: 'rect',
          x: cx - 88 + (i % 2 ? 10 : -4),
          y: b - 30 - i * 30,
          w: 176,
          h: 28,
          r: 4,
          fill: i === 3 ? 'accent2' : 'surface',
          stroke: 'ink',
          width: 3,
        }) satisfies CanvasElement,
    ),
    {
      type: 'rect',
      x: cx - 70,
      y: b - 136,
      w: 54,
      h: 16,
      r: 3,
      fill: 'accent2',
      stroke: 'ink',
      width: 3,
    } satisfies CanvasElement,
  ],
  (cx: number, b: number) => [
    {
      type: 'rect',
      x: cx - 90,
      y: b - 140,
      w: 180,
      h: 140,
      r: 12,
      fill: 'muted',
      stroke: 'ink',
      width: 4,
    } satisfies CanvasElement,
    {
      type: 'circle',
      cx: cx - 26,
      cy: b - 72,
      r: 34,
      fill: 'bg',
      stroke: 'ink',
      width: 4,
    } satisfies CanvasElement,
    {
      type: 'line',
      x1: cx - 26,
      y1: b - 72,
      x2: cx - 6,
      y2: b - 96,
      stroke: 'accent2',
      width: 5,
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: cx + 30,
      y: b - 110,
      w: 40,
      h: 14,
      r: 3,
      fill: 'bg',
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: cx + 30,
      y: b - 84,
      w: 40,
      h: 14,
      r: 3,
      fill: 'bg',
    } satisfies CanvasElement,
    {
      type: 'circle',
      cx: cx + 50,
      cy: b - 40,
      r: 10,
      fill: 'positive',
      glow: true,
      loop: { type: 'blink', period: 0.9 },
    } satisfies CanvasElement,
  ],
];

export const LABELS = ['FIRST', 'SECOND', 'THIRD'] as const;
