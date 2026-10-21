import { body, round } from '../../../film/sketch-kit.mjs';
import { FIRST, GAP } from './model.mjs';

export function barLayout(
  short: boolean,
  w: number,
  fig: { x: number; y: number; size: number; width: number },
  b: { x: number; y: number; w: number; h: number },
  T: boolean,
  y: (k: number) => number,
) {
  if (short) {
    return { x0: 110, x1: w - 110, top: fig.y + 100, label: b.y + b.h - 10 };
  }
  if (T) {
    return { x0: 110, x1: w - 110, top: y(0.41), label: y(0.894) };
  }
  return { x0: round(w * 0.396), x1: w - 120, top: y(0.17), label: y(0.98) };
}

export function figureLayout(
  short: boolean,
  b: { x: number; y: number; w: number; h: number },
  figSize: number,
  T: boolean,
  y: (k: number) => number,
  w: number,
) {
  if (short) {
    return { x: 130, y: b.y + 92, size: figSize, width: round(figSize * 2.9) };
  }
  if (T) {
    return { x: 130, y: y(0.192), size: figSize, width: w - 260 };
  }
  return { x: 150, y: y(0.517), size: figSize, width: round(w * 0.27) };
}

export function figureSize(short: boolean, T: boolean) {
  if (short) {
    return 110;
  }
  if (T) {
    return 190;
  }
  return 180;
}

export function vestingLayout(steps: number[], w: number, h: number) {
  const n = steps.length;
  // Wide frames put the figure beside the columns; narrower ones stack it above them.
  const T = w < 1400;
  const b = body(w, h);
  const at = (i: number) => round(FIRST + i * GAP);
  // Frame: the figure and what vests (left in landscape, on top in tall frames), then the
  // columns standing on the timeline.
  const y = (k: number) => round(b.y + b.h * k);
  // A short frame (square, portrait) sets what vests beside a smaller figure, to leave the
  // columns their height.
  const short = T && b.h < 900;
  const figSize = figureSize(short, T);
  const fig = figureLayout(short, b, figSize, T, y, w);
  const what = short
    ? {
        x: round(fig.x + figSize * 2.95),
        y: fig.y - 50,
        size: 38,
        width: round(w - fig.x - figSize * 2.95 - 96),
      }
    : { x: fig.x, y: fig.y + 86, size: T ? 46 : 42, width: fig.width };
  const chartLayout = barLayout(short, w, fig, b, T, y);
  const line = round(chartLayout.label - (T ? 92 : 88));
  const chart = { ...chartLayout, line, bottom: round(line - (T ? 98 : 88)) };
  const span = (chart.x1 - chart.x0) / n;
  const cx = (i: number) => round(chart.x0 + span * (i + 0.5));
  const cw = round(Math.min(T ? 150 : 140, span * 0.52));
  const H = round(chart.bottom - chart.top);
  const node = T ? 40 : 38;
  const lockScale = node / 30;
  return { chart, cx, at, H, cw, T, span, node, lockScale, n, fig, what };
}
