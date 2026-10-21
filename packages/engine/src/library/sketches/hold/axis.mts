import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { crisp, round } from '../../../film/sketch-kit.mjs';

import { dayTicks } from './common.mjs';
import type { holdTiming } from './timing.mjs';

export function holdAxis(context: ReturnType<typeof holdTiming>) {
  const { days, wide, fs, L, x0, x1, top, axisY, text, els } = context;

  // The window: a quiet panel, the day axis with its ticks, the start and end of the window.
  // (Fills that carry type or a quantity stay flat in a drawn film: crisp.)
  els.push(
    ...crisp([
      {
        type: 'rect',
        x: x0,
        y: top - 40,
        w: x1 - x0,
        h: axisY - top + 40,
        r: 18,
        fill: 'surface',
        opacity: 0.55,
        enter: 'none',
        at: 0,
      } satisfies CanvasElement,
    ]),
  );

  els.push({
    type: 'line',
    x1: x0,
    y1: axisY,
    x2: x1,
    y2: axisY,
    stroke: 'line',
    width: 3,
    cap: 'round',
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  const ticks = dayTicks(days);

  ticks.forEach((d, k) => {
    const x = round(x0 + (d / days) * (x1 - x0));
    const last = k === ticks.length - 1;
    els.push({
      type: 'line',
      x1: x,
      y1: axisY,
      x2: x,
      y2: axisY + 12,
      stroke: 'line',
      width: 3,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement);
    els.push(
      text(
        String(d),
        x,
        axisY + 48,
        fs.tick,
        last ? 'bold' : 'semibold',
        last ? 'ink' : 'muted',
        { anchor: 'middle', enter: 'none', at: 0 },
      ),
    );
  });

  // What the axis counts: on the tick row in the gutter (wide frames), under the ticks in narrow ones.
  els.push(
    wide
      ? text('WINDOW', x0 - 40, axisY + 48, fs.label, 'semibold', 'ink', {
          anchor: 'end',
          fit: x0 - 40 - L,
          enter: 'none',
          at: 0,
        })
      : text(
          'WINDOW',
          round((x0 + x1) / 2),
          axisY + 96,
          fs.label,
          'semibold',
          'ink',
          { anchor: 'middle', fit: x1 - x0 - 40, enter: 'none', at: 0 },
        ),
  );

  // The window's end: dashed from the first frame, drawn solid when it closes.
  els.push({
    type: 'line',
    x1,
    y1: top - 40,
    x2: x1,
    y2: axisY,
    stroke: 'line',
    width: 3,
    dash: [8, 8],
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  return { ...context, wide, fs, L, x0, x1, top, axisY, text, els };
}
