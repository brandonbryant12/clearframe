import { drawActionPin } from './pin.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import type { drawdownAxis } from './axis.mjs';

export function drawdownLines(context: ReturnType<typeof drawdownAxis>) {
  const {
    back,
    cued,
    FALL_DUR,
    RISE_DUR,
    F,
    cap,
    wordsW,
    text,
    dashed,
    L,
    R,
    dotR,
    halo,
    lineW,
    Y0,
    chipW,
    xs,
    xl,
    xb,
    xa,
    place,
    spot,
    Ylow,
    els,
  } = context;

  // Halos behind the points: the start's, then one riding each line's head.
  const fallD = `M ${xs} ${Y0} L ${xl} ${Ylow}`;

  els.push({
    type: 'circle',
    cx: xs,
    cy: Y0,
    r: halo,
    fill: 'ink',
    opacity: 0.16,
    enter: 'pop',
    dur: 0.4,
    ...cued('OPEN', 0.6),
    keys: [cued('FALL', 0, { dur: 0.4, opacity: 0 })],
  } satisfies CanvasElement);

  els.push({
    type: 'circle',
    cx: xs,
    cy: Y0,
    r: halo,
    fill: 'negative',
    opacity: 0.22,
    enter: 'fade',
    dur: 0.2,
    ...cued('FALL'),
    along: { d: fallD, ease: 'linear', dur: FALL_DUR, ...cued('FALL') },
  } satisfies CanvasElement);

  const riseD = back != null ? `M ${xl} ${Ylow} L ${xb} ${Y0}` : null;

  if (riseD && xb != null)
    els.push({
      type: 'circle',
      cx: xl,
      cy: Ylow,
      r: halo,
      fill: 'ink',
      opacity: 0.16,
      enter: 'fade',
      dur: 0.2,
      ...cued('RECOVER'),
      along: { d: riseD, ease: 'linear', dur: RISE_DUR, ...cued('RECOVER') },
      keys: [cued('RECOVER', RISE_DUR + 0.2, { dur: 0.5, opacity: 0 })],
    } satisfies CanvasElement);

  drawActionPin(context);

  // FALL: a dashed straight line from the start to the low (two stated points, no path between
  // them), with a dot riding its head that becomes the low.
  const dash = { on: 26, off: 10, width: lineW };

  els.push(
    ...dashed([xs, Y0], [xl, Ylow], {
      ...dash,
      cue: 'FALL',
      dur: FALL_DUR,
      stroke: 'negative',
    }),
  );

  // RECOVER: the climb back to 0%, in ink (the recovery is not credited to anything drawn).
  if (riseD && xb != null)
    els.push(
      ...dashed([xl, Ylow], [xb, Y0], {
        ...dash,
        cue: 'RECOVER',
        dur: RISE_DUR,
        stroke: 'ink',
      }),
    );
  return {
    ...context,
    cued,
    FALL_DUR,
    RISE_DUR,
    F,
    cap,
    wordsW,
    text,
    L,
    R,
    dotR,
    Y0,
    chipW,
    xs,
    xl,
    xb,
    xa,
    place,
    spot,
    Ylow,
    els,
    fallD,
    riseD,
  };
}
