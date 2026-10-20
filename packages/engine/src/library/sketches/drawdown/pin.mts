import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import type { drawdownAxis } from './axis.mjs';
export function drawActionPin(context: ReturnType<typeof drawdownAxis>) {
  const {
    act,
    xa,
    cued,
    F,
    cap,
    wordsW,
    text,
    dashed,
    L,
    R,
    dotR,
    pillH,
    pillPad,
    pillW,
    pillTop,
    noteY,
    axisY,
    chipW,
    place,
    spot,
    Ylow,
    yOn,
    els,
  } = context;
  // ACT: a pin on the day, raised from the line (from the axis when no line passes there): its
  // dashed stem draws up while its pill rides the top to the row over the chart.
  const RAISE = 1.4;

  if (act != null && xa != null) {
    const px = round(Math.min(Math.max(xa - pillW / 2, L), R - pillW));
    const on = yOn(act);
    const passesChip =
      place === 'below' && xa > spot.x - 12 && xa < spot.x + chipW + 12;
    const clearBottom = passesChip ? Ylow + dotR + 4 : axisY - 6;
    const bottom = round(on != null ? on - dotR - 6 : clearBottom);
    const top = round(pillTop + pillH);
    // (The stem follows the pill's ease out: its head reaches share f of the way at 1 − (1 − f)^⅓.)
    els.push(
      ...dashed([xa, bottom], [xa, top], {
        on: 12,
        off: 9,
        cue: 'ACT',
        dur: RAISE,
        at: (f) => 1 - Math.cbrt(1 - f),
        stroke: 'accent2',
        width: 5,
      }),
    );
    els.push({
      type: 'group',
      enter: 'fade',
      dur: 0.2,
      ...cued('ACT'),
      keys: [
        cued('ACT', 0, { dur: 0, y: round(bottom - top) }),
        cued('ACT', 0, { dur: RAISE, ease: 'out', y: 0 }),
      ],
      children: [
        {
          type: 'rect',
          x: px,
          y: round(pillTop),
          w: pillW,
          h: pillH,
          r: round(pillH / 2),
          fill: 'accent2',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'ACTLABEL',
          px + pillW / 2,
          pillTop + pillH / 2 + cap(F.act) / 2,
          F.act,
          'bold',
          'bg',
          {
            anchor: 'middle',
            fit: round(pillW - 2 * pillPad + 10),
            enter: 'none',
          },
        ),
      ],
    } satisfies CanvasElement);
    // The note sits beside the pin, on whichever side has room.
    const noteW = wordsW(16, F.note);
    const right = xa + 16 + noteW <= R || xa + 16 - L >= R - xa;
    els.push(
      text(
        'ACTNOTE',
        right ? xa + 16 : xa - 16,
        noteY,
        F.note,
        'semibold',
        'accent2',
        {
          ...(right ? {} : { anchor: 'end' }),
          fit: round(right ? R - xa - 16 : xa - 16 - L),
          enter: 'rise',
          dist: 12,
          dur: 0.45,
          ...cued('ACT', round(RAISE * 0.6)),
        },
      ),
    );
  }
}
