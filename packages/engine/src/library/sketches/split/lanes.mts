import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES, LABELS } from './model.mjs';
import type { CueTimes } from './model.mjs';

export function createLane({
  AT,
  laneY,
  bx,
  bw,
  laneH,
  text,
  wide,
  labelEnd,
  textY,
  fs,
  fmt,
  parts,
  valueEnd,
  last,
}: CreateLaneContext) {
  return (i: number) => {
    const cue = NAMES[i],
      at = AT[cue];
    const y = laneY(i);
    const later = (
      after: number,
      extra: { enter: string; dist: number; dur: number },
    ) => ({ cue, at: round(at + after), after, ...extra });
    return [
      // The lane's track: the whole's width, so each part is read against it.
      {
        type: 'rect',
        x: bx,
        y,
        w: bw,
        h: laneH,
        r: 10,
        fill: 'wash',
        opacity: 0.75,
        enter: 'fade',
        at: round(0.5 + i * 0.07),
        dur: 0.5,
      } satisfies CanvasElement,
      text(
        LABELS[i],
        wide ? labelEnd : bx,
        wide ? textY(y, laneH, fs.label) : textY(y),
        fs.label,
        'semibold',
        'ink',
        {
          anchor: wide ? 'end' : 'start',
          fit: wide ? 420 : round(bw * 0.66),
          ...later(0.35, { enter: 'rise', dist: 14, dur: 0.4 }),
        },
      ),
      text(
        fmt(parts[i]),
        valueEnd,
        wide ? textY(y, laneH, fs.value) : textY(y) + 2,
        fs.value,
        'bold',
        'ink',
        {
          anchor: 'end',
          fit: wide ? 250 : round(bw * 0.3),
          origin: [valueEnd, wide ? round(y + laneH / 2) : textY(y) - 14],
          ...later(0.5, { enter: 'rise', dist: 14, dur: 0.4 }),
          ...(i === last
            ? {
                keys: [
                  {
                    cue: 'REST',
                    at: round(AT.REST + 0.2),
                    after: 0.2,
                    dur: 0.5,
                    ease: 'out',
                    scale: 1.18,
                  },
                ],
              }
            : {}),
        },
      ),
    ];
  };
}

export interface CreateLaneContext {
  AT: CueTimes;
  laneY: (index: number) => number;
  bx: number;
  bw: number;
  laneH: number;
  text: (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  wide: boolean;
  labelEnd: number;
  textY: (y: number, height?: number, size?: number) => number;
  fs: { whole: number; total: number; label: number; value: number };
  fmt: (v: number) => string;
  parts: number[];
  valueEnd: number;
  last: number;
}
