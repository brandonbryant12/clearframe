import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { lookbackPositions } from './positions.mjs';

export function lookbackAxis(context: ReturnType<typeof lookbackPositions>) {
  const { cued, vtop, wide, F, L, R, x0, x1, axisY, yOf, text, under } =
    context;

  // The period, there from the first frame: a quiet panel, the time axis and its two days.
  const panelTop = round(yOf(vtop) - (wide ? 44 : 52));

  under.push({
    type: 'rect',
    x: x0,
    y: panelTop,
    w: round(x1 - x0),
    h: round(axisY - panelTop),
    r: 18,
    fill: 'surface',
    opacity: 0.55,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  under.push({
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

  for (const x of [x0, x1])
    under.push({
      type: 'line',
      x1: x,
      y1: axisY,
      x2: x,
      y2: axisY + 14,
      stroke: 'line',
      width: 3,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement);

  const dateY = round(axisY + F.date * 1.4);

  const dateFit = wide ? 220 : round((x1 - x0) / 2 - 16);

  under.push(
    text('STARTLABEL', x0, dateY, F.date, 'semibold', 'muted', {
      fit: dateFit,
      enter: 'none',
      at: 0,
    }),
  );

  under.push(
    text('ENDLABEL', x1, dateY, F.date, 'semibold', 'muted', {
      anchor: 'end',
      fit: dateFit,
      enter: 'none',
      at: 0,
    }),
  );

  // What the period is: between the days in wide frames, on its own row under them in narrow ones.
  under.push(
    text(
      'PERIOD',
      (x0 + x1) / 2,
      wide ? dateY : round(dateY + F.period * 1.5),
      F.period,
      'semibold',
      'ink',
      {
        anchor: 'middle',
        fit: wide ? round(x1 - x0 - 2 * (dateFit + 24)) : round(R - L),
        enter: 'rise',
        dist: 12,
        dur: 0.5,
        ...cued('PERIOD'),
      },
    ),
  );
  return { ...context, cued, wide, F, R, x0, x1, axisY, yOf, text, under };
}
