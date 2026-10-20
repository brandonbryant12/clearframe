import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

export function drawPreviousValue({
  shorter,
  pill,
  x0,
  nowX,
  barH,
  wasX,
  at,
  els,
  grow,
  sweep,
  ty,
  r,
}: DrawPreviousValueContext) {
  if (shorter) {
    const pair = [
      pill(x0, nowX),
      pill(nowX - barH, wasX, {
        exit: 'fall',
        exitCue: 'CHANGE',
        exitAt: at.CHANGE,
      }),
    ];
    // Grown, the pair sweeps as one, so the seam between them never shows.
    els.push(
      ...(grow
        ? [
            {
              type: 'group',
              at: 0,
              enter: 'none',
              ...sweep,
              children: pair,
            } satisfies CanvasElement,
          ]
        : pair),
    );
    // What was lost stays drawn as an outline, so the old reach is still seen.
    els.push({
      type: 'rect',
      x: nowX + 10,
      y: ty,
      w: wasX - nowX - 20,
      h: barH,
      r,
      fill: 'none',
      stroke: 'negative',
      width: 4,
      dash: [14, 10],
      enter: 'draw',
      cue: 'CHANGE',
      at: at.CHANGE + 0.6,
      dur: 0.6,
    } satisfies CanvasElement);
  } else els.push(pill(x0, wasX, sweep));
}

export interface DrawPreviousValueContext {
  shorter: boolean;
  pill: (
    from: number,
    to: number,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  x0: number;
  nowX: number;
  barH: number;
  wasX: number;
  at: { CHANGE: number; NOTE: number; WAS: number };
  els: CanvasElement[];
  grow: boolean;
  sweep: Partial<CanvasElement>;
  ty: number;
  r: number;
}
