import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { LabelSpot } from './common.mjs';
import { short } from './common.mjs';
import type { drawdownLines } from './lines.mjs';

export function drawdownStart(context: ReturnType<typeof drawdownLines>) {
  const {
    start,
    cued,
    FALL_DUR,
    F,
    cap,
    numW,
    wordsW,
    text,
    L,
    R,
    dotR,
    tagDay,
    tagVal,
    tagPadV,
    tagIn,
    tagH,
    tagPad,
    tagGap,
    Y0,
    xs,
    xa,
    els,
    fallD,
  } = context;

  // The points: the start (with its day over it), the low riding down the fall, the recovery
  // riding up the climb (with its words over it).
  els.push({
    type: 'circle',
    cx: xs,
    cy: Y0,
    r: dotR,
    fill: 'ink',
    stroke: 'bg',
    width: 4,
    enter: 'pop',
    dur: 0.4,
    ...cued('OPEN', 0.6),
  } satisfies CanvasElement);

  // The labels over the 0% line keep clear of each other and of the action's pin: centred over
  // their point when they can be, else beside it; the recovery's words drop under the line,
  // right of its point, when the row has no room.
  const tagTop = round(Y0 - tagGap - tagH),
    labelY = round(tagTop + tagH / 2 + cap(F.label) / 2);

  const pin = xa != null ? [[xa - 10, xa + 10]] : [];

  const clear = (a: number, b: number, avoid: readonly number[][]) =>
    a >= L && b <= R && !avoid.some(([p, q]) => a < q && b > p);

  // Centred over the point, else starting just left of it, else ending just right of it.
  const spots = (x: number, w: number, o = 14): LabelSpot[] => [
    { x, anchor: 'middle', a: x - w / 2, b: x + w / 2 },
    { x: x - o, anchor: 'start', a: x - o, b: x - o + w },
    { x: x + o, anchor: 'end', a: x + o - w, b: x + o },
  ];

  const beside = (x: number, w: number, avoid: number[][], o?: number) =>
    spots(x, w, o).find((c) => clear(c.a, c.b, avoid));

  const centred = (x: number, w: number): LabelSpot => {
    const c = Math.min(Math.max(x, L + w / 2), R - w / 2);
    return { x: c, anchor: 'middle', a: c - w / 2, b: c + w / 2 };
  };

  const sw = round(
    Math.max(wordsW(short(start).length, tagDay) * 1.1, numW('0%', tagVal)) +
      2 * tagPad,
  );

  const st = beside(xs, sw, pin, 26) ?? centred(xs, sw);

  els.push({
    type: 'group',
    enter: 'rise',
    dist: 24,
    dur: 0.6,
    ...cued('OPEN', 0.85),
    children: [
      {
        type: 'rect',
        x: round(st.a),
        y: tagTop,
        w: sw,
        h: tagH,
        r: 10,
        fill: 'ink',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'poly',
        points: [
          [xs - 9, tagTop + tagH - 1],
          [xs + 9, tagTop + tagH - 1],
          [xs, round(Y0 - dotR - 6)],
        ].map((p) => p.map(round)),
        closed: true,
        fill: 'ink',
        enter: 'none',
      },
      text(
        short(start),
        (st.a + st.b) / 2,
        tagTop + tagPadV + cap(tagDay),
        tagDay,
        'semibold',
        'bg',
        {
          anchor: 'middle',
          opacity: 0.88,
          fit: round(sw - tagPad),
          enter: 'none',
        },
      ),
      text(
        '0%',
        (st.a + st.b) / 2,
        tagTop + tagPadV + cap(tagDay) + tagIn + cap(tagVal),
        tagVal,
        'bold',
        'bg',
        { anchor: 'middle', fit: round(sw - tagPad), enter: 'none' },
      ),
    ],
  } satisfies CanvasElement);

  els.push({
    type: 'circle',
    cx: xs,
    cy: Y0,
    r: dotR,
    fill: 'negative',
    stroke: 'bg',
    width: 4,
    enter: 'fade',
    dur: 0.15,
    ...cued('FALL'),
    along: { d: fallD, ease: 'linear', dur: FALL_DUR, ...cued('FALL') },
    origin: [xs, Y0],
    // The low pulses as its chip lands.
    keys: [cued('LOW', 0, { dur: 0.5, ease: 'thereAndBack', scale: 1.4 })],
  } satisfies CanvasElement);
  return {
    ...context,
    cued,
    F,
    cap,
    wordsW,
    text,
    L,
    R,
    dotR,
    Y0,
    els,
    labelY,
    pin,
    clear,
    beside,
    centred,
    st,
  };
}
