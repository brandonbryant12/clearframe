import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp, round } from '../../../film/sketch-kit.mjs';

import type { lookbackPurchase } from './purchase.mjs';

export function lookbackFinish(
  context: ReturnType<typeof lookbackPurchase>,
): SketchDrawing {
  const {
    gain,
    fmt,
    lowStart,
    gap,
    cued,
    wide,
    F,
    cap,
    pillH,
    pillW,
    dotR,
    bw,
    R,
    x0,
    x1,
    xs,
    xb,
    yPay,
    yEnd,
    pill,
    text,
    under,
    els,
    hand,
  } = context;

  // The gain: the gap from what you pay up to the last day's price shades in behind the bar,
  // bracketed, with its size and words beside the bracket (under the pill in narrow frames).
  if (gain) {
    const bx = round(xs - bw / 2 - 12);
    under.push({
      type: 'rect',
      x: bx,
      y: yEnd,
      w: round(xb - bx),
      h: round(yPay - yEnd),
      r: 6,
      fill: 'wash',
      enter: 'none',
      origin: [round((bx + xb) / 2), yPay],
      ...cued('GAIN'),
      keys: [
        cued('GAIN', 0, { dur: 0, scaleY: 0 }),
        cued('GAIN', 0, { dur: 0.7, ease: 'out', scaleY: 1 }),
      ],
    } satisfies CanvasElement);
    if (lowStart && bx - (x1 + dotR + 8) > 16)
      els.push({
        type: 'line',
        x1: x1 + dotR + 8,
        y1: yEnd,
        x2: bx,
        y2: yEnd,
        stroke: 'muted',
        width: 3,
        dash: [3, 8],
        cap: 'round',
        enter: 'draw',
        dur: 0.4,
        ...cued('GAIN', 0.15),
      } satisfies CanvasElement);
    els.push({
      type: 'path',
      d: `M ${xb - 14} ${yEnd} L ${xb} ${yEnd} L ${xb} ${yPay} L ${xb - 14} ${yPay}`,
      fill: 'none',
      stroke: 'ink',
      width: 3,
      cap: 'round',
      join: 'round',
      enter: 'draw',
      dur: 0.6,
      ...cued('GAIN', 0.2),
    } satisfies CanvasElement);
    const blockH = cap(F.gain) + 14 + F.gainWords;
    const [gx, gTop, anchor] = wide
      ? [xb + 24, Math.max((yPay + yEnd) / 2 - blockH / 2, yEnd + 12), 'start']
      : [pill.x + pillW, pill.y + pillH + 30, 'end'];
    const gFit = wide ? R + 40 - (xb + 24) : xb - x0;
    els.push({
      type: 'group',
      enter: 'rise',
      dist: 16,
      dur: 0.45,
      ...cued('GAIN', 0.35),
      children: [
        text(fmt(gap), gx, gTop + cap(F.gain), F.gain, 'bold', 'accent', {
          anchor,
          fit: round(gFit),
          enter: 'none',
        }),
        text(
          'GAIN',
          gx,
          gTop + cap(F.gain) + 14 + F.gainWords * 0.9,
          F.gainWords,
          'semibold',
          'ink',
          { anchor, fit: round(gFit), enter: 'none' },
        ),
      ],
    } satisfies CanvasElement);
  }

  return { elements: [...crisp(under), ...crisp(els), ...hand] };
}
