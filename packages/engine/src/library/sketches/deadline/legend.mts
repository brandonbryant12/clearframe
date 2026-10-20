import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { DrawCalendarLegendContext } from './contracts.mjs';
import { deadlineMetrics } from './metrics.mjs';
import type { AT } from './constants.mjs';

export function drawCalendarLegend({
  stacked,
  small,
  key,
  keyGap,
  cued,
  text,
  keyW,
  els,
  start,
  end,
  ring,
  today,
}: DrawCalendarLegendContext) {
  const metrics = deadlineMetrics(stacked, small);
  const gr = metrics.legendRadius;
  const gsize = metrics.legendType;
  const label = metrics.legendLabel;
  const row = (
    i: number,
    cue: keyof typeof AT,
    mark: (x: number, y: number) => CanvasElement[],
    words: string,
  ): CanvasElement => {
    const gx = key.x + gr,
      gy = round(key.y + i * keyGap);
    return {
      type: 'group',
      enter: 'right',
      dist: 30,
      dur: 0.45,
      ...cued(cue, 0.2),
      children: [
        ...mark(gx, gy),
        text(
          words,
          gx + gr + 26,
          round(gy + label * 0.36),
          label,
          'semibold',
          'ink',
          { width: keyW - 2 * gr - 30, leading: 1.1, enter: 'none' },
        ),
      ],
    } satisfies CanvasElement;
  };
  const filled = (n: number) => (x: number, y: number) => [
    {
      type: 'circle',
      cx: x,
      cy: y,
      r: gr,
      fill: 'accent',
      enter: 'none',
    } satisfies CanvasElement,
    text(String(n), x, round(y + gsize * 0.36), gsize, 'semibold', 'bg', {
      anchor: 'middle',
      enter: 'none',
    }),
  ];
  els.push(row(0, 'OPEN', filled(start), 'OPENS'));
  els.push(
    row(
      1,
      'CLOSE',
      (x: number, y: number) => [
        ...filled(end)(x, y),
        {
          type: 'path',
          d: ring(x, y, gr + 8),
          fill: 'none',
          stroke: 'accent2',
          width: 4,
          cap: 'round',
          join: 'round',
          enter: 'none',
        } satisfies CanvasElement,
      ],
      'CLOSES',
    ),
  );
  if (today)
    els.push(
      row(
        2,
        'TODAY',
        (x: number, y: number) => [
          {
            type: 'circle',
            cx: x,
            cy: y,
            r: gr,
            fill: 'none',
            stroke: 'ink',
            width: 3,
            enter: 'none',
          } satisfies CanvasElement,
          text(
            String(today),
            x,
            round(y + gsize * 0.36),
            gsize,
            'semibold',
            'ink',
            { anchor: 'middle', enter: 'none' },
          ),
        ],
        'TODAY',
      ),
    );
}
