import type { Point } from '../../../film/contracts/primitives.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { CHOICE, cursorPath } from './common.mjs';
import type { inspectPointer } from './pointer.mjs';

export function inspectChoices(context: ReturnType<typeof inspectPointer>) {
  const {
    w,
    h,
    choices,
    side,
    bar,
    rows,
    bw,
    bh,
    inner,
    Y,
    STEP,
    timedOn,
    cued,
    btnC,
    binC,
    O,
    k,
  } = context;

  // CHOICES (choices: true): the two wrong moves, each refused on the card itself. On CLICK the
  // view settles square, the pointer comes in from below the link and presses it, the card is
  // tugged up (the pointer with it), the link greys and a no sign lands on it. On DELETE the
  // pointer moves up to the bin and presses it, the card shrinks toward the bin (about the bin
  // itself, so it stays under the pointer), holds and springs back, and a no sign lands on the
  // bin. The no signs fade with the marks on REPORT, and the same pointer goes on from the bin to
  // Report phish.
  const linkC: Point = [round(inner.x + bw / 2), round(Y(rows.link) + bh / 2)];

  const noSign = (c: Point, r: number, cue: string, dt: number | undefined) => {
    const wN = side ? 10 : 9,
      d = round(r * 0.7);
    return {
      type: 'group',
      origin: c,
      enter: 'pop',
      dur: 0.3,
      ...timedOn(cue, dt),
      children: [
        {
          type: 'circle',
          cx: c[0],
          cy: c[1],
          r,
          fill: 'bg',
          opacity: 0.55,
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'circle',
          cx: c[0],
          cy: c[1],
          r,
          fill: 'none',
          stroke: 'negative',
          width: wN,
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'line',
          x1: c[0] - d,
          y1: c[1] - d,
          x2: c[0] + d,
          y2: c[1] + d,
          stroke: 'negative',
          width: wN,
          cap: 'round',
          enter: 'none',
        } satisfies CanvasElement,
      ],
    } satisfies CanvasElement;
  };

  const refused = choices
    ? [
        noSign(linkC, round(bh * 0.72), 'CLICK', CHOICE.sign),
        noSign(binC, round(bar * 0.44), 'DELETE', CHOICE.sign),
      ]
    : [];

  const fold = 0.84,
    tug = side ? -46 : -56;

  const choiceKeys = choices
    ? [
        timedOn('CLICK', 0, {
          dur: CHOICE.reach,
          ease: 'inOut',
          scale: 1,
          x: 0,
          y: 0,
        }),
        timedOn('CLICK', CHOICE.reach, {
          dur: 0.5,
          ease: 'thereAndBack',
          y: tug,
          rotate: side ? -1.5 : -1,
        }),
        timedOn('DELETE', CHOICE.reach, {
          dur: 0.75,
          ease: 'thereAndBackPause',
          scale: fold,
          x: round((1 - fold) * (binC[0] - O[0])),
          y: round((1 - fold) * (binC[1] - O[1])),
        }),
      ]
    : [];

  const p0: Point = [
    Math.min(w - round(60 * k), linkC[0] + (side ? 240 : 190)),
    Math.min(h - round(90 * k), linkC[1] + (side ? 220 : 260)),
  ];

  const toTip = (c: Point) => ({
    x: round(c[0] + 6 - p0[0]),
    y: round(c[1] + 8 - p0[1]),
  });

  // The pointer presses the link on its right half, clear of the no sign and of a label under it.
  const linkHit: Point = [
    round(linkC[0] + bw * 0.24),
    round(linkC[1] - bh * 0.2),
  ];

  const press = (cue: string) =>
    timedOn(cue, CHOICE.reach, {
      dur: 0.25,
      ease: 'thereAndBack',
      scale: 0.82,
    });

  const guide =
    choices &&
    ({
      type: 'path',
      d: cursorPath(p0[0], p0[1], k),
      fill: 'ink',
      stroke: 'surface',
      width: 3,
      join: 'round',
      enter: 'fade',
      dur: 0.15,
      origin: p0,
      ...timedOn('CLICK'),
      keys: [
        timedOn('CLICK', 0, {
          dur: CHOICE.reach,
          ease: 'inOut',
          ...toTip(linkHit),
        }),
        press('CLICK'),
        // Caught: the pointer is yanked up with the card, and let go.
        timedOn('CLICK', CHOICE.reach, {
          dur: 0.5,
          ease: 'thereAndBack',
          y: toTip(linkHit).y + tug,
        }),
        timedOn('DELETE', 0, {
          dur: CHOICE.reach,
          ease: 'inOut',
          ...toTip(binC),
        }),
        press('DELETE'),
        cued(0, { dur: STEP.light, ease: 'inOut', ...toTip(btnC) }),
        cued(STEP.light + 0.35, {
          dur: 0.3,
          ease: 'in',
          x: toTip(btnC).x + 40,
          y: toTip(btnC).y + 60,
          opacity: 0,
        }),
      ],
    } satisfies CanvasElement);
  return { ...context, STEP, cued, btnC, O, refused, choiceKeys, guide };
}
