import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';

import { NAMES } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { vestingLayout } from './layout.mjs';
import { drawVestingSteps } from './steps.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const steps = params.steps ?? [33, 66, 100];
  steps.forEach((v, i) => {
    if (i && v < steps[i - 1])
      throw new Error(
        `sketchParams.steps for vesting must not fall from one step to the next (got ${steps.join(', ')})`,
      );
  });
  const { chart, cx, at, H, cw, T, span, node, lockScale, n, fig, what } =
    vestingLayout(steps, w, h);
  const text = (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;
  const els: CanvasElement[] = [];

  // The timeline: a hairline across, a start dot, and progress that fills to each step in turn.
  els.push({
    type: 'line',
    x1: chart.x0,
    y1: chart.line,
    x2: chart.x1,
    y2: chart.line,
    stroke: 'line',
    width: 4,
    cap: 'round',
    enter: 'draw',
    at: 0,
    dur: 0.7,
  } satisfies CanvasElement);
  els.push({
    type: 'circle',
    cx: chart.x0,
    cy: chart.line,
    r: 9,
    fill: 'accent',
    enter: 'pop',
    at: 0.1,
    dur: 0.35,
  } satisfies CanvasElement);
  steps.forEach((_, i) =>
    els.push({
      type: 'line',
      x1: i ? cx(i - 1) : chart.x0,
      y1: chart.line,
      x2: cx(i),
      y2: chart.line,
      stroke: 'accent',
      width: 6,
      cap: 'round',
      enter: 'draw',
      drawEase: 'out',
      cue: NAMES[i],
      at: at(i),
      dur: 0.4,
    } satisfies CanvasElement),
  );

  drawVestingSteps({
    steps,
    cx,
    H,
    at,
    els,
    cw,
    chart,
    text,
    T,
    span,
    node,
    lockScale,
    n,
    fig,
  });
  // What the share is a share of, under the figure.
  els.push(
    text('WHAT', what.x, what.y, what.size, 'semibold', 'ink', {
      width: what.width,
      leading: 1.18,
      enter: 'fade',
      at: 0.3,
      dur: 0.5,
    }),
  );
  // Count-only figures carry no text.
  for (const el of els)
    if (el.type === 'text' && el.text == null) delete el.text;
  return { elements: els };
}
