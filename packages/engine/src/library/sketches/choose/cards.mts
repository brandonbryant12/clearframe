import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES, LABELS } from './model.mjs';

export function optionTitle(
  stacked: boolean,
  text: (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement,
  sides: string[],
  c: number,
  r: { x: number; y: number; w: number; h: number },
  pad: number,
  head: number,
  narrowCards: boolean,
  centre: [number, number],
): CanvasElement {
  if (stacked) {
    return text(
      sides[c] === 'a' ? 'AOPTION' : 'BOPTION',
      r.x + pad + 26,
      round(r.y + head / 2 + 16),
      46,
      'bold',
      'ink',
      { fit: r.w - 2 * pad - 26 },
    );
  }
  if (narrowCards) {
    return text(
      sides[c] === 'a' ? 'AOPTION' : 'BOPTION',
      centre[0],
      round(r.y + 56),
      36,
      'bold',
      'ink',
      {
        anchor: 'middle',
        width: r.w - 2 * pad + 16,
        height: 80,
        leading: 1.05,
      },
    );
  }
  return text(
    sides[c] === 'a' ? 'AOPTION' : 'BOPTION',
    centre[0],
    round(r.y + 82),
    50,
    'bold',
    'ink',
    { anchor: 'middle', fit: r.w - 2 * pad },
  );
}

export function createChoiceCard({
  cards,
  stacked,
  pick,
  sides,
  AT,
  text,
  head,
  narrowCards,
  colors,
  rows,
  rh,
  wins,
  rowY,
  mark,
}: CreateChoiceCardContext) {
  return (c: number): CanvasElement => {
    const r = cards[c];
    const pad = stacked ? 44 : 32;
    const chosen = pick === sides[c];
    const centre: [number, number] = [
      round(r.x + r.w / 2),
      round(r.y + r.h / 2),
    ];
    const markX = stacked ? r.x + pad + 28 : centre[0];
    return {
      type: 'group',
      enter: 'rise',
      at: round(0.2 + c * 0.15),
      dur: 0.6,
      dist: 40,
      origin: centre,
      keys:
        pick === 'none'
          ? []
          : [
              {
                cue: 'PICK',
                at: AT.PICK,
                dur: 0.8,
                ease: 'inOut',
                ...(chosen
                  ? { scale: 1.05, y: stacked ? 0 : -10 }
                  : { scale: 0.96, opacity: 0.45 }),
              },
            ],
      children: [
        {
          type: 'rect',
          ...r,
          r: 28,
          fill: 'surface',
          stroke: 'line',
          width: 2,
          enter: 'none',
          shadow: { blur: 40, dy: 20, opacity: 0.14 },
        } satisfies CanvasElement,
        // The header: the option's name over a short bar in its colour.
        optionTitle(stacked, text, sides, c, r, pad, head, narrowCards, centre),
        stacked
          ? ({
              type: 'rect',
              x: r.x + pad,
              y: round(r.y + head / 2 - 22),
              w: 8,
              h: 44,
              r: 4,
              fill: colors[c],
              enter: 'none',
            } satisfies CanvasElement)
          : ({
              type: 'rect',
              x: centre[0] - 32,
              y: r.y + (narrowCards ? 116 : 108),
              w: 64,
              h: 8,
              r: 4,
              fill: colors[c],
              enter: 'none',
            } satisfies CanvasElement),
        ...rows.map(
          (_, i): CanvasElement =>
            ({
              type: 'line',
              x1: r.x + pad,
              y1: round(r.y + head + rh * i),
              x2: r.x + r.w - pad,
              y2: round(r.y + head + rh * i),
              stroke: 'line',
              width: 2,
              enter: 'none',
            }) satisfies CanvasElement,
        ),
        // The winning row fills with the option's colour as it is said: a tick alone is too
        // small a change to see on a phone.
        ...rows.flatMap((row, i) =>
          wins(row, sides[c])
            ? [
                {
                  type: 'rect',
                  x: r.x + 10,
                  y: round(rowY(c, i) - rh / 2 + 6),
                  w: r.w - 20,
                  h: rh - 12,
                  r: 16,
                  fill: colors[c],
                  opacity: 0.26,
                  enter: 'wipe',
                  dur: 0.35,
                  cue: NAMES[i],
                  at: round(AT[NAMES[i]] + 0.05),
                  after: 0.05,
                } satisfies CanvasElement,
              ]
            : [],
        ),
        ...rows.map((_, i) => mark(c, i, markX, rowY(c, i))),
        // Stacked cards carry the row names themselves, quieter where the option loses.
        ...(stacked
          ? rows.map((row, i) =>
              text(
                LABELS[i],
                markX + 52,
                round(rowY(c, i) + 13),
                36,
                'semibold',
                wins(row, sides[c]) ? 'ink' : 'muted',
                {
                  fit: r.w - 2 * pad - 80,
                  enter: 'rise',
                  dist: 12,
                  dur: 0.4,
                  cue: NAMES[i],
                  at: AT[NAMES[i]],
                },
              ),
            )
          : []),
        // The choice: a ring in the option's colour and a badge on its corner.
        ...(chosen
          ? [
              {
                type: 'rect',
                ...r,
                r: 28,
                fill: 'none',
                stroke: colors[c],
                width: 5,
                enter: 'fade',
                dur: 0.4,
                cue: 'PICK',
                at: round(AT.PICK + 0.2),
                after: 0.2,
              } satisfies CanvasElement,
              {
                type: 'group',
                origin: [r.x + r.w - 14, r.y + 8],
                enter: 'pop',
                dur: 0.4,
                cue: 'PICK',
                at: round(AT.PICK + 0.45),
                after: 0.45,
                children: [
                  {
                    type: 'circle',
                    cx: r.x + r.w - 14,
                    cy: r.y + 8,
                    r: 34,
                    fill: colors[c],
                    stroke: 'bg',
                    width: 5,
                    enter: 'none',
                  } satisfies CanvasElement,
                  {
                    type: 'icon',
                    name: 'star',
                    x: r.x + r.w - 14,
                    y: r.y + 8,
                    size: 36,
                    stroke: 'bg',
                    enter: 'none',
                  } satisfies CanvasElement,
                ],
              } satisfies CanvasElement,
            ]
          : []),
      ],
    } satisfies CanvasElement;
  };
}

export interface CreateChoiceCardContext {
  cards: { x: number; y: number; w: number; h: number }[];
  stacked: boolean;
  pick: string;
  sides: string[];
  AT: { [k: string]: number };
  text: (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  head: number;
  narrowCards: boolean;
  colors: string[];
  rows: string[];
  rh: number;
  wins: (row: string, s: string) => boolean;
  rowY: (card: number, row: number) => number;
  mark: (
    c: number,
    i: number,
    cx: number,
    cy: number,
  ) =>
    | {
        children: (
          | {
              type: 'circle';
              cx: number;
              cy: number;
              r: number;
              fill: string;
              enter: string;
              name?: undefined;
              x?: undefined;
              y?: undefined;
              size?: undefined;
              stroke?: undefined;
            }
          | {
              type: 'icon';
              name: string;
              x: number;
              y: number;
              size: number;
              stroke: string;
              enter: string;
              cx?: undefined;
              cy?: undefined;
              r?: undefined;
              fill?: undefined;
            }
        )[];
        cue: string;
        at: number;
        after: number;
        type: 'group';
        origin: [number, number];
        enter: string;
        dur: number;
      }
    | {
        cue: string;
        at: number;
        after: number;
        type: 'line';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        stroke: string;
        width: number;
        cap: string;
        opacity: number;
        enter: string;
        dur: number;
      };
}
