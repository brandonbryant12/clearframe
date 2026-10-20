import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES } from './model.mjs';

export function createChoiceMark({
  wins,
  rows,
  sides,
  AT,
  stacked,
  colors,
}: CreateChoiceMarkContext) {
  return (c: number, i: number, cx: number, cy: number) => {
    const cue = NAMES[i],
      win = wins(rows[i], sides[c]);
    const after = round(0.15 + c * 0.08);
    const timed = { cue, at: round(AT[cue] + after), after };
    return win
      ? ({
          type: 'group',
          origin: [cx, cy],
          enter: 'pop',
          dur: 0.4,
          ...timed,
          children: [
            {
              type: 'circle',
              cx,
              cy,
              r: stacked ? 31 : 34,
              fill: colors[c],
              enter: 'none',
            } satisfies CanvasElement,
            {
              type: 'icon',
              name: 'check',
              x: cx,
              y: cy,
              size: stacked ? 38 : 42,
              stroke: 'bg',
              enter: 'none',
            } satisfies CanvasElement,
          ],
        } satisfies CanvasElement)
      : ({
          type: 'line',
          x1: cx - 16,
          y1: cy,
          x2: cx + 16,
          y2: cy,
          stroke: 'muted',
          width: 5,
          cap: 'round',
          opacity: 0.55,
          enter: 'grow-x',
          dur: 0.3,
          ...timed,
        } satisfies CanvasElement);
  };
}

export interface CreateChoiceMarkContext {
  wins: (row: string, s: string) => boolean;
  rows: string[];
  sides: string[];
  AT: { [k: string]: number };
  stacked: boolean;
  colors: string[];
}
