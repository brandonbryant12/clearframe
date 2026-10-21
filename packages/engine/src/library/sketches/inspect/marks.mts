import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES, LABELS, ICON, AT } from './common.mjs';
import type { inspectMessage } from './message.mjs';

export function inspectMarks(context: ReturnType<typeof inspectMessage>) {
  const {
    w,
    marks,
    color,
    side,
    fs,
    pad,
    badge,
    cw,
    callout,
    card,
    inner,
    lx,
    ringOf,
    text,
  } = context;

  // The marks: a tinted band and a ring drawn round the part, then a connector out to a badge
  // and the label, in that order from the moment.
  const right = w - (side ? 120 : 60);

  const markEls = marks.flatMap((part, i) => {
    const cue = NAMES[i],
      at = AT[cue];
    const r = ringOf(required(part, 'marked part'));
    const timed = (
      after: number,
      extra: { enter: string; dur: number; dist?: number },
    ) => ({ cue, at: round(at + after), after, ...extra });
    // Where the connector leaves the ring, and where the badge sits.
    const [ax, ay] = side
      ? [r.x + r.w, round(r.y + r.h / 2)]
      : [inner.x + badge, r.y + r.h];
    const [bx, by] = side
      ? [lx + badge, ay]
      : [ax, round(ay + callout / 2 + 8)];
    const [ex, ey] = side ? [lx, ay] : [ax, by - badge];
    const tx = bx + badge + 18;
    return [
      {
        type: 'rect',
        ...r,
        r: 16,
        fill: color,
        opacity: 0.1,
        ...timed(0, { enter: 'fade', dur: 0.4 }),
      } satisfies CanvasElement,
      {
        type: 'rect',
        ...r,
        r: 16,
        fill: 'none',
        stroke: color,
        width: 4,
        ...timed(0, { enter: 'draw', dur: 0.55 }),
      } satisfies CanvasElement,
      {
        type: 'circle',
        cx: ax,
        cy: ay,
        r: 7,
        fill: color,
        ...timed(0.4, { enter: 'pop', dur: 0.25 }),
      } satisfies CanvasElement,
      {
        type: 'line',
        x1: ax,
        y1: ay,
        x2: ex,
        y2: ey,
        stroke: color,
        width: 3,
        cap: 'round',
        ...timed(0.45, { enter: 'draw', dur: side ? 0.35 : 0.2 }),
      } satisfies CanvasElement,
      {
        type: 'group',
        origin: [bx, by],
        ...timed(side ? 0.75 : 0.6, { enter: 'pop', dur: 0.35 }),
        children: [
          {
            type: 'circle',
            cx: bx,
            cy: by,
            r: badge,
            fill: color,
            enter: 'none',
          } satisfies CanvasElement,
          {
            type: 'icon',
            name: required(
              Object.entries(ICON).find(([name]) => name === color),
              'mark icon',
            )[1],
            x: bx,
            y: by,
            size: round(badge * 1.15),
            stroke: 'bg',
            enter: 'none',
          } satisfies CanvasElement,
        ],
      } satisfies CanvasElement,
      text(
        LABELS[i],
        tx,
        round(by + fs.label * 0.36),
        fs.label,
        'bold',
        'ink',
        {
          fit: (side ? right : card.x + cw - pad) - tx,
          ...timed(side ? 0.85 : 0.7, { enter: 'rise', dur: 0.4, dist: 16 }),
        },
      ),
    ];
  });
  return {
    ...context,
    w,
    marks,
    side,
    cw,
    callout,
    card,
    inner,
    lx,
    ringOf,
    text,
    right,
    markEls,
  };
}
