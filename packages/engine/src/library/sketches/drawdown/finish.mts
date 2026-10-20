import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp, round } from '../../../film/sketch-kit.mjs';
import { short } from './common.mjs';
import type { drawdownRecovery } from './recovery.mjs';

export function drawdownFinish(
  context: ReturnType<typeof drawdownRecovery>,
): SketchDrawing {
  const {
    low,
    pct,
    cued,
    F,
    cap,
    text,
    dotR,
    chipPad,
    chipGap,
    chipH,
    chipW,
    ptr,
    xl,
    place,
    spot,
    Ylow,
    els,
  } = context;

  // LOW: the chip with the low's day over the stated fall, beside the low with a dashed leader,
  // or hanging under it with a pointer.
  const chipY =
    place === 'below' ? Ylow + dotR + 10 + ptr : round(Ylow - chipH / 2);

  const chip = { x: spot.x, y: round(chipY), w: chipW, h: chipH };

  const cx = round(chip.x + chipW / 2);

  let tip: number[];
  let slide: { x?: number; y?: number };
  if (place === 'left') {
    tip = [chip.x + chipW, Ylow];
    slide = { x: 120 };
  } else if (place === 'right') {
    tip = [chip.x, Ylow];
    slide = { x: -120 };
  } else {
    tip = [Math.min(Math.max(xl, chip.x + 24), chip.x + chipW - 24), chip.y];
    slide = { y: -50 };
  }

  els.push({
    type: 'group',
    enter: 'fade',
    dur: 0.25,
    ...cued('LOW'),
    keys: [
      cued('LOW', 0, { dur: 0, ...slide }),
      cued('LOW', 0, {
        dur: 0.9,
        ease: 'out',
        ...Object.fromEntries(Object.keys(slide).map((k) => [k, 0])),
      }),
    ],
    children: [
      {
        type: 'rect',
        ...chip,
        r: 14,
        fill: 'negative',
        enter: 'none',
      } satisfies CanvasElement,
      ...(place === 'below'
        ? [
            {
              type: 'poly',
              points: [
                [tip[0] - 11, chip.y + 1],
                [tip[0] + 11, chip.y + 1],
                [tip[0], chip.y - ptr],
              ].map((p) => p.map(round)),
              closed: true,
              fill: 'negative',
              enter: 'none',
            } satisfies CanvasElement,
          ]
        : []),
      text(
        short(low),
        cx,
        chip.y + chipPad + cap(F.chipDate),
        F.chipDate,
        'semibold',
        'bg',
        {
          anchor: 'middle',
          opacity: 0.88,
          fit: round(chipW - 24),
          enter: 'none',
        },
      ),
      text(
        pct,
        cx,
        chip.y + chipPad + cap(F.chipDate) + chipGap + cap(F.value),
        F.value,
        'bold',
        'bg',
        { anchor: 'middle', fit: round(chipW - 20), enter: 'none' },
      ),
    ],
  } satisfies CanvasElement);

  if (spot.lead && spot.lead[1] - spot.lead[0] > 14)
    els.push({
      type: 'line',
      x1: spot.lead[0],
      y1: Ylow,
      x2: spot.lead[1],
      y2: Ylow,
      stroke: 'negative',
      width: 3,
      dash: [8, 7],
      cap: 'butt',
      enter: 'fade',
      dur: 0.4,
      ...cued('LOW', 0.6),
    } satisfies CanvasElement);

  // A drawn line stays a chart line in a hand-drawn or printed film: every point is a stated one.
  return { elements: crisp(els) };
}
