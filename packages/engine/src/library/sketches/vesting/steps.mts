import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES } from './model.mjs';

/**
 * A padlock centred on (x, y) at scale s. The shackle is drawn first, its right leg running down
 * into the body (hidden by it), so lifting it frees the short left leg: the lock is open.
 */
export function padlock(x: number, y: number, s: number, fill: string) {
  const bw = round(30 * s),
    bh = round(23 * s),
    by = round(y - 2 * s),
    leg = round(9 * s),
    top = round(by - 8 * s);
  return {
    shackle: {
      type: 'path',
      d: `M ${round(x - leg)} ${by} L ${round(x - leg)} ${top} A ${leg} ${leg} 0 0 1 ${round(x + leg)} ${top} L ${round(x + leg)} ${round(by + bh * 0.6)}`,
      fill: 'none',
      stroke: fill,
      width: round(4.5 * s),
      cap: 'round',
      enter: 'none',
    } satisfies CanvasElement,
    body: {
      type: 'rect',
      x: round(x - bw / 2),
      y: by,
      w: bw,
      h: bh,
      r: round(5 * s),
      fill,
      enter: 'none',
    } satisfies CanvasElement,
    keyhole: {
      type: 'circle',
      cx: x,
      cy: round(by + bh * 0.45),
      r: round(3.2 * s),
      enter: 'none',
    } satisfies CanvasElement,
  };
}

export function drawVestingSteps({
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
}: DrawVestingStepsContext) {
  steps.forEach((pct, i) => {
    const x = cx(i);
    const hgt = round((H * pct) / 100);
    const opens = pct > (i ? steps[i - 1] : 0);
    const cue = NAMES[i];
    const t0 = at(i);
    const after = (dt: number, extra = {}) => ({
      cue,
      at: round(t0 + dt),
      after: dt,
      ...extra,
    });
    // The column: a pale track for the whole, the owned share growing up from the base.
    els.push({
      type: 'rect',
      x: round(x - cw / 2),
      y: chart.top,
      w: cw,
      h: H,
      r: round(Math.min(22, cw / 2)),
      fill: 'wash',
      enter: 'rise',
      dist: 30,
      at: round(0.15 + i * 0.07),
      dur: 0.5,
    } satisfies CanvasElement);
    if (hgt > 0)
      els.push({
        type: 'rect',
        x: round(x - cw / 2),
        y: round(chart.bottom - hgt),
        w: cw,
        h: hgt,
        r: round(Math.min(22, cw / 2, hgt / 2)),
        fill: 'accent',
        enter: 'none',
        origin: [x, chart.bottom],
        ...after(0.2),
        keys: [
          after(0.2, { dur: 0, scaleY: 0 }),
          after(0.2, { dur: 0.9, ease: 'out', scaleY: 1 }),
        ],
      } satisfies CanvasElement);
    // The share, riding the top of the column as it grows.
    els.push(
      text(null, x, round(chart.bottom - 22), T ? 46 : 44, 'bold', 'ink', {
        text: undefined,
        count: { from: 0, to: pct, suffix: '%', dur: 0.9 },
        anchor: 'middle',
        fit: round(span - 14),
        enter: 'fade',
        dur: 0.3,
        ...after(0.2),
        keys: [after(0.2, { dur: 0.9, ease: 'out', y: -hgt })],
      }),
    );
    // The step on the timeline: a node with its padlock.
    els.push({
      type: 'circle',
      id: `vesting-step-${i + 1}`,
      cx: x,
      cy: chart.line,
      r: node,
      fill: 'surface',
      stroke: 'line',
      width: 3,
      enter: 'pop',
      at: round(0.25 + i * 0.07),
      dur: 0.4,
    } satisfies CanvasElement);
    const shut = padlock(x, chart.line, lockScale, 'muted');
    const shutLock: CanvasElement = {
      type: 'group',
      enter: 'fade',
      at: round(0.35 + i * 0.07),
      dur: 0.3,
      origin: [x, chart.line],
      children: [shut.shackle, shut.body, { ...shut.keyhole, fill: 'surface' }],
    } satisfies CanvasElement;
    // (Leaving by keys, not exits, so a moment retimed early can never come before an entrance.)
    if (opens) shutLock.keys = [after(0.1, { dur: 0.12, opacity: 0 })];

    // A cliff: time passes, the lock stays shut and shakes.
    else shutLock.keys = [after(0.25, { dur: 0.6, ease: 'wiggle', rotate: 9 })];
    els.push(shutLock);
    if (opens) {
      const open = padlock(x, chart.line, lockScale, 'bg');
      els.push({
        type: 'circle',
        cx: x,
        cy: chart.line,
        r: node + 2,
        fill: 'accent',
        enter: 'pop',
        dur: 0.35,
        ...after(0.1),
      } satisfies CanvasElement);
      els.push({
        type: 'group',
        enter: 'fade',
        dur: 0.15,
        ...after(0.12),
        children: [
          // The shackle springs up, freeing its left leg.
          {
            ...open.shackle,
            keys: [
              after(0.16, {
                dur: 0.5,
                ease: 'overshoot',
                y: round(-8 * lockScale),
              }),
            ],
          },
          open.body,
          { ...open.keyhole, fill: 'accent' },
        ],
      } satisfies CanvasElement);
    }
    // The most recent step breathes until the next one arrives.
    const halo: CanvasElement = {
      type: 'circle',
      cx: x,
      cy: chart.line,
      r: node + 12,
      fill: 'none',
      stroke: opens ? 'accent' : 'line',
      width: 3,
      opacity: 0.55,
      enter: 'pop',
      dur: 0.4,
      origin: [x, chart.line],
      loop: { type: 'pulse', period: 2.4, amount: 0.06 },
      ...after(0.45),
    } satisfies CanvasElement;
    if (i < n - 1)
      halo.keys = [{ cue: NAMES[i + 1], at: at(i + 1), dur: 0.25, opacity: 0 }];
    els.push(halo);
    els.push(
      text(`STEP${i + 1}`, x, chart.label, 34, 'semibold', 'muted', {
        anchor: 'middle',
        fit: round(span - 16),
        enter: 'fade',
        at: round(0.4 + i * 0.07),
        dur: 0.4,
      }),
    );
    // The big figure: the share owned now. It rises in on the first step; at each later step
    // it hands over, on the same frame, to a figure counting on from where it stood.
    const figure = text(null, fig.x, fig.y, fig.size, 'bold', 'accent', {
      text: undefined,
      count: { from: i ? steps[i - 1] : 0, to: pct, suffix: '%', dur: 0.9 },
      fit: fig.width,
      enter: i ? 'none' : 'rise',
      dist: 40,
      dur: i ? 0 : 0.4,
      ...after(0.2),
    });
    if (i < n - 1)
      figure.keys = [
        {
          cue: NAMES[i + 1],
          at: round(at(i + 1) + 0.2),
          after: 0.2,
          dur: 0,
          opacity: 0,
        },
      ];
    els.push(figure);
  });
}

export interface DrawVestingStepsContext {
  steps: number[];
  cx: (i: number) => number;
  H: number;
  at: (i: number) => number;
  els: CanvasElement[];
  cw: number;
  chart: {
    line: number;
    bottom: number;
    x0: number;
    x1: number;
    top: number;
    label: number;
  };
  text: (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  T: boolean;
  span: number;
  node: number;
  lockScale: number;
  n: number;
  fig: { x: number; y: number; size: number; width: number };
}
