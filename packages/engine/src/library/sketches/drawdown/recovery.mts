import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { drawdownStart } from './start.mjs';

export function drawdownRecovery(context: ReturnType<typeof drawdownStart>) {
  const {
    cued,
    RISE_DUR,
    F,
    cap,
    wordsW,
    text,
    L,
    R,
    dotR,
    Y0,
    xl,
    xb,
    Ylow,
    els,
    riseD,
    labelY,
    pin,
    clear,
    beside,
    centred,
    st,
  } = context;

  if (riseD && xb != null) {
    els.push({
      type: 'circle',
      cx: xl,
      cy: Ylow,
      r: dotR,
      fill: 'ink',
      stroke: 'bg',
      width: 4,
      enter: 'fade',
      dur: 0.15,
      ...cued('RECOVER'),
      along: { d: riseD, ease: 'linear', dur: RISE_DUR, ...cued('RECOVER') },
    } satisfies CanvasElement);
    // (Its words are the author's: sized for about 15 characters.) Over the line, clear of the
    // start's label and the pin; else under the line, right of the point; else clear of the
    // start's label only (the pin may cross it).
    const bw = wordsW(15, F.label),
      own = [[st.a - 16, st.b + 16]];
    const underX = xb + dotR + 14,
      under = {
        x: underX,
        anchor: 'start',
        a: underX,
        b: underX + bw,
        under: true,
      };
    const bt =
      beside(xb, bw, [...pin, ...own]) ??
      (clear(under.a, under.b, pin) ? under : null) ??
      beside(xb, bw, own) ??
      (clear(under.a, under.b, []) ? under : centred(xb, bw));
    let labelRoom = R - L;
    if (bt.anchor === 'start') labelRoom = R - bt.x;
    else if (bt.anchor === 'end') labelRoom = bt.x - L;
    els.push(
      text(
        'BACKLABEL',
        bt.x,
        bt.under ? round(Y0 + 18 + cap(F.label)) : labelY,
        F.label,
        'semibold',
        'ink',
        {
          anchor: bt.anchor,
          fit: round(Math.min(wordsW(18, F.label), labelRoom)),
          enter: 'rise',
          dist: 14,
          dur: 0.45,
          ...cued('RECOVER', round(RISE_DUR * 0.8)),
        },
      ),
    );
  }
  return { ...context, cued, F, cap, text, dotR, xl, Ylow, els };
}
