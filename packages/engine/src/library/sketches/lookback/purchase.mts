import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import { ring } from './common.mjs';
import type { lookbackTags } from './tags.mjs';

export function lookbackPurchase(context: ReturnType<typeof lookbackTags>) {
  const {
    fmt,
    lowStart,
    pay,
    pct,
    cued,
    F,
    cap,
    numW,
    tagH,
    pillH,
    pillW,
    dotR,
    bw,
    x0,
    xs,
    wordsBase,
    yLo,
    barH,
    pctC,
    pill,
    pcy,
    text,
    els,
    hand,
    lower,
  } = context;

  // The lower price: circled by hand, named under its dot, and carried by a dashed level line
  // to the purchase at the period's end.
  const rp = ring(
    lower.tx + lower.tw / 2,
    lower.ty + tagH / 2,
    lower.tw / 2 + 24,
    tagH / 2 + 20,
  );

  hand.push({
    type: 'path',
    d: `M ${rp.map((p) => p.join(' ')).join(' L ')}`,
    fill: 'none',
    stroke: 'accent',
    width: 5,
    cap: 'round',
    join: 'round',
    enter: 'draw',
    dur: 0.8,
    loop: { type: 'pulse', period: 2.6, amount: 0.03 },
    ...cued('LOWER'),
  } satisfies CanvasElement);

  const pctX = round(xs - bw / 2 - 18);

  const wordsY = round(yLo + wordsBase);

  // The first day's words (far left) and what you pay's words (right) share a row only when the
  // bar is short: then they split the width between them.
  const sameRow =
    lowStart &&
    wordsY + 14 > pill.y &&
    wordsY - cap(F.words) - 14 < pill.y + pillH;

  const split = round((lower.tx + pill.x - 18) / 2);

  els.push(
    lowStart
      ? text('LOWER', lower.tx, wordsY, F.words, 'bold', 'accent', {
          fit: round(
            Math.min(
              560,
              pctX - numW(pct, F.pct) - 30 - lower.tx,
              sameRow ? split - 12 - lower.tx : Infinity,
            ),
          ),
          enter: 'rise',
          dist: 18,
          dur: 0.6,
          ...cued('LOWER', 0.25),
        })
      : text('LOWER', pctX, wordsY, F.words, 'bold', 'accent', {
          anchor: 'end',
          fit: round(Math.min(560, pctX - x0 - 10)),
          enter: 'rise',
          dist: 18,
          dur: 0.6,
          ...cued('LOWER', 0.25),
        }),
  );

  const levelFrom = lower.x + dotR + 8,
    levelTo = round(xs - bw / 2);

  if (levelTo - levelFrom > 16)
    els.push({
      type: 'line',
      x1: levelFrom,
      y1: yLo,
      x2: levelTo,
      y2: yLo,
      stroke: 'accent',
      width: 4,
      dash: [12, 10],
      cap: 'butt',
      enter: 'draw',
      dur: round(Math.min(0.9, 0.3 + (levelTo - levelFrom) / 2400)),
      ...cued('LOWER', 0.4),
    } satisfies CanvasElement);

  // The discount: a bar dropping from the lower price to the price you pay, its size beside it.
  els.push({
    type: 'rect',
    x: round(xs - bw / 2),
    y: yLo,
    w: bw,
    h: round(barH),
    r: 4,
    fill: 'accent',
    enter: 'none',
    origin: [xs, yLo],
    ...cued('DISCOUNT'),
    keys: [
      cued('DISCOUNT', 0, { dur: 0, scaleY: 0 }),
      cued('DISCOUNT', 0, { dur: 0.7, ease: 'out', scaleY: 1 }),
    ],
  } satisfies CanvasElement);

  els.push(
    text(pct, pctX, yLo + pctC + F.pct * 0.36, F.pct, 'bold', 'accent', {
      anchor: 'end',
      enter: 'drop',
      dist: 18,
      dur: 0.45,
      ...cued('DISCOUNT', 0.3),
    }),
  );

  // What you pay: a solid pill under the bar, its words before it.
  els.push({
    type: 'group',
    enter: 'pop',
    dur: 0.45,
    origin: [round(pill.x + pillW / 2), round(pcy)],
    ...cued('PAY'),
    children: [
      {
        type: 'rect',
        ...pill,
        r: round(pillH / 2),
        fill: 'accent',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        fmt(pay),
        pill.x + pillW / 2,
        pcy + F.pay * 0.36,
        F.pay,
        'bold',
        'bg',
        { anchor: 'middle', fit: round(pillW - F.pay * 0.7), enter: 'none' },
      ),
    ],
  } satisfies CanvasElement);

  const payFit = round(
    Math.min(480, pill.x - 18 - (sameRow ? split + 12 : x0)),
  );

  els.push(
    text(
      'PAY',
      pill.x - 18,
      pcy + F.payWords * 0.36,
      F.payWords,
      'bold',
      'ink',
      {
        anchor: 'end',
        fit: payFit,
        enter: 'rise',
        dist: 14,
        dur: 0.4,
        ...cued('PAY', 0.15),
      },
    ),
  );
  return {
    ...context,
    fmt,
    lowStart,
    cued,
    F,
    cap,
    pillH,
    pillW,
    dotR,
    bw,
    x0,
    xs,
    pill,
    text,
    els,
    hand,
  };
}
