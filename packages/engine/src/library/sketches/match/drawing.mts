import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';

export function matchDrawing({
  mid,
  base,
  t,
  gap,
  rx,
  ry,
  x1,
  x2,
  M,
  merge,
  yours,
  counts,
  fromYou,
  you,
  step,
  theirs,
  fromMatch,
  match,
  label,
  total,
  suffix,
  top,
  w,
  again,
  T,
}: MatchDrawingContext): SketchDrawing {
  return {
    elements: [
      // The floor the stacks stand on.
      {
        type: 'ellipse',
        cx: mid,
        cy: base + t + 10,
        rx: round(gap / 2 + rx * 1.6),
        ry: round(ry * 1.4),
        fill: 'wash',
        enter: 'fade',
        at: 0,
        dur: 0.5,
      } satisfies CanvasElement,
      // Two empty places from the first frame: the picture is set before a coin falls.
      ...[x1, x2].map(
        (x, i): CanvasElement =>
          ({
            type: 'ellipse',
            cx: x,
            cy: base,
            rx,
            ry,
            fill: 'none',
            stroke: 'line',
            width: 3,
            dash: [10, 8],
            enter: 'fade',
            at: 0.1 + i * 0.2,
            dur: 0.4,
            exit: 'fade',
            exitCue: 'TOTAL',
            exitAt: M.TOTAL,
            exitDur: 0.25,
          }) satisfies CanvasElement,
      ),
      // Your stack and its count; it moves to the middle when the two merge.
      {
        type: 'group',
        id: 'match-yours',
        enter: 'none',
        at: 0,
        keys: [{ ...merge, x: mid - x1 }],
        children: [...yours, ...counts(x1, fromYou, you, '', 'accent', 'YOU')],
      } satisfies CanvasElement,
      // The company's stack lands on top of yours (an `into` can go through it: match-theirs).
      {
        type: 'group',
        id: 'match-theirs',
        enter: 'none',
        at: 0,
        keys: [{ ...merge, x: mid - x2, y: -you * step }],
        children: [
          ...theirs,
          ...counts(x2, fromMatch, match, '+', 'accent2', 'MATCH'),
        ],
      } satisfies CanvasElement,
      // Names under the stacks, gone once there is one stack.
      ...(
        [
          [x1, 'YOU', 0.15],
          [x2, 'EMPLOYER', 0.35],
        ] satisfies [number, string, number][]
      ).map(([x, text, at]) =>
        label(text, x, base + t + 90, 40, 'semibold', 'ink', {
          fit: gap - 40,
          enter: 'fade',
          at,
          exit: 'fade',
          exitCue: 'TOTAL',
          exitAt: M.TOTAL,
          exitDur: 0.25,
        }),
      ),
      // The total over the merged stack, and what it is.
      label(`${total}${suffix}`, mid, top(total), 96, 'bold', 'ink', {
        enter: 'pop',
        cue: 'TOTAL',
        at: M.TOTAL + 1.0,
        after: 1.0,
        dur: 0.4,
      }),
      label('TOTAL', mid, base + t + 90, 40, 'semibold', 'ink', {
        fit: w - 240,
        enter: 'rise',
        cue: 'TOTAL',
        at: M.TOTAL + 1.2,
        after: 1.2,
        ...(again
          ? { exit: 'fade', exitCue: 'AGAIN', exitAt: M.AGAIN, exitDur: 0.25 }
          : {}),
      }),
      label('EACH', mid, base + t + 150, 28, 'regular', 'muted', {
        fit: w - 240,
        enter: 'fade',
        at: M.YOU + 0.6,
      }),
      // Every paycheck: smaller copies of the total line up beside it, one after another, and
      // the line under the stacks says so (AGAIN).
      ...Array.from({ length: again }, (_, k): CanvasElement => {
        const k1 = k + 1,
          sc = 0.5,
          srx = round(rx * sc),
          sry = round(ry * sc),
          st = round(t * sc),
          sstep = round(step * sc),
          sx = round(
            mid + (T ? 0 : rx + 70) + k1 * (srx * 2 + 34) * (T ? 0 : 1),
          ),
          // Tall frames have room above the total, not below its labels.
          sy = T ? round(top(total) - 150) : base + round(t - st),
          ox = T
            ? round(
                mid - ((again - 1) * (srx * 2 + 30)) / 2 + k * (srx * 2 + 30),
              )
            : sx;
        const coins = Array.from({ length: total }, (_, i) => {
          const y = round(sy - i * sstep),
            fill = i < you ? 'accent' : 'accent2';
          return [
            {
              type: 'rect',
              x: ox - srx,
              y,
              w: 2 * srx,
              h: st,
              fill,
              enter: 'none',
            } satisfies CanvasElement,
            {
              type: 'ellipse',
              cx: ox,
              cy: y + st,
              rx: srx,
              ry: sry,
              fill,
              enter: 'none',
            } satisfies CanvasElement,
            {
              type: 'ellipse',
              cx: ox,
              cy: y,
              rx: srx,
              ry: sry,
              fill,
              stroke: 'bg',
              width: 1.5,
              enter: 'none',
            } satisfies CanvasElement,
          ];
        }).flat();
        return {
          type: 'group',
          enter: 'drop',
          dist: 160,
          cue: 'AGAIN',
          at: round(M.AGAIN + k * 0.28),
          after: round(k * 0.28),
          dur: 0.45,
          opacity: round(1 - k * 0.12),
          children: coins,
        } satisfies CanvasElement;
      }),
      ...(again
        ? [
            label('AGAIN', mid, base + t + 90, 40, 'semibold', 'ink', {
              fit: w - 240,
              enter: 'rise',
              cue: 'AGAIN',
              at: M.AGAIN + 0.4,
              after: 0.4,
            }),
          ]
        : []),
    ],
  };
}

export interface MatchDrawingContext {
  mid: number;
  base: number;
  t: number;
  gap: number;
  rx: number;
  ry: number;
  x1: number;
  x2: number;
  M: {
    NOWYOU: number;
    NOWMATCH: number;
    YOU: number;
    MATCH: number;
    TOTAL: number;
    AGAIN: number;
  };
  merge: { cue: string; at: number; dur: number; ease: string };
  yours: CanvasElement[];
  counts: (
    x: number,
    from: number,
    to: number,
    prefix: string,
    fill: string,
    cue: 'YOU' | 'MATCH',
  ) => CanvasElement[];
  fromYou: number;
  you: number;
  step: number;
  theirs: CanvasElement[];
  fromMatch: number;
  match: number;
  label: (
    text: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  total: number;
  suffix: string;
  top: (n: number) => number;
  w: number;
  again: number;
  T: boolean;
}
